import { pgFind, pgFindOne, pgFindOneAndUpdate } from '../db/mongoQuery'
import { closeDb } from '../db'
import { insertDoc, insertDocs } from '../db/docs'
import { v4 as uuidv4 } from 'uuid'
import { Supplier } from '../models/Supplier'
import { Currency } from '../models/Currency'
import { BuyingInvoice } from '../models/BuyingInvoices'
import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../shared/globalEnums'
import { Product } from '../models/Products'
import { Unit } from '../models/Unit'
import Tenant from '../models/Tenant'
import { INITIAL_SUPPLIERS_DATA } from './initial-suppliers-data'

const TENANT_ID = 'zobani-car'
const OPENING_PRODUCT_NAME = 'رصيد افتتاحي'
const OPENING_PRODUCT_ID = `${TENANT_ID}-opening-balance-product`
const OPENING_NOTE = 'رصيد افتتاحي'
const ISSUED_AT = new Date('2026-07-01T00:00:00.000Z')
const DEFAULT_UNIT_NAME = 'قطعة'
const SEED_USER = {
	_id: 'seed-script',
	displayName: 'Seed Script',
	createdAt: new Date(),
}

async function resolveUsdCurrency() {
	const currencies = await pgFind(Currency, TENANT_ID, {})
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
	const existing = await pgFindOne(Unit, TENANT_ID, { name: DEFAULT_UNIT_NAME })

	if (existing) {
		return existing.unitId
	}

	const unitId = uuidv4()

	await insertDoc(Unit, {
		tenantId: TENANT_ID,
		unitId,
		name: DEFAULT_UNIT_NAME,
		internalCode: DEFAULT_UNIT_NAME.toUpperCase(),
		createdBy: SEED_USER,
	})

	return unitId
}

async function ensureOpeningProduct(unitId: string) {
	await pgFindOneAndUpdate(
		Product,
		TENANT_ID,
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

async function createInitialSuppliers() {
	try {
		const tenant = await pgFindOne(Tenant, TENANT_ID)

		if (!tenant) {
			throw new Error(`Tenant "${TENANT_ID}" was not found`)
		}

		const usd = await resolveUsdCurrency()
		const unitId = await resolvePieceUnitId()
		const openingProductId = await ensureOpeningProduct(unitId)

		const suppliers = INITIAL_SUPPLIERS_DATA.map((supplier, index) => {
			const n = index + 1

			return {
				tenantId: TENANT_ID,
				supplierId: `${TENANT_ID}-supplier-${n}`,
				internalCode: supplier.internalCode,
				name: supplier.name,
				...(supplier.phone && { phone: supplier.phone }),
				createdBy: SEED_USER,
			}
		})

		await insertDocs(Supplier, suppliers)

		const payableRows = INITIAL_SUPPLIERS_DATA.map((row, index) => ({
			row,
			supplier: suppliers[index],
			n: index + 1,
		})).filter(({ row }) => row.direction === 'payable')

		await insertDocs(
			BuyingInvoice,
			payableRows.map(({ row, supplier, n }) => {
				const amount = Number(row.amount.toFixed(2))

				return {
					tenantId: TENANT_ID,
					buyingInvoiceId: `${TENANT_ID}-opening-BI-${n}`,
					invoiceNumber: `BI-OPEN-${String(n).padStart(3, '0')}`,
					supplierId: supplier.supplierId,
					supplierName: supplier.name,
					paymentType: InvoicePaymentType.CREDIT,
					status: InvoiceStatus.CONFIRMED,
					paymentStatus: InvoicePaymentStatus.UNPAID,
					items: [
						{
							productId: openingProductId,
							name: OPENING_PRODUCT_NAME,
							quantity: 1,
							unit: DEFAULT_UNIT_NAME,
							unitPrice: amount,
							discount: 0,
							discountIsPercent: true,
							taxRate: 0,
							lineTotal: amount,
						},
					],
					currencyAmounts: [
						{
							currencyId: usd.currencyId,
							name: usd.name,
							internalCode: usd.internalCode || 'USD',
							exchangeRate: 1,
							isPrimary: true,
							amount,
							paidAmount: 0,
							remainingAmount: amount,
							subtotal: amount,
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

		const totalPayable = payableRows.reduce(
			(sum, { row }) => sum + row.amount,
			0,
		)
		const receivableCount = INITIAL_SUPPLIERS_DATA.filter(
			row => row.direction === 'receivable',
		).length

		console.log(
			`Seeded ${suppliers.length} suppliers and ${payableRows.length} opening credit buying invoices (total payable ${totalPayable.toFixed(2)} USD; ${receivableCount} receivable-only with no invoice)`,
		)
	} catch (error) {
		console.error('Error creating initial suppliers:', error)
		process.exit(1)
	} finally {
		await closeDb()
		console.log('MongoDB disconnected')
	}
}

createInitialSuppliers()
