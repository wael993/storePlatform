import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store/store', () => ({
	default: {
		getState: () => ({
			frontendResources: { see: ['products.buyingPrice'] },
		}),
	},
}))

import { offlineDb, setSyncMeta, SYNC_META_KEYS } from '../offline/db'
import {
	applyLocalInventoryMutation,
	applyLocalProductMutation,
	applyOnlineProductCatalogEdit,
} from '../offline/localProductInventoryMutations'
import { setWarehouseScopeIds } from '../shared/warehouseScope'

const tenantId = 'tenant-1'
const warehouseId = 'wh-1'

const outbox = (payload: Record<string, unknown>, url = 'products/coke') => ({
	entity: 'product' as const,
	operation: 'update' as const,
	url,
	method: 'PATCH',
	payload,
	clientMutationId: 'mut-1',
})

describe('offline product/inventory Dexie transactions', () => {
	beforeEach(async () => {
		await offlineDb.delete()
		await offlineDb.open()
		await setSyncMeta(SYNC_META_KEYS.sessionTenantId, tenantId)
		setWarehouseScopeIds([warehouseId])
	})

	it('commits product create, catalog, and outbox in one transaction', async () => {
		await applyLocalProductMutation(
			'POST',
			'products',
			{
				productId: 'coke',
				name: 'Coca Cola',
				price: { retailPrice: 15, purchasePrice: 10, currency: 'USD' },
				quantity: 10,
				warehouseId,
			},
			{
				entity: 'product',
				operation: 'create',
				url: 'products',
				method: 'POST',
				payload: { productId: 'coke', name: 'Coca Cola' },
				clientMutationId: 'create-1',
			},
		)

		const product = await offlineDb.products.get('coke')
		const catalog = await offlineDb.catalogProducts.get('coke')
		const inventory = await offlineDb.inventory
			.where('productId')
			.equals('coke')
			.toArray()
		const pending = await offlineDb.outbox.toArray()

		expect(product?.name).toBe('Coca Cola')
		expect(catalog?.price.purchasePrice).toBe(10)
		expect(catalog?.averageCost).toBe(10)
		expect(inventory[0]?.quantity).toBe(10)
		expect(inventory[0]?.availableQuantity).toBe(10)
		expect(pending).toHaveLength(1)
		expect(pending[0].clientMutationId).toBe('create-1')
	})

	it('seeds opening averageCost in primary currency from catalog FX', async () => {
		await setSyncMeta(
			SYNC_META_KEYS.currencySettings,
			JSON.stringify({
				primaryCurrency: {
					currencyId: 'syp',
					name: 'Syrian Pound',
					internalCode: 'SYP',
				},
				secondaryCurrencies: [
					{
						currencyId: 'usd',
						name: 'US Dollar',
						internalCode: 'USD',
						exchangeRate: 1 / 132,
					},
				],
			}),
		)

		await applyLocalProductMutation('POST', 'products', {
			productId: 'a',
			name: 'A',
			price: { retailPrice: 30, purchasePrice: 20, currency: 'USD' },
			quantity: 1,
			warehouseId,
		})
		await applyLocalProductMutation('POST', 'products', {
			productId: 'b',
			name: 'B',
			price: { retailPrice: 500, purchasePrice: 360, currency: 'SYP' },
			quantity: 1,
			warehouseId,
		})

		const invA = await offlineDb.inventory
			.where('productId')
			.equals('a')
			.first()
		const invB = await offlineDb.inventory
			.where('productId')
			.equals('b')
			.first()

		expect(invA?.averageCost).toBe(2640)
		expect(invB?.averageCost).toBe(360)
	})

	it('keeps catalog cost in lockstep on purchasePrice PATCH', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			price: { retailPrice: 15, purchasePrice: 100, currency: 'USD' },
			quantity: 10,
			warehouseId,
		})

		await applyLocalProductMutation(
			'PATCH',
			'products/coke',
			{ price: { purchasePrice: 10 } },
			outbox({ price: { purchasePrice: 10 } }),
		)

		const product = await offlineDb.products.get('coke')
		const catalog = await offlineDb.catalogProducts.get('coke')
		const inventory = await offlineDb.inventory
			.where('productId')
			.equals('coke')
			.toArray()

		expect(product?.price.purchasePrice).toBe(10)
		expect(product?.price.retailPrice).toBe(15)
		expect(catalog?.price.purchasePrice).toBe(10)
		expect(catalog?.averageCost).toBe(10)
		expect(inventory[0]?.averageCost).toBe(10)
		expect(inventory[0]?.syncStatus).toBe('pending')
		expect(await offlineDb.outbox.count()).toBe(1)
	})

	it('patches name, barcode, and retailPrice without restoring sibling prices', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			barcode: '111',
			price: { retailPrice: 150, purchasePrice: 100, currency: 'USD' },
			quantity: 1,
			warehouseId,
		})

		await applyLocalProductMutation('PATCH', 'products/coke', {
			name: 'Diet Coke',
		})
		await applyLocalProductMutation('PATCH', 'products/coke', {
			barcode: '999',
		})
		await applyLocalProductMutation('PATCH', 'products/coke', {
			price: { retailPrice: 15 },
		})

		const product = await offlineDb.products.get('coke')
		const catalog = await offlineDb.catalogProducts.get('coke')

		expect(product?.name).toBe('Diet Coke')
		expect(product?.barcode).toBe('999')
		expect(product?.price.purchasePrice).toBe(100)
		expect(product?.price.retailPrice).toBe(15)
		expect(catalog?.name).toBe('Diet Coke')
		expect(catalog?.barcode).toBe('999')
		expect(catalog?.price.retailPrice).toBe(15)
	})

	it('does not enqueue outbox when the local product is missing', async () => {
		await expect(
			applyLocalProductMutation(
				'PATCH',
				'products/missing',
				{ name: 'Nope' },
				outbox({ name: 'Nope' }, 'products/missing'),
			),
		).rejects.toThrow('Product not found')

		expect(await offlineDb.outbox.count()).toBe(0)
		expect(await offlineDb.catalogProducts.count()).toBe(0)
	})

	it('does not enqueue outbox when local inventory is missing', async () => {
		await expect(
			applyLocalInventoryMutation(
				'PATCH',
				'inventory/by-product/coke',
				{ warehouseId, quantity: 4 },
				{
					entity: 'inventory',
					operation: 'update',
					url: 'inventory/by-product/coke',
					method: 'PATCH',
					payload: { warehouseId, quantity: 4 },
					clientMutationId: 'inv-1',
				},
			),
		).rejects.toThrow('Inventory not found for product')

		expect(await offlineDb.outbox.count()).toBe(0)
	})

	it('updates inventory availableQuantity with the product mutation', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			price: { retailPrice: 15, purchasePrice: 10, currency: 'USD' },
			quantity: 10,
			warehouseId,
		})

		await applyLocalInventoryMutation(
			'PATCH',
			'inventory/by-product/coke',
			{ warehouseId, quantity: 7 },
			{
				entity: 'inventory',
				operation: 'update',
				url: 'inventory/by-product/coke',
				method: 'PATCH',
				payload: { warehouseId, quantity: 7 },
				clientMutationId: 'inv-2',
			},
		)

		const inventory = await offlineDb.inventory
			.where('productId')
			.equals('coke')
			.toArray()

		expect(inventory[0]?.quantity).toBe(7)
		expect(inventory[0]?.availableQuantity).toBe(7)
		expect(await offlineDb.outbox.count()).toBe(1)
	})

	it('keeps sequential purchasePrice PATCHes ordered in the outbox', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			price: { retailPrice: 15, purchasePrice: 10, currency: 'USD' },
			quantity: 10,
			warehouseId,
		})

		for (const [index, purchasePrice] of [11, 12, 13].entries()) {
			await applyLocalProductMutation(
				'PATCH',
				'products/coke',
				{ price: { purchasePrice } },
				{
					...outbox({ price: { purchasePrice } }),
					clientMutationId: `price-${index}`,
				},
			)
		}

		const pending = await offlineDb.outbox.orderBy('createdAt').toArray()

		expect(
			pending.map(
				entry =>
					(entry.payload as { price: { purchasePrice: number } }).price
						.purchasePrice,
			),
		).toEqual([11, 12, 13])
	})

	it('rebuilds a missing catalog row on product PATCH', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			price: { retailPrice: 15, purchasePrice: 10, currency: 'USD' },
			quantity: 1,
			warehouseId,
		})
		await offlineDb.catalogProducts.delete('coke')

		await applyLocalProductMutation(
			'PATCH',
			'products/coke',
			{ name: 'Diet Coke' },
			outbox({ name: 'Diet Coke' }),
		)

		const catalog = await offlineDb.catalogProducts.get('coke')

		expect(catalog?.name).toBe('Diet Coke')
		expect(catalog?.averageCost).toBe(10)
		expect(await offlineDb.outbox.count()).toBe(1)
	})

	it('rejects names longer than 100 characters', async () => {
		await expect(
			applyLocalProductMutation('POST', 'products', {
				productId: 'coke',
				name: 'n'.repeat(101),
				price: { retailPrice: 15, currency: 'USD' },
			}),
		).rejects.toThrow(/Invalid value for name/)

		expect(await offlineDb.products.count()).toBe(0)
		expect(await offlineDb.outbox.count()).toBe(0)
	})

	it('updates Dexie product and catalog cost on an online purchasePrice edit', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			price: { retailPrice: 15, purchasePrice: 10, currency: 'USD' },
			quantity: 10,
			warehouseId,
		})

		await applyOnlineProductCatalogEdit('coke', {
			price: { purchasePrice: 20 },
		})

		const product = await offlineDb.products.get('coke')
		const catalog = await offlineDb.catalogProducts.get('coke')
		const inventory = await offlineDb.inventory
			.where('productId')
			.equals('coke')
			.toArray()

		expect(product?.price.purchasePrice).toBe(20)
		expect(catalog?.price.purchasePrice).toBe(20)
		expect(catalog?.averageCost).toBe(20)
		expect(inventory[0]?.averageCost).toBe(20)
		expect(await offlineDb.outbox.count()).toBe(0)
	})

	it('keeps stamped invoice unitCost after a later purchasePrice change', async () => {
		await applyLocalProductMutation('POST', 'products', {
			productId: 'coke',
			name: 'Coca Cola',
			price: { retailPrice: 15, purchasePrice: 10, currency: 'USD' },
			quantity: 10,
			warehouseId,
		})

		await offlineDb.invoices.put({
			invoiceId: 'inv-1',
			invoiceNumber: '1',
			status: 'posted',
			warehouseId,
			items: [
				{
					productId: 'coke',
					name: 'Coca Cola',
					quantity: 1,
					unitPrice: 15,
					unitCost: 10,
				},
			],
			syncStatus: 'pending',
			updatedAt: new Date().toISOString(),
		} as never)

		const { handleOfflineQuery } = await import('../offline/localHandlers')

		const firstPatch = await handleOfflineQuery({
			url: 'selling-invoices/inv-1',
			method: 'PATCH',
			body: {
				items: [
					{
						productId: 'coke',
						name: 'Coca Cola',
						quantity: 2,
						unitPrice: 15,
					},
				],
			},
		})

		expect(firstPatch).toHaveProperty('data')

		await applyLocalProductMutation('PATCH', 'products/coke', {
			price: { purchasePrice: 20 },
		})

		const secondPatch = await handleOfflineQuery({
			url: 'selling-invoices/inv-1',
			method: 'PATCH',
			body: {
				items: [
					{
						productId: 'coke',
						name: 'Coca Cola',
						quantity: 2,
						unitPrice: 25,
					},
				],
			},
		})

		expect(secondPatch).toHaveProperty('data')

		const invoice = await offlineDb.invoices.get('inv-1')
		const invoiceOutbox = (await offlineDb.outbox.toArray()).filter(
			entry => entry.entity === 'invoice',
		)

		expect(invoice?.items?.[0]?.unitCost).toBe(10)
		expect(invoice?.items?.[0]?.quantity).toBe(2)
		expect(invoiceOutbox).toHaveLength(2)
	})

	it('fails closed when tenant sync metadata is missing', async () => {
		await offlineDb.syncMeta.clear()

		await expect(
			applyLocalProductMutation('POST', 'products', {
				productId: 'coke',
				name: 'Coca Cola',
				price: { retailPrice: 15, currency: 'USD' },
			}),
		).rejects.toThrow('Offline tenant context is missing')

		expect(await offlineDb.products.count()).toBe(0)
		expect(await offlineDb.outbox.count()).toBe(0)
	})
})
