import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/config'
import User from '../models/User'
import Tenant from '../models/Tenant'
import { SUPER_ADMIN_ROLE, getSuperAdminTenantId } from '../shared/tenant'
import {
	validateEmail,
	validatePasswordStrength,
} from '../utils/authValidation'

const CONTROL_PLANE_TENANT_NAME = 'Super Admin Control'

async function createSuperAdminUser() {
	const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	const password = process.env.SUPER_ADMIN_PASSWORD

	if (!email) {
		throw new Error('Missing SUPER_ADMIN_EMAIL.')
	}

	if (!password) {
		throw new Error('Missing SUPER_ADMIN_PASSWORD.')
	}

	const emailError = validateEmail(email)

	if (emailError) {
		throw new Error(emailError)
	}

	const passwordError = validatePasswordStrength(password)

	if (passwordError) {
		throw new Error(passwordError)
	}

	const domain = email.split('@')[1]
	const tenantId = getSuperAdminTenantId()

	try {
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		console.log('Connected to MongoDB')
		await User.syncIndexes()

		await Tenant.updateOne(
			{ tenantId },
			{
				$set: {
					tenantId,
					name: CONTROL_PLANE_TENANT_NAME,
					domain,
					status: 'active',
				},
			},
			{ upsert: true },
		)

		const hashedPassword = await bcrypt.hash(password, 10)
		const existing =
			(await User.findOne({ tenantId, email })) ??
			(await User.findOne({ tenantId, role: SUPER_ADMIN_ROLE }))

		if (existing) {
			existing.email = email
			existing.role = SUPER_ADMIN_ROLE
			existing.password = hashedPassword
			existing.tokenVersion = (existing.tokenVersion ?? 0) + 1
			await existing.save()
			console.log('Super admin user updated')
		} else {
			await User.create({
				tenantId,
				userId: uuidv4(),
				displayName: 'Wael Zobani',
				user: {
					firstName: 'Wael',
					lastName: 'Zobani',
				},
				email,
				password: hashedPassword,
				role: SUPER_ADMIN_ROLE,
				avatarColorId: Math.floor(Math.random() * 1000000),
				createdBy: {
					_id: 'seed',
					displayName: 'seed',
					createdAt: new Date(),
				},
			})

			console.log('Super admin user created')
		}

		const revoked = await User.collection.updateMany(
			{ role: SUPER_ADMIN_ROLE, tenantId: { $ne: tenantId } },
			{ $set: { role: 'employee' } },
		)

		console.log('Email:', email)
		console.log('Tenant:', tenantId)
		console.log(`Revoked stray super_admin users: ${revoked.modifiedCount}`)
	} catch (error) {
		console.error('Failed to create super admin user:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
	}
}

createSuperAdminUser()
