import mongoose from 'mongoose'
import { config } from '../config/config'
import Role from '../models/Role'

const ROLE_MOCKS = [
	{
		_id: 'OWNER',
		name: 'Owner',
		resources: {
			'/users': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
			'/products': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
			'/orders': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
			'/invoices': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
		},
		include: ['ADMIN', 'EMPLOYEE'],
		frontendResources: {
			'/settings': {
				access: true,
			},
			'/services/marketing_platform': {
				access: true,
				allowedActions: [
					'selectUserOnActivity',
					'selectActivityWatcher',
					'addComment',
				],
			},
		},
	},
	{
		_id: 'ADMIN',
		name: 'Admin',
		resources: {
			'/users': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
			'/products': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
			'/orders': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/invoices': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
		},
		include: ['EMPLOYEE'],
		frontendResources: {
			'/settings': {
				access: true,
			},
			'/services/marketing_platform': {
				access: true,
				allowedActions: ['selectActivityWatcher', 'addComment'],
			},
		},
	},
	{
		_id: 'CASHIER',
		name: 'Cashier',
		resources: {
			'/users': {
				GET: {
					accessLevel: 'GLOBAL',
					fields: ['userId', 'displayName', 'role'],
				},
				POST: { accessLevel: 'NONE', fields: [] },
				PATCH: { accessLevel: 'NONE', fields: [] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/products': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'NONE', fields: [] },
				PATCH: { accessLevel: 'NONE', fields: [] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/orders': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: {
					accessLevel: 'GLOBAL',
					fields: ['status', 'items', 'totalAmount'],
				},
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/invoices': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: {
					accessLevel: 'GLOBAL',
					fields: ['invoiceNumber', 'orderId', 'amount'],
				},
				PATCH: { accessLevel: 'GLOBAL', fields: ['status'] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
		},
		include: ['EMPLOYEE'],
		frontendResources: {
			'/settings': {
				access: false,
			},
			'/services/marketing_platform': {
				access: false,
			},
		},
	},
	{
		_id: 'EMPLOYEE',
		name: 'Employee',
		resources: {
			'/users': {
				GET: {
					accessLevel: 'GLOBAL',
					fields: ['userId', 'displayName', 'role'],
				},
				POST: { accessLevel: 'NONE', fields: [] },
				PATCH: { accessLevel: 'NONE', fields: [] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/products': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'NONE', fields: [] },
				PATCH: { accessLevel: 'NONE', fields: [] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/orders': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'NONE', fields: [] },
				PATCH: { accessLevel: 'NONE', fields: [] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
			'/invoices': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'NONE', fields: [] },
				PATCH: { accessLevel: 'NONE', fields: [] },
				DELETE: { accessLevel: 'NONE', fields: [] },
			},
		},
		include: [],
		frontendResources: {
			'/settings': {
				access: false,
			},
			'/services/marketing_platform': {
				access: false,
			},
		},
	},
	{
		_id: 'SUPER_ADMIN',
		name: 'Super Admin',
		resources: {
			'/tenants': {
				GET: { accessLevel: 'GLOBAL', fields: ['*'] },
				POST: { accessLevel: 'GLOBAL', fields: ['*'] },
				PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
				DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
			},
		},
		include: [],
		frontendResources: {
			'/add-new-tenant': {
				access: true,
			},
			'/tenants-list': {
				access: true,
				allowedActions: ['updateTenant', 'deleteTenant', 'toggleTenantStatus'],
			},
		},
	},
]

const seedRoles = async () => {
	try {
		await mongoose.connect(config.mongoDB.connectionString)
		console.log('Connected to MongoDB')

		await Role.syncIndexes()

		for (const roleDoc of ROLE_MOCKS) {
			await Role.updateOne(
				{ _id: roleDoc._id },
				{ $set: roleDoc },
				{ upsert: true },
			)
		}

		console.log(`Seeded ${ROLE_MOCKS.length} roles successfully.`)
	} catch (error) {
		console.error('Failed to seed roles:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
	}
}

seedRoles()
