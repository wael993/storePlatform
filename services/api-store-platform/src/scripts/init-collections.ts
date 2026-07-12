import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { config } from '../config/config'
import Role from '../models/Role'

type RoleDocumentInput = {
	_id: string
	name: string
	resources?: Record<string, unknown>
	include?: string[]
	frontendResources?: Record<string, unknown>
}

const resolveRolesDirectory = (): string => {
	const fromEnv = process.env.ROLES_CONFIG_DIR

	if (fromEnv) {
		const envPath = path.resolve(fromEnv)

		if (fs.existsSync(envPath)) {
			return envPath
		}
	}

	const candidates = [
		path.resolve(
			__dirname,
			'../cron/mongo-db-collection-setup/src/config/roles',
		),
		path.resolve(
			__dirname,
			'../../cron/mongo-db-collection-setup/src/config/roles',
		),
		path.resolve(__dirname, './config/roles'),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	throw new Error(
		`Roles directory not found. Checked: ${candidates.join(', ')}. Set ROLES_CONFIG_DIR to override.`,
	)
}

const rolesDirectory = resolveRolesDirectory()

const readRoleFiles = (): RoleDocumentInput[] => {
	if (!fs.existsSync(rolesDirectory)) {
		throw new Error(`Roles directory does not exist: ${rolesDirectory}`)
	}

	const fileNames = fs
		.readdirSync(rolesDirectory)
		.filter(fileName => fileName.toLowerCase().endsWith('.json'))

	if (fileNames.length === 0) {
		throw new Error(`No JSON role files found in ${rolesDirectory}`)
	}

	return fileNames.map(fileName => {
		const absolutePath = path.join(rolesDirectory, fileName)
		const parsed = JSON.parse(
			fs.readFileSync(absolutePath, { encoding: 'utf-8' }),
		) as RoleDocumentInput

		if (!parsed._id || !parsed.name) {
			throw new Error(
				`Invalid role JSON (${fileName}): _id and name are required`,
			)
		}

		return {
			...parsed,
			_id: String(parsed._id).toUpperCase(),
			include: (parsed.include || []).map(role => role.toUpperCase()),
		}
	})
}

const initCollections = async () => {
	try {
		const roleDocs = readRoleFiles()

		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		console.log(
			`Connected to MongoDB (${mongoose.connection.name}.${Role.collection.collectionName})`,
		)

		await Role.syncIndexes()

		for (const roleDoc of roleDocs) {
			const result = await Role.updateOne(
				{ _id: roleDoc._id },
				{ $set: roleDoc },
				{ upsert: true },
			)

			console.log(
				`  ${roleDoc._id}: matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount ?? 0}`,
			)
		}

		const ids = roleDocs.map(doc => doc._id)

		await Role.deleteMany({ _id: { $nin: ids } })

		console.log(
			`Initialized Roles collection from ${roleDocs.length} file(s) in ${rolesDirectory}`,
		)
	} catch (error) {
		console.error('Failed to initialize collections:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
	}
}

initCollections()
