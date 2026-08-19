import { InventoryItem, storeApi } from './apiStore'
import { RootState } from '../store/store'

export type CachePatch = { undo: () => void }

type OptimisticDispatch = (
	action: ReturnType<typeof storeApi.util.updateQueryData>,
) => CachePatch

type ProductPatchBody = Partial<Omit<Product, 'id' | 'productId'>>
type InventoryPatchBody = Partial<
	Pick<InventoryItem, 'quantity' | 'minQuantity' | 'averageCost'>
>

const productWrites = new Map<string, Promise<unknown>>()

export const enqueueProductWrite = <T>(
	productId: string,
	run: () => Promise<T>,
): Promise<T> => {
	const chained = Promise.resolve(productWrites.get(productId))
		.catch(() => undefined)
		.then(run)

	productWrites.set(productId, chained)

	return chained.finally(() => {
		if (productWrites.get(productId) === chained) {
			productWrites.delete(productId)
		}
	}) as Promise<T>
}

export const runOptimistic = async (
	patches: CachePatch[],
	queryFulfilled: Promise<unknown>,
) => {
	try {
		await queryFulfilled
	} catch {
		patches.forEach(patch => patch.undo())
	}
}

const assignProductFields = (
	target: { price?: Product['price'] },
	body: ProductPatchBody,
) => {
	const nextPrice = body.price
		? { ...target.price, ...body.price }
		: undefined

	Object.assign(target, body)

	if (nextPrice) {
		target.price = nextPrice as Product['price']
	}
}

const patchProductCaches = (
	dispatch: OptimisticDispatch,
	getState: () => unknown,
	productId: string,
	apply: (product: Product) => void,
): CachePatch[] => {
	const patches: CachePatch[] = []
	const state = getState() as RootState

	for (const args of storeApi.util.selectCachedArgsForQuery(
		state,
		'getProducts',
	)) {
		patches.push(
			dispatch(
				storeApi.util.updateQueryData('getProducts', args, draft => {
					const product = draft.products.find(
						item => item.productId === productId,
					)

					if (product) {
						apply(product)
					}
				}),
			),
		)
	}

	for (const args of storeApi.util.selectCachedArgsForQuery(
		state,
		'getProductNotificationDigest',
	)) {
		patches.push(
			dispatch(
				storeApi.util.updateQueryData(
					'getProductNotificationDigest',
					args,
					draft => {
						const product = draft.products.find(
							item => item.productId === productId,
						)

						if (product) {
							apply(product)
						}
					},
				),
			),
		)
	}

	patches.push(
		dispatch(
			storeApi.util.updateQueryData('getSingleProduct', productId, draft => {
				apply(draft)
			}),
		),
	)

	return patches
}

export const applyOptimisticProductPatch = (
	dispatch: OptimisticDispatch,
	getState: () => unknown,
	id: string,
	body: ProductPatchBody,
): CachePatch[] => {
	const patches = patchProductCaches(dispatch, getState, id, product => {
		assignProductFields(product, body)
	})

	patches.push(
		dispatch(
			storeApi.util.updateQueryData('getProductCatalog', undefined, draft => {
				const product = draft.products.find(item => item.productId === id)

				if (product) {
					assignProductFields(product, body)
				}
			}),
		),
	)

	return patches
}

export const applyOptimisticInventoryPatch = (
	dispatch: OptimisticDispatch,
	getState: () => unknown,
	id: string,
	body: InventoryPatchBody,
): CachePatch[] => {
	const patches = patchProductCaches(dispatch, getState, id, product => {
		if (!product.inventory) {
			return
		}

		Object.assign(product.inventory, body)
	})

	patches.push(
		dispatch(
			storeApi.util.updateQueryData('getInventory', undefined, draft => {
				const item = draft.find(entry => entry.productId === id)

				if (item) {
					Object.assign(item, body)
				}
			}),
		),
	)

	return patches
}
