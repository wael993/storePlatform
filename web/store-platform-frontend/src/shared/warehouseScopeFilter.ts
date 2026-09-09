export const filterByAllowedProductIds = <T extends { productId?: string }>(
	products: T[],
	allowedIds: string[] | null,
): T[] => {
	if (allowedIds == null) return products

	const allowed = new Set(allowedIds)
	return products.filter(product => {
		const productId = product.productId
		return productId ? allowed.has(productId) : false
	})
}
