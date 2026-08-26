import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { config } from '../config/config'
import Tenant from '../models/Tenant'
import User from '../models/User'
import UserSettings from '../models/UserSettings'
import CurrencySettings from '../models/CurrencySettings'
import InvoiceSettings from '../models/InvoiceSettings'
import { Currency } from '../models/Currency'
import { Unit } from '../models/Unit'
import { Warehouse } from '../models/Warehaus'
import { Shelf } from '../models/Shelf'
import { Brand } from '../models/Brand'
import { Category } from '../models/Category'
import { Supplier } from '../models/Supplier'
import { Customer } from '../models/Customer'
import { Partner } from '../models/Partner'
import { Employee } from '../models/Employee'
import { Expense } from '../models/Expense'
import { Product } from '../models/Products'
import { Inventory } from '../models/Inventory'
import { Invoice } from '../models/Invoice'
import { BuyingInvoice } from '../models/BuyingInvoices'
import { DailyAction } from '../models/DailyAction'
import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../shared/globalEnums'
import { CONFIGURABLE_TENANT_PAGES } from '../shared/constants/tenantAccessiblePages'
import { TENANT_STATUS } from '../shared/constants/tenant.constants'
import { createSubscription } from '../shared/subscription/lifecycle'
import { getSubscriptionConfig } from '../shared/subscription/persist'

const TENANT_ID = 'app'
const TENANT_NAME = 'app'
const DOMAIN = 'app.com'
const OWNER_EMAIL = 'user@app.com'
const PASSWORD = 'W123-456z'
const NOW = new Date()
const BY = {
	_id: 'seed-app',
	displayName: 'بذرة النظام',
	role: 'owner',
	createdAt: NOW,
}

const id = (suffix: string) => `${TENANT_ID}-${suffix}`

const wipe = async () => {
	const filter = { tenantId: TENANT_ID }

	await Promise.all([
		User.deleteMany(filter),
		UserSettings.deleteMany(filter),
		CurrencySettings.deleteMany(filter),
		InvoiceSettings.deleteMany(filter),
		Currency.deleteMany(filter),
		Unit.deleteMany(filter),
		Warehouse.deleteMany(filter),
		Shelf.deleteMany(filter),
		Brand.deleteMany(filter),
		Category.deleteMany(filter),
		Supplier.deleteMany(filter),
		Customer.deleteMany(filter),
		Partner.deleteMany(filter),
		Employee.deleteMany(filter),
		Expense.deleteMany(filter),
		Product.deleteMany(filter),
		Inventory.deleteMany(filter),
		Invoice.deleteMany(filter),
		BuyingInvoice.deleteMany(filter),
		DailyAction.deleteMany(filter),
	])
}

const money = (
	currency: { currencyId: string; name: string; internalCode?: string },
	amount: number,
	paid: number,
) => ({
	currencyId: currency.currencyId,
	name: currency.name,
	internalCode: currency.internalCode,
	exchangeRate: 1,
	isPrimary: true,
	amount,
	paidAmount: paid,
	remainingAmount: amount - paid,
	subtotal: amount,
	tax: 0,
	discount: 0,
})

