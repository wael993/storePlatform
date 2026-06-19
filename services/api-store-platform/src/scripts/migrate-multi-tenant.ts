import mongoose from 'mongoose'
import { config } from '../config/config'
import Tenant from '../models/Tenant'
import {
	DEFAULT_TENANT_DOMAIN,
	DEFAULT_TENANT_ID,
	DEFAULT_TENANT_NAME,
	TENANT_ROLES,
} from '../shared/tenant'

const COLLECTIONS = [
	'users',
	'products',
	'orders',
	'invoices',
	'inventories',
	'reports',
	'refreshtokens',
] as const

async function migrateMultiTenant() {
	try {
		await mongoose.connect(config.mongoDB.connectionString)
		console.log('Connected to MongoDB')

		await Tenant.updateOne(
			{ tenantId: DEFAULT_TENANT_ID },
			{
				$set: {
					name: DEFAULT_TENANT_NAME,
					domain: DEFAULT_TENANT_DOMAIN,
					status: 'active',
				},
			},
			{ upsert: true },
		)

		for (const collectionName of COLLECTIONS) {
			const collection = mongoose.connection.collection(collectionName)
			const exists = await collection.countDocuments().catch(() => 0)

			if (exists === 0) {
				continue
			}

			await collection.updateMany(
				{ tenantId: { $exists: false } },
				{ $set: { tenantId: DEFAULT_TENANT_ID } },
			)
		}

		await mongoose.connection
			.collection('users')
			.updateMany({ role: { $nin: TENANT_ROLES } }, [
				{
					$set: {
						role: {
							$switch: {
								branches: [
									{ case: { $eq: ['$role', 'admin'] }, then: 'owner' },
									{ case: { $eq: ['$role', 'editor'] }, then: 'employee' },
								],
								default: 'employee',
							},
						},
					},
				},
			])

		console.log('Multi-tenant migration completed')
	} catch (error) {
		console.error('Multi-tenant migration failed', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
	}
}

migrateMultiTenant()
