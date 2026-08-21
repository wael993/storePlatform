import mongoose from 'mongoose'
import { config } from '../config/config'
import Role from '../models/Role'

const readOnlyResource = {
	GET: { accessLevel: 'GLOBAL', fields: ['*'] },
	POST: { accessLevel: 'NONE', fields: [] },
	PATCH: { accessLevel: 'NONE', fields: [] },
	DELETE: { accessLevel: 'NONE', fields: [] },
} as const

const createOnlyResource = {
	GET: { accessLevel: 'GLOBAL', fields: ['*'] },
	POST: { accessLevel: 'GLOBAL', fields: ['*'] },
	PATCH: { accessLevel: 'NONE', fields: [] },
	DELETE: { accessLevel: 'NONE', fields: [] },
} as const

const fullAccessResource = {
	GET: { accessLevel: 'GLOBAL', fields: ['*'] },
	POST: { accessLevel: 'GLOBAL', fields: ['*'] },
	PATCH: { accessLevel: 'GLOBAL', fields: ['*'] },
	DELETE: { accessLevel: 'GLOBAL', fields: ['*'] },
} as const

const noAccessResource = {
	GET: { accessLevel: 'NONE', fields: [] },
	POST: { accessLevel: 'NONE', fields: [] },
	PATCH: { accessLevel: 'NONE', fields: [] },
	DELETE: { accessLevel: 'NONE', fields: [] },
} as const

const OWNER_READ_ONLY_RESOURCES = [
	'/categories',
	'/orders',
	'/invoices',
	'/buyingInvoices',
	'/reports',
	'/dailyActions',
	'/suppliers',
	'/customers',
	'/partners',
	'/expenses',
	'/currencies',
	'/units',
	'/brands',
	'/shelves',
	'/warehouses',
] as const

const OWNER_CREATE_RESOURCES = ['/brands', '/shelves', '/warehouses'] as const
const OWNER_FULL_ACCESS_RESOURCES = [
	'/employees',
	'/products',
	'/inventory',
] as const

const ADMIN_FULL_ACCESS_RESOURCES = [
	'/users',
	...OWNER_READ_ONLY_RESOURCES,
	...OWNER_FULL_ACCESS_RESOURCES,
] as const

const ROLE_MOCKS = [
	{
		_id: 'OWNER',
		name: 'Owner',
		resources: {
			'/users': noAccessResource,
			...Object.fromEntries(
				OWNER_READ_ONLY_RESOURCES.map(resource => [
					resource,
					(OWNER_CREATE_RESOURCES as readonly string[]).includes(resource)
						? createOnlyResource
						: readOnlyResource,
				]),
			),
			...Object.fromEntries(
				OWNER_FULL_ACCESS_RESOURCES.map(resource => [
					resource,
					fullAccessResource,
				]),
			),
		},
		include: [],
		frontendResources: {
			'/services/store_platform/settings': { access: true },
			'/services/store_platform/products': {
				access: true,
				allowedActions: [
					'addProduct',
					'deleteProduct',
					'seeSupplier',
					'seeCustomer',
					'seeBuyCost',
					'canEditBuyCost',
					'seeWholesalePrice',
					'canEditWholesalePrice',
					'seeDiscount',
					'canEditDiscount',
					'seeStockQuantity',
					'canEditStockQuantity',
					'seeMinStockQuantity',
					'canEditMinStockQuantity',
					'seeNotifications',
					'seeReport',
					'seeLocationShelf',
					'seeLocationWarehouse',
				],
			},
			'/services/store_platform/customers': {
				access: true,
				allowedActions: ['seeCustomer'],
			},
			'/services/store_platform/suppliers': {
				access: true,
				allowedActions: ['seeSupplier'],
			},
			'/services/store_platform/partners': {
				access: true,
				allowedActions: ['seePartner'],
			},
			'/services/store_platform/daily': {
				access: true,
				allowedActions: ['seeDailyAction'],
			},
			'/services/store_platform/categories': {
				access: true,
				allowedActions: ['seeCategory'],
			},
			'/services/store_platform/employees': { access: true },
		},
	},
	{
		_id: 'ADMIN',
		name: 'Admin',
		resources: Object.fromEntries(
			ADMIN_FULL_ACCESS_RESOURCES.map(resource => [
				resource,
				fullAccessResource,
			]),
		),
		include: [],
		frontendResources: {
			'/services/store_platform/settings': { access: true },
			'/services/store_platform/users': { access: true },
			'/services/store_platform': {
				access: true,
				allowedActions: ['selectActivityWatcher', 'addComment'],
			},
			'/services/store_platform/products': {
				access: true,
				allowedActions: [
					'addProduct',
					'deleteProduct',
					'seeSupplier',
					'canAddSupplier',
					'canEditSupplier',
					'canDeleteSupplier',
					'seeCustomer',
					'canAddCustomer',
					'canEditCustomer',
					'canDeleteCustomer',
					'seeBuyCost',
					'canEditBuyCost',
					'seeWholesalePrice',
					'canEditWholesalePrice',
					'seeDiscount',
					'canEditDiscount',
					'seeStockQuantity',
					'canEditStockQuantity',
					'seeNotifications',
					'seeMinStockQuantity',
					'canEditMinStockQuantity',
					'seeReport',
					'canAddReport',
					'canEditReport',
					'canDeleteReport',
					'seeLocationShelf',
					'canEditLocationShelf',
					'seeLocationWarehouse',
					'canEditLocationWarehouse',
				],
			},
			'/services/store_platform/customers': {
				access: true,
				allowedActions: [
					'seeCustomer',
					'canAddCustomer',
					'canEditCustomer',
					'canDeleteCustomer',
				],
			},
			'/services/store_platform/suppliers': {
				access: true,
				allowedActions: [
					'seeSupplier',
					'canAddSupplier',
					'canEditSupplier',
					'canDeleteSupplier',
				],
			},
			'/services/store_platform/partners': {
				access: true,
				allowedActions: [
					'seePartner',
					'canAddPartner',
					'canEditPartner',
					'canDeletePartner',
				],
			},
			'/services/store_platform/daily': {
				access: true,
				allowedActions: [
					'seeDailyAction',
					'addDailyAction',
					'editDailyAction',
					'deleteDailyAction',
					'seeBudgetOverview',
				],
			},
			'/services/store_platform/categories': {
				access: true,
				allowedActions: [
					'seeCategory',
					'canAddCategory',
					'canEditCategory',
					'canDeleteCategory',
				],
			},
			'/services/store_platform/employees': { access: true },
		},
	},
	{
		_id: 'CASHIER',
		name: 'Cashier',
		resources: {},
		include: [],
		frontendResources: {},
	},
	{
		_id: 'EMPLOYEE',
		name: 'Employee',
		resources: {},
		include: [],
		frontendResources: {},
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
			'/services/store_platform/add-new-tenant': {
				access: true,
			},
			'/services/store_platform/tenants-list': {
				access: true,
				allowedActions: ['updateTenant', 'deleteTenant', 'toggleTenantStatus'],
			},
		},
	},
]

const seedRoles = async () => {
	try {
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		console.log(`Connected to MongoDB (${mongoose.connection.name})`)

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