async function seedAppTenant() {
	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	await User.syncIndexes()
	await wipe()

	const subscription = createSubscription(NOW, NOW, getSubscriptionConfig())

	await Tenant.findOneAndUpdate(
		{ tenantId: TENANT_ID },
		{
			$set: {
				tenantId: TENANT_ID,
				name: TENANT_NAME,
				domain: DOMAIN,
				status: TENANT_STATUS.ACTIVE,
				accessiblePages: [...CONFIGURABLE_TENANT_PAGES],
				offlineEnabled: true,
				subscription,
			},
		},
		{ upsert: true },
	)

	const hashed = await bcrypt.hash(PASSWORD, 10)
	const users = [
		{
			userId: id('user-owner'),
			email: OWNER_EMAIL,
			role: 'owner' as const,
			displayName: 'فراس الاسعد',
			user: { firstName: 'فراس', lastName: 'الاسعد' },
		},
		{
			userId: id('user-admin'),
			email: 'admin@app.com',
			role: 'admin' as const,
			displayName: 'وليد خالد',
			user: { firstName: 'وليد', lastName: 'خالد' },
		},
		{
			userId: id('user-cashier'),
			email: 'cashier@app.com',
			role: 'cashier' as const,
			displayName: 'محمود ناصر',
			user: { firstName: 'محمود', lastName: 'ناصر' },
		},
		{
			userId: id('user-employee'),
			email: 'employee@app.com',
			role: 'employee' as const,
			displayName: 'محمود حسن',
			user: { firstName: 'محمود', lastName: 'حسن' },
		},
	]

	await User.insertMany(
		users.map((user, index) => ({
			tenantId: TENANT_ID,
			...user,
			password: hashed,
			avatarColorId: 2100 + index,
			createdBy: BY,
		})),
	)

	const usd = {
		_id: id('cur-usd'),
		currencyId: id('cur-usd'),
		tenantId: TENANT_ID,
		name: '$',
		internalCode: '$',
		createdBy: BY,
	}
	const syp = {
		_id: id('cur-syp'),
		currencyId: id('cur-syp'),
		tenantId: TENANT_ID,
		name: 'ليرة سورية',
		internalCode: 'SYP',
		createdBy: BY,
	}

	await Currency.insertMany([usd, syp])
	await CurrencySettings.create({
		tenantId: TENANT_ID,
		primaryCurrency: {
			currencyId: usd.currencyId,
			name: usd.name,
			internalCode: usd.internalCode,
			exchangeRate: 1,
		},
		secondaryCurrencies: [
			{
				currencyId: syp.currencyId,
				name: syp.name,
				internalCode: syp.internalCode,
				exchangeRate: 15000,
				exchangeRateUnitCurrencyId: usd.currencyId,
			},
		],
	})

	await InvoiceSettings.create({
		tenantId: TENANT_ID,
		noMergeInvoiceLines: false,
		displayName: 'آب للإلكترونيات',
		address: 'عمّان، فرع التكت، شارع المدينة',
		phone: '+962 6 555 0101',
		email: 'hello@app.com',
		taxNumber: 'JO-APP-1001',
		footerNote: 'شكراً لتسوقكم من آب — ضمان رسمي على كل الأجهزة',
	})

	await UserSettings.insertMany(
		users.map(user => ({
			tenantId: TENANT_ID,
			userId: user.userId,
			productsPerPage: 20,
			displayLanguage: 'ar' as const,
			defaultInvoiceCurrencyId: usd.currencyId,
		})),
	)

	const piece = {
		tenantId: TENANT_ID,
		unitId: id('unit-piece'),
		name: 'قطعة',
		internalCode: 'PCS',
		createdBy: BY,
	}

	await Unit.create(piece)

	const warehouse = {
		tenantId: TENANT_ID,
		warehouseId: id('wh-main'),
		name: 'المستودع الرئيسي',
		code: 'MAIN',
		address: 'عمّان — المنطقة الحرة',
		status: 'active' as const,
		description: 'مستودع فرع التكت',
		createdBy: BY,
	}
	const shelf = {
		tenantId: TENANT_ID,
		shelfId: id('shelf-a1'),
		name: 'رف أ1',
		description: 'هواتف وأجهزة لوحية',
		createdBy: BY,
	}

	await Warehouse.create(warehouse)
	await Shelf.create(shelf)

	const brandRows = [
		{ name: 'سامسونج', description: 'هواتف وشاشات وأجهزة منزلية' },
		{ name: 'آبل', description: 'هواتف وحواسيب وإكسسوارات' },
		{ name: 'سوني', description: 'أجهزة ألعاب وصوتيات' },
		{ name: 'إل جي', description: 'تلفزيونات وأجهزة منزلية' },
		{ name: 'شاومي', description: 'هواتف وإلكترونيات بأسعار مناسبة' },
	]
	const brands = await Brand.insertMany(
		brandRows.map(brand => ({ ...brand, tenantId: TENANT_ID, createdBy: BY })),
	)
	const brandId = (name: string) =>
		String(brands.find(brand => brand.name === name)?._id ?? '')

	const categoryRows = [
		{
			categoryId: id('cat-phones'),
			name: 'هواتف ذكية',
			description: 'هواتف وأجهزة لوحية',
		},
		{
			categoryId: id('cat-laptops'),
			name: 'حواسيب محمولة',
			description: 'لابتوب وتابلت',
		},
		{ categoryId: id('cat-tv'), name: 'تلفزيونات', description: 'شاشات ذكية' },
		{
			categoryId: id('cat-audio'),
			name: 'صوتيات',
			description: 'سماعات ومكبرات',
		},
		{
			categoryId: id('cat-gaming'),
			name: 'ألعاب',
			description: 'أجهزة ألعاب واكسسوارات',
		},
		{
			categoryId: id('cat-home'),
			name: 'أجهزة منزلية',
			description: 'أجهزة كهربائية صغيرة',
		},
		{
			categoryId: id('cat-acc'),
			name: 'إكسسوارات',
			description: 'شواحن وكابلات وحقائب',
		},
	]

	await Category.insertMany(
		categoryRows.map(category => ({
			...category,
			tenantId: TENANT_ID,
			createdBy: BY,
		})),
	)

	const suppliers = [
		{
			supplierId: id('sup-1'),
			name: 'الشركة المتحدة للإلكترونيات',
			internalCode: 'SUP001',
			phone: '+962 6 400 1100',
			country: 'الأردن',
		},
		{
			supplierId: id('sup-2'),
			name: 'تجارة الخليج التقنية',
			internalCode: 'SUP002',
			phone: '+971 4 220 4488',
			country: 'الإمارات',
		},
		{
			supplierId: id('sup-3'),
			name: 'مستوردات الشام الرقمية',
			internalCode: 'SUP003',
			phone: '+963 11 330 2211',
			country: 'سوريا',
		},
	]

	await Supplier.insertMany(
		suppliers.map(supplier => ({
			...supplier,
			tenantId: TENANT_ID,
			createdBy: BY,
		})),
	)

	const customers = [
		{
			customerId: id('cus-1'),
			internalCode: 'CUS001',
			name: 'خالد يوسف',
			phone: '+962 79 111 2233',
			country: 'الأردن',
		},
		{
			customerId: id('cus-2'),
			internalCode: 'CUS002',
			name: 'منى عبد الرحمن',
			phone: '+962 78 444 5566',
			country: 'الأردن',
		},
		{
			customerId: id('cus-3'),
			internalCode: 'CUS003',
			name: 'مؤسسة النور للتجارة',
			phone: '+962 6 567 8900',
			country: 'الأردن',
		},
	]

	await Customer.insertMany(
		customers.map(customer => ({
			...customer,
			tenantId: TENANT_ID,
			createdBy: BY,
		})),
	)

	await Partner.insertMany([
		{
			_id: id('par-1'),
			tenantId: TENANT_ID,
			partnerId: id('par-1'),
			name: 'شريك التوصيل السريع',
			internalCode: 'PAR001',
			phone: '+962 79 900 1010',
			country: 'الأردن',
			createdBy: BY,
		},
		{
			_id: id('par-2'),
			tenantId: TENANT_ID,
			partnerId: id('par-2'),
			name: 'وكالة الضمان الذهبي',
			internalCode: 'PAR002',
			phone: '+962 6 200 3030',
			country: 'الأردن',
			createdBy: BY,
		},
	])

	await Employee.insertMany([
		{
			_id: id('emp-1'),
			tenantId: TENANT_ID,
			employeeId: id('emp-1'),
			name: 'باسم فؤاد',
			phone: '+962 79 321 1111',
			address: 'عمّان — عبدون',
			status: 'active',
			employmentType: 'full_time',
			startDate: '2025-01-15',
			workingDays: ['sun', 'mon', 'tue', 'wed', 'thu'],
			workStart: '09:00',
			workEnd: '18:00',
			salaries: [
				{
					salaryId: id('sal-1'),
					type: 'monthly',
					amount: 650,
					currencyId: usd.currencyId,
					currencyName: usd.name,
					effectiveDate: '2025-01-15',
				},
			],
			payouts: [
				{
					payoutId: id('pay-1'),
					date: '2026-07-31',
					amount: 650,
					currencyId: usd.currencyId,
					currencyName: usd.name,
					note: 'راتب تموز',
				},
			],
			createdBy: BY,
		},
		{
			_id: id('emp-2'),
			tenantId: TENANT_ID,
			employeeId: id('emp-2'),
			name: 'هدى سمير',
			phone: '+962 78 222 3344',
			address: 'عمّان — الجبيهة',
			status: 'active',
			employmentType: 'full_time',
			startDate: '2025-06-01',
			workingDays: ['sun', 'mon', 'tue', 'wed', 'thu', 'sat'],
			workStart: '10:00',
			workEnd: '19:00',
			salaries: [
				{
					salaryId: id('sal-2'),
					type: 'monthly',
					amount: 480,
					currencyId: usd.currencyId,
					currencyName: usd.name,
					effectiveDate: '2025-06-01',
				},
			],
			payouts: [],
			createdBy: BY,
		},
	])

	await Expense.insertMany([
		{
			_id: id('exp-rent'),
			tenantId: TENANT_ID,
			expenseId: id('exp-rent'),
			name: 'إيجار الفرع',
			internalCode: 'EXP001',
			createdBy: BY,
		},
		{
			_id: id('exp-power'),
			tenantId: TENANT_ID,
			expenseId: id('exp-power'),
			name: 'كهرباء',
			internalCode: 'EXP002',
			createdBy: BY,
		},
	])

	const products = [
		{
			productId: id('p-1'),
			name: 'سامسونج جالاكسي إس 25',
			latinName: 'Samsung Galaxy S25',
			categoryId: id('cat-phones'),
			brandId: brandId('سامسونج'),
			supplierId: id('sup-1'),
			barcode: '8806095125001',
			internalCode: 'P001',
			purchasePrice: 520,
			retailPrice: 649,
			quantity: 18,
		},
		{
			productId: id('p-2'),
			name: 'آيفون 16 برو 256',
			latinName: 'iPhone 16 Pro 256GB',
			categoryId: id('cat-phones'),
			brandId: brandId('آبل'),
			supplierId: id('sup-2'),
			barcode: '1942539126012',
			internalCode: 'P002',
			purchasePrice: 780,
			retailPrice: 949,
			quantity: 12,
		},
		{
			productId: id('p-3'),
			name: 'ماك بوك إير 13',
			latinName: 'MacBook Air 13',
			categoryId: id('cat-laptops'),
			brandId: brandId('آبل'),
			supplierId: id('sup-2'),
			barcode: '1942538130133',
			internalCode: 'P003',
			purchasePrice: 720,
			retailPrice: 899,
			quantity: 8,
		},
		{
			productId: id('p-4'),
			name: 'لابتوب لينوفو آيديا باد',
			latinName: 'Lenovo IdeaPad 15',
			categoryId: id('cat-laptops'),
			supplierId: id('sup-1'),
			barcode: '1955004015044',
			internalCode: 'P004',
			purchasePrice: 310,
			retailPrice: 399,
			quantity: 14,
		},
		{
			productId: id('p-5'),
			name: 'تلفزيون إل جي 55 بوصة',
			latinName: 'LG OLED 55',
			categoryId: id('cat-tv'),
			brandId: brandId('إل جي'),
			supplierId: id('sup-1'),
			barcode: '8806098550055',
			internalCode: 'P005',
			purchasePrice: 480,
			retailPrice: 629,
			quantity: 6,
		},
		{
			productId: id('p-6'),
			name: 'سماعات سوني دبليو إكس',
			latinName: 'Sony WH-1000XM5',
			categoryId: id('cat-audio'),
			brandId: brandId('سوني'),
			supplierId: id('sup-3'),
			barcode: '4548736140066',
			internalCode: 'P006',
			purchasePrice: 95,
			retailPrice: 139,
			quantity: 25,
		},
		{
			productId: id('p-7'),
			name: 'بلايستيشن 5',
			latinName: 'PlayStation 5',
			categoryId: id('cat-gaming'),
			brandId: brandId('سوني'),
			supplierId: id('sup-2'),
			barcode: '7117195470777',
			internalCode: 'P007',
			purchasePrice: 340,
			retailPrice: 429,
			quantity: 9,
		},
		{
			productId: id('p-8'),
			name: 'مكنسة شاومي الكهربائية',
			latinName: 'Xiaomi Vacuum',
			categoryId: id('cat-home'),
			brandId: brandId('شاومي'),
			supplierId: id('sup-3'),
			barcode: '6934177780088',
			internalCode: 'P008',
			purchasePrice: 160,
			retailPrice: 219,
			quantity: 11,
		},
		{
			productId: id('p-9'),
			name: 'شاحن سريع 45 واط',
			latinName: '45W Fast Charger',
			categoryId: id('cat-acc'),
			supplierId: id('sup-1'),
			barcode: '6281000000099',
			internalCode: 'P009',
			purchasePrice: 8,
			retailPrice: 14.5,
			quantity: 80,
		},
		{
			productId: id('p-10'),
			name: 'شاومي ريدمي نوت 14',
			latinName: 'Redmi Note 14',
			categoryId: id('cat-phones'),
			brandId: brandId('شاومي'),
			supplierId: id('sup-3'),
			barcode: '6934177714010',
			internalCode: 'P010',
			purchasePrice: 115,
			retailPrice: 159,
			quantity: 22,
		},
	]

	await Product.insertMany(
		products.map(product => ({
			tenantId: TENANT_ID,
			productId: product.productId,
			name: product.name,
			latinName: product.latinName,
			categoryId: product.categoryId,
			brandId: product.brandId,
			supplierId: product.supplierId,
			barcode: product.barcode,
			internalCode: product.internalCode,
			unitId: piece.unitId,
			price: {
				purchasePrice: product.purchasePrice,
				retailPrice: product.retailPrice,
				wholesalePrice: Number((product.retailPrice * 0.92).toFixed(2)),
				semiWholesalePrice: Number((product.retailPrice * 0.96).toFixed(2)),
				discount: 0,
				currency: '$',
			},
			status: 'active' as const,
			description: `${product.name} — فرع التكت`,
			createdBy: BY,
		})),
	)

	await Inventory.insertMany(
		products.map((product, index) => ({
			tenantId: TENANT_ID,
			inventoryId: id(`inv-${index + 1}`),
			productId: product.productId,
			warehouseId: warehouse.warehouseId,
			shelfId: shelf.shelfId,
			quantity: product.quantity,
			averageCost: product.purchasePrice,
			minQuantity: 3,
			reservedQuantity: 0,
			availableQuantity: product.quantity,
			createdBy: BY,
		})),
	)

	const phone = products[0]
	const iphone = products[1]
	const charger = products[8]
	const buyTotal = phone.purchasePrice * 10 + charger.purchasePrice * 40
	const SELL_DAYS = 5
	const SELLS_PER_DAY = 5
	const sellingInvoices = Array.from(
		{ length: SELL_DAYS * SELLS_PER_DAY },
		(_, index) => {
			const daysAgo = SELL_DAYS - 1 - Math.floor(index / SELLS_PER_DAY)
			const slot = index % SELLS_PER_DAY
			const product = products[index % products.length]
			const customer = customers[slot % customers.length]
			const qty = (slot % 3) + 1
			const amount = product.retailPrice * qty
			const isCredit = slot === SELLS_PER_DAY - 1
			const issuedAt = new Date(NOW)

			issuedAt.setUTCDate(issuedAt.getUTCDate() - daysAgo)
			issuedAt.setUTCHours(9 + slot, slot * 10, 0, 0)

			const n = String(index + 1).padStart(4, '0')

			return {
				tenantId: TENANT_ID,
				invoiceId: id(`si-${index + 1}`),
				invoiceNumber: `SI-${n}`,
				customerId: customer.customerId,
				customerName: customer.name,
				salesPerson: users[(slot % 2) + 1].displayName,
				paymentType: isCredit
					? InvoicePaymentType.CREDIT
					: InvoicePaymentType.CASH,
				status: isCredit ? InvoiceStatus.CONFIRMED : InvoiceStatus.PAID,
				paymentStatus: isCredit
					? InvoicePaymentStatus.UNPAID
					: InvoicePaymentStatus.PAID,
				items: [
					{
						productId: product.productId,
						name: product.name,
						barcode: product.barcode,
						quantity: qty,
						unit: piece.name,
						unitPrice: product.retailPrice,
						discount: 0,
						discountIsPercent: true,
						taxRate: 0,
						lineTotal: amount,
					},
				],
				currencyAmounts: [money(usd, amount, isCredit ? 0 : amount)],
				notes: isCredit ? 'بيع آجل — فرع التكت' : 'بيع نقدي — فرع التكت',
				warehouseId: warehouse.warehouseId,
				issuedAt,
				createdBy: BY,
			}
		},
	)

	await Invoice.insertMany(sellingInvoices)
	const firstSale = sellingInvoices[0]

	await BuyingInvoice.insertMany([
		{
			tenantId: TENANT_ID,
			buyingInvoiceId: id('bi-1'),
			invoiceNumber: 'BI-0001',
			supplierId: suppliers[0].supplierId,
			supplierName: suppliers[0].name,
			supplierInvoiceNumber: 'UNI-8841',
			paymentType: InvoicePaymentType.CASH,
			status: InvoiceStatus.PAID,
			paymentStatus: InvoicePaymentStatus.PAID,
			items: [
				{
					productId: phone.productId,
					name: phone.name,
					quantity: 10,
					unit: piece.name,
					unitPrice: phone.purchasePrice,
					lineTotal: phone.purchasePrice * 10,
				},
				{
					productId: charger.productId,
					name: charger.name,
					quantity: 40,
					unit: piece.name,
					unitPrice: charger.purchasePrice,
					lineTotal: charger.purchasePrice * 40,
				},
			],
			currencyAmounts: [money(usd, buyTotal, buyTotal)],
			notes: 'شراء جملة للهواتف والشواحن',
			warehouseId: warehouse.warehouseId,
			issuedAt: new Date('2026-07-20T00:00:00.000Z'),
			createdBy: BY,
		},
		{
			tenantId: TENANT_ID,
			buyingInvoiceId: id('bi-2'),
			invoiceNumber: 'BI-0002',
			supplierId: suppliers[1].supplierId,
			supplierName: suppliers[1].name,
			paymentType: InvoicePaymentType.CREDIT,
			status: InvoiceStatus.CONFIRMED,
			paymentStatus: InvoicePaymentStatus.PARTIAL,
			items: [
				{
					productId: iphone.productId,
					name: iphone.name,
					quantity: 5,
					unit: piece.name,
					unitPrice: iphone.purchasePrice,
					lineTotal: iphone.purchasePrice * 5,
				},
			],
			currencyAmounts: [money(usd, iphone.purchasePrice * 5, 1500)],
			notes: 'طلب آيفون — دفعة جزئية',
			warehouseId: warehouse.warehouseId,
			issuedAt: new Date('2026-07-28T00:00:00.000Z'),
			createdBy: BY,
		},
	])

	await DailyAction.insertMany([
		{
			tenantId: TENANT_ID,
			actionId: id('da-buy'),
			entryType: 'BUYING_ENTRY',
			productId: phone.productId,
			productName: phone.name,
			supplierId: suppliers[0].supplierId,
			supplierName: suppliers[0].name,
			invoiceNumber: 'BI-0001',
			invoiceDate: new Date('2026-07-20T00:00:00.000Z'),
			currencyId: usd.currencyId,
			currencyName: usd.name,
			unitId: piece.unitId,
			unitName: piece.name,
			weight: '10',
			singleUnitPrice: String(phone.purchasePrice),
			totalPrice: String(phone.purchasePrice * 10),
			note: 'إدخال شراء هواتف',
			createdBy: BY,
		},
		{
			tenantId: TENANT_ID,
			actionId: id('da-sell'),
			entryType: 'SELLING_ENTRY',
			productId: firstSale.items[0].productId,
			productName: firstSale.items[0].name,
			customerId: firstSale.customerId,
			customerName: firstSale.customerName,
			invoiceNumber: firstSale.invoiceNumber,
			invoiceDate: firstSale.issuedAt,
			currencyId: usd.currencyId,
			currencyName: usd.name,
			unitId: piece.unitId,
			unitName: piece.name,
			weight: String(firstSale.items[0].quantity),
			singleUnitPrice: String(firstSale.items[0].unitPrice),
			totalPrice: String(firstSale.items[0].lineTotal),
			note: 'إدخال بيع نقدي',
			createdBy: BY,
		},
		{
			tenantId: TENANT_ID,
			actionId: id('da-exp'),
			entryType: 'EXPENSE_ENTRY',
			expenseId: id('exp-rent'),
			expenseName: 'إيجار الفرع',
			invoiceDate: new Date('2026-08-01T00:00:00.000Z'),
			currencyId: usd.currencyId,
			currencyName: usd.name,
			totalPrice: '1200',
			note: 'إيجار آب لشهر آب',
			createdBy: BY,
		},
		{
			tenantId: TENANT_ID,
			actionId: id('da-rec'),
			entryType: 'RECEIPT_ENTRY',
			customerId: customers[2].customerId,
			customerName: customers[2].name,
			invoiceDate: new Date('2026-08-10T00:00:00.000Z'),
			currencyId: usd.currencyId,
			currencyName: usd.name,
			totalPrice: '200',
			note: 'دفعة على فاتورة آجلة',
			createdBy: BY,
		},
		{
			tenantId: TENANT_ID,
			actionId: id('da-pay'),
			entryType: 'PAYMENT_ENTRY',
			supplierId: suppliers[1].supplierId,
			supplierName: suppliers[1].name,
			invoiceDate: new Date('2026-08-08T00:00:00.000Z'),
			currencyId: usd.currencyId,
			currencyName: usd.name,
			totalPrice: '1500',
			note: 'دفعة لمورد الخليج',
			createdBy: BY,
		},
	])

	console.log(`Seeded tenant ${TENANT_NAME} (${DOMAIN})`)
	console.log(`Login: ${OWNER_EMAIL} / ${PASSWORD}`)
}

seedAppTenant()
	.catch(error => {
		console.error('Failed to seed app tenant:', error)
		process.exit(1)
	})
	.finally(async () => {
		await mongoose.disconnect()
	})
