export const MIN_NAME_TOKEN_LENGTH = 2
export const SEARCH_RESULTS_LIMIT = 80

export const normalizeSearchQuery = (query: string): string =>
	query.replace(/[\r\n\t]+/g, '').trim()

export interface ProductSearchIndexes {
	barcode: Map<string, Product>
	internalCode: Map<string, Product>
	factoryCode: Map<string, Product>
	productId: Map<string, Product>
}

export const createEmptyProductSearchIndexes = (): ProductSearchIndexes => ({
	barcode: new Map(),
	internalCode: new Map(),
	factoryCode: new Map(),
	productId: new Map(),
})

export const buildProductSearchIndexes = (
	products: Product[],
): ProductSearchIndexes => {
	const indexes = createEmptyProductSearchIndexes()

	for (const product of products) {
		if (product.productId) {
			indexes.productId.set(
				normalizeSearchQuery(product.productId).toLowerCase(),
				product,
			)
		}

		if (product.barcode) {
			indexes.barcode.set(
				normalizeSearchQuery(product.barcode).toLowerCase(),
				product,
			)
		}

		if (product.internalCode) {
			indexes.internalCode.set(
				normalizeSearchQuery(product.internalCode).toLowerCase(),
				product,
			)
		}

		if (product.productFactoryCode) {
			indexes.factoryCode.set(
				normalizeSearchQuery(product.productFactoryCode).toLowerCase(),
				product,
			)
		}
	}

	return indexes
}

const getProductNameWords = (name: string): string[] =>
	name.trim().split(/\s+/).filter(Boolean)

const productNameMatchesToken = (name: string, token: string): boolean => {
	const lowerToken = token.toLowerCase()
	return getProductNameWords(name).some(word =>
		word.toLowerCase().startsWith(lowerToken),
	)
}

const getSearchableNames = (product: Product): string[] =>
	[product.name, product.latinName].filter(Boolean) as string[]

const getSearchableCodes = (product: Product): string[] =>
	[
		product.barcode,
		product.internalCode,
		product.productFactoryCode,
		product.productId,
	].filter(Boolean) as string[]

export const productMatchesCode = (
	product: Product,
	query: string,
): boolean => {
	const normalizedQuery = normalizeSearchQuery(query).toLowerCase()
	return getSearchableCodes(product).some(
		code => normalizeSearchQuery(code).toLowerCase() === normalizedQuery,
	)
}

const productMatchesCodePartial = (
	product: Product,
	query: string,
): boolean => {
	const normalizedQuery = normalizeSearchQuery(query).toLowerCase()
	return getSearchableCodes(product).some(code =>
		normalizeSearchQuery(code).toLowerCase().includes(normalizedQuery),
	)
}

const findExactCodeMatches = (
	token: string,
	products: Product[],
	indexes?: ProductSearchIndexes,
): Product[] => {
	const normalizedToken = normalizeSearchQuery(token).toLowerCase()
	if (!normalizedToken) return []

	if (indexes) {
		const indexedMatches = [
			indexes.barcode.get(normalizedToken),
			indexes.internalCode.get(normalizedToken),
			indexes.factoryCode.get(normalizedToken),
			indexes.productId.get(normalizedToken),
		].filter((product): product is Product => Boolean(product))

		if (indexedMatches.length > 0) {
			return [...new Set(indexedMatches)]
		}
	}

	return products.filter(product => productMatchesCode(product, token))
}

export const productMatchesNameTokens = (
	product: Product,
	tokens: string[],
): boolean =>
	tokens.every(token =>
		getSearchableNames(product).some(name =>
			productNameMatchesToken(name, token),
		),
	)

export const hasShortNameTokens = (query: string): boolean => {
	const tokens = normalizeSearchQuery(query).split(/\s+/).filter(Boolean)
	return (
		tokens.length > 1 &&
		tokens.some(token => token.length < MIN_NAME_TOKEN_LENGTH)
	)
}

export const searchProducts = (
	products: Product[],
	query: string,
	limit = SEARCH_RESULTS_LIMIT,
	indexes?: ProductSearchIndexes,
): Product[] => {
	const trimmed = normalizeSearchQuery(query)
	if (!trimmed) return []

	const tokens = trimmed.split(/\s+/).filter(Boolean)

	if (tokens.length === 1) {
		const token = tokens[0]
		const exactCodeMatches = findExactCodeMatches(token, products, indexes)
		if (exactCodeMatches.length > 0) {
			return exactCodeMatches.slice(0, limit)
		}

		if (token.length >= MIN_NAME_TOKEN_LENGTH) {
			const nameMatches = products.filter(
				product =>
					productMatchesNameTokens(product, [token]) ||
					productMatchesCodePartial(product, token),
			)
			return nameMatches.slice(0, limit)
		}

		return products
			.filter(product => productMatchesCodePartial(product, token))
			.slice(0, limit)
	}

	if (tokens.some(token => token.length < MIN_NAME_TOKEN_LENGTH)) {
		return []
	}

	return products
		.filter(product => productMatchesNameTokens(product, tokens))
		.slice(0, limit)
}
