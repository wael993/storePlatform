export const displayProductBarcode = (
	product: Pick<Product, 'productId' | 'barcode'>,
): string => {
	const barcode = product.barcode?.trim() ?? ''

	return !barcode || barcode === product.productId ? '' : barcode
}
