import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/config'
import { Customer } from '../models/Customer'
import { Currency } from '../models/Currency'
import { Invoice } from '../models/Invoice'
import { Product } from '../models/Products'
import { Unit } from '../models/Unit'
import Tenant from '../models/Tenant'
import { INITIAL_CUSTOMERS_DATA } from './initial-customers-data'

const TENANT_ID = 'zobani-car'
const OPENING_PRODUCT_NAME = 'رصيد افتتاحي'
const OPENING_PRODUCT_ID = `${TENANT_ID}-opening-balance-product`
const OPENING_NOTE = 'رصيد افتتاحي'
const ISSUED_AT = new Date('2026-01-01T00:00:00.000Z')
const DEFAULT_UNIT_NAME = 'قطعة'
const SEED_USER = {
	_id: 'seed-script',
	displayName: 'Seed Script',
	createdAt: new Date(),
}

async function resolveUsdCurrency() {
	const currencies = await Currency.find({ tenantId: TENANT_ID }).lean()
	const usd = currencies.find(currency => {
		const code = (currency.internalCode || '').toUpperCase()
		const name = (currency.name || '').toUpperCase()

		return (
			code === 'USD' ||
			code === '$' ||
			name === 'USD' ||
			name.includes('DOLLAR') ||
			name.includes('$')
		)
	})

	if (!usd) {
		throw new Error(
			`No USD currency found for tenant "${TENANT_ID}". Create a USD currency first.`,
		)
	}

	return usd
}

async function resolvePieceUnitId(): Promise<string> {
	const existing = await Unit.findOne({
		tenantId: TENANT_ID,
		name: DEFAULT_UNIT_NAME,
	}).lean()

	if (existing) {
		return existing.unitId
	}

	const unitId = uuidv4()

	await Unit.create({
		tenantId: TENANT_ID,
		unitId,
		name: DEFAULT_UNIT_NAME,
		internalCode: DEFAULT_UNIT_NAME.toUpperCase(),
		createdBy: SEED_USER,
	})

	return unitId
}

async function ensureOpeningProduct(unitId: string) {
	await Product.updateOne(
		{ tenantId: TENANT_ID, productId: OPENING_PRODUCT_ID },
		{
			$set: {
				tenantId: TENANT_ID,
				name: OPENING_PRODUCT_NAME,
				unitId,
				price: {
					retailPrice: 0,
					currency: 'USD',
				},
				images: [],
				status: 'active',
			},
			$setOnInsert: {
				productId: OPENING_PRODUCT_ID,
				internalCode: 'OPENING-BALANCE',
				productFactoryCode: 'OPENING-BALANCE',
				createdBy: SEED_USER,
			},
		},
		{ upsert: true },
	)

	return OPENING_PRODUCT_ID
}

async function createInitialCustomers() {
	try {
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		console.log('Connected to MongoDB')

		const tenant = await Tenant.findOne({ tenantId: TENANT_ID }).lean()

		if (!tenant) {
			throw new Error(`Tenant "${TENANT_ID}" was not found`)
		}

		const usd = await resolveUsdCurrency()
		const unitId = await resolvePieceUnitId()
		const openingProductId = await ensureOpeningProduct(unitId)

		const customers = INITIAL_CUSTOMERS_DATA.map((customer, index) => {
			const n = index + 1

			return {
				tenantId: TENANT_ID,
				customerId: `${TENANT_ID}-customer-${n}`,
				internalCode: `CUST-${String(n).padStart(3, '0')}`,
				name: customer.name,
				...(customer.phone && { phone: customer.phone }),
				createdBy: SEED_USER,
			}
		})

		await Customer.insertMany(customers)

		await Invoice.insertMany(
			INITIAL_CUSTOMERS_DATA.map((row, index) => {
				const n = index + 1
				const debt = Number(row.debt.toFixed(2))
				const customer = customers[index]

				return {
					tenantId: TENANT_ID,
					invoiceId: `${TENANT_ID}-opening-SI-${n}`,
					invoiceNumber: `SI-OPEN-${String(n).padStart(3, '0')}`,
					customerId: customer.customerId,
					customerName: customer.name,
					paymentType: 'credit' as const,
					status: 'confirmed' as const,
					paymentStatus: 'unpaid' as const,
					items: [
						{
							productId: openingProductId,
							name: OPENING_PRODUCT_NAME,
							quantity: 1,
							unit: DEFAULT_UNIT_NAME,
							unitPrice: debt,
							discount: 0,
							discountIsPercent: true,
							taxRate: 0,
							lineTotal: debt,
						},
					],
					currencyAmounts: [
						{
							currencyId: usd.currencyId,
							name: usd.name,
							internalCode: usd.internalCode || 'USD',
							exchangeRate: 1,
							isPrimary: true,
							amount: debt,
							paidAmount: 0,
							remainingAmount: debt,
							subtotal: debt,
							tax: 0,
							discount: 0,
						},
					],
					notes: OPENING_NOTE,
					issuedAt: ISSUED_AT,
					createdBy: SEED_USER,
				}
			}),
		)

		const totalDebt = INITIAL_CUSTOMERS_DATA.reduce(
			(sum, customer) => sum + customer.debt,
			0,
		)

		console.log(
			`Seeded ${customers.length} customers and ${customers.length} opening credit invoices (total debt ${totalDebt.toFixed(2)} USD)`,
		)
	} catch (error) {
		console.error('Error creating initial customers:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
		console.log('MongoDB disconnected')
	}
}

createInitialCustomers()
