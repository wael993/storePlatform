export const MAX_PRODUCT_BARCODES = 10

export type ProductBarcodeFields = {
	productId: string
	barcode?: string | null
	additionalBarcodes?: string[] | null
}

export const barcodeCompareKey = (value: string): string =>
	value.trim().toLowerCase()

export const displayProductBarcode = (
	product: Pick<Product, 'productId' | 'barcode'>,
): string => {
	const barcode = product.barcode?.trim() ?? ''

	return !barcode || barcode === product.productId ? '' : barcode
}

export const resolvedProductBarcode = (
	productId: string,
	barcode?: string | null,
): string => {
	const value = barcode?.trim() ?? ''

	return !value || value === productId ? '' : value
}

/** Unique barcodes in display order: primary first, then additional. */
export const allBarcodes = (product: ProductBarcodeFields): string[] => {
	const values = [product.barcode, ...(product.additionalBarcodes ?? [])]
	const out: string[] = []
	const seen = new Set<string>()

	for (const raw of values) {
		const value = resolvedProductBarcode(product.productId, raw)

		if (!value) continue

		const key = barcodeCompareKey(value)

		if (seen.has(key)) continue

		seen.add(key)
		out.push(value)

		if (out.length >= MAX_PRODUCT_BARCODES) break
	}

	return out
}

export const normalizeProductBarcodes = (
	productId: string,
	barcode?: string | null,
	additionalBarcodes?: string[] | null,
): { barcode?: string; additionalBarcodes: string[] } => {
	const values = [barcode, ...(additionalBarcodes ?? [])]
	const unique: string[] = []
	const seen = new Set<string>()

	for (const raw of values) {
		const value = resolvedProductBarcode(productId, raw)

		if (!value) continue

		const key = barcodeCompareKey(value)

		if (seen.has(key)) continue

		seen.add(key)
		unique.push(value)
	}

	if (unique.length > MAX_PRODUCT_BARCODES) {
		throw new Error(
			`A product can have at most ${MAX_PRODUCT_BARCODES} barcodes.`,
		)
	}

	return {
		barcode: unique[0],
		additionalBarcodes: unique.slice(1),
	}
}

export const barcodeSetsEqual = (
	productId: string,
	a: {
		barcode?: string | null
		additionalBarcodes?: string[] | null
	},
	b: {
		barcode?: string | null
		additionalBarcodes?: string[] | null
	},
): boolean => {
	const left = allBarcodes({ productId, ...a })
		.map(barcodeCompareKey)
		.sort()
	const right = allBarcodes({ productId, ...b })
		.map(barcodeCompareKey)
		.sort()

	if (left.length !== right.length) return false

	return left.every((key, index) => key === right[index])
}
