import mongoose from 'mongoose'
import { config } from '../config/config'
import { Brand } from '../models/Brand'
import { Category } from '../models/Category'
import { Supplier } from '../models/Supplier'
import Tenant from '../models/Tenant'
import {
	DEFAULT_TENANT_DOMAIN,
	DEFAULT_TENANT_ID,
	DEFAULT_TENANT_NAME,
} from '../shared/tenant'

const BRANDS_DATA = [
	{
		name: 'TechPro',
		description: 'Premium technology products',
	},
	{
		name: 'EliteElectronics',
		description: 'High-end electronics',
	},
	{
		name: 'SmartHome',
		description: 'Smart home devices',
	},
	{
		name: 'PowerMax',
		description: 'Power and energy products',
	},
	{
		name: 'VisionTech',
		description: 'Visual technology and displays',
	},
]

const CATEGORIES_DATA = [
	{
		name: 'Electronics',
		description: 'Electronic devices and accessories',
	},
	{
		name: 'Computers',
		description: 'Computers and computer accessories',
		parentCategoryId: null,
	},
	{
		name: 'Peripherals',
		description: 'Computer peripherals and input devices',
		parentCategoryId: null,
	},
	{
		name: 'Mobile Devices',
		description: 'Mobile phones and tablets',
	},
	{
		name: 'Networking',
		description: 'Network devices and equipment',
	},
]

const SUPPLIERS_DATA = [
	{
		_id: '093485z4393485',
		supplierId: '093485z4393485',
		name: 'فايز النابلسي',
		internalCode: 'SZ001',
	},
	{
		_id: '093485z4393486',
		supplierId: '093485z4393486',
		name: 'علي الحاج',
		internalCode: 'SZ002',
	},
	{
		_id: '093485z4393487',
		supplierId: '093485z4393487',
		name: 'محمد الكيلاني',
		internalCode: 'SZ003',
	},
	{
		_id: '093485z4393488',
		supplierId: '093485z4393488',
		name: 'احمد الزعبي',
		internalCode: 'SZ004',
	},
	{
		_id: '093485z4393489',
		supplierId: '093485z4393489',
		name: 'خالد العلي',
		internalCode: 'SZ005',
	},
	{
		_id: '093485z4393490',
		supplierId: '093485z4393490',
		name: 'ابو علاء البردان',
		internalCode: 'SZ006',
	},
	{
		_id: '093485z4393491',
		supplierId: '093485z4393491',
		name: 'حسام الحشيش',
		internalCode: 'SZ007',
	},
	{
		_id: '093485z4393492',
		supplierId: '093485z4393492',
		name: 'كمال النابلسي',
		internalCode: 'SZ008',
	},
	{
		_id: '093485z4393493',
		supplierId: '093485z4393493',
		name: 'رامي حميد ',
		internalCode: 'SZ009',
	},
	{
		_id: '093485z4393494',
		supplierId: '093485z4393494',
		name: 'باسم ابراهيم الحايك ',
		internalCode: 'SZ010',
	},

	// {
	// 	name: 'Global Tech Supplies',
	// 	email: 'contact@globaltechsupplies.com',
	// 	phone: '+49 123 456789',
	// 	country: 'Germany',
	// },
	// {
	// 	name: 'European Electronics Ltd',
	// 	email: 'sales@euroelectronics.eu',
	// 	phone: '+44 20 7946 0958',
	// 	country: 'United Kingdom',
	// },
	// {
	// 	name: 'Asia Tech Imports',
	// 	email: 'import@asiatechimports.com',
	// 	phone: '+852 3956 1234',
	// 	country: 'Hong Kong',
	// },
	// {
	// 	name: 'Direct Components Wholesale',
	// 	email: 'wholesale@directcomponents.de',
	// 	phone: '+49 30 12345678',
	// 	country: 'Germany',
	// },
	// {
	// 	name: 'Premium Distributors Inc',
	// 	email: 'distribution@premiumdist.com',
	// 	phone: '+33 1 42 68 53 00',
	// 	country: 'France',
	// },
]

async function seedMasterData() {
	try {
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		console.log('Connected to MongoDB')

		// Get or create default tenant
		let tenant = await Tenant.findOne({ tenantId: DEFAULT_TENANT_ID })

		if (!tenant) {
			tenant = await Tenant.create({
				tenantId: DEFAULT_TENANT_ID,
				name: DEFAULT_TENANT_NAME,
				domain: DEFAULT_TENANT_DOMAIN,
				status: 'active',
			})

			console.log('Created default tenant')
		}

		const tenantId = tenant.tenantId
		const systemUser = {
			_id: 'system',
			displayName: 'System',
			createdAt: new Date(),
		}

		// Seed Brands
		console.log('Seeding brands...')
		await Brand.deleteMany({ tenantId })
		const brandDocs = BRANDS_DATA.map(brand => ({
			...brand,
			tenantId,
			createdBy: systemUser,
		}))
		const createdBrands = await Brand.insertMany(brandDocs)

		console.log(`✓ Created ${createdBrands.length} brands`)

		// Seed Categories
		console.log('Seeding categories...')
		await Category.deleteMany({ tenantId })
		const categoryDocs = CATEGORIES_DATA.map(category => ({
			...category,
			tenantId,
			createdBy: systemUser,
		}))
		const createdCategories = await Category.insertMany(categoryDocs)

		console.log(`✓ Created ${createdCategories.length} categories`)

		// Seed Suppliers
		console.log('Seeding suppliers...')
		await Supplier.deleteMany({ tenantId })
		const supplierDocs = SUPPLIERS_DATA.map(supplier => ({
			...supplier,
			tenantId,
			createdBy: systemUser,
		}))
		const createdSuppliers = await Supplier.insertMany(supplierDocs)

		console.log(`✓ Created ${createdSuppliers.length} suppliers`)

		console.log('\n✓ Master data seeding completed successfully!')
		console.log(`
Brands: ${createdBrands.map(b => `${b.name} (${b._id})`).join(', ')}
Categories: ${createdCategories.map(c => `${c.name} (${c._id})`).join(', ')}
Suppliers: ${createdSuppliers.map(s => `${s.name} (${s._id})`).join(', ')}
		`)

		process.exit(0)
	} catch (error) {
		console.error('Error seeding master data:', error)
		process.exit(1)
	}
}

seedMasterData()
