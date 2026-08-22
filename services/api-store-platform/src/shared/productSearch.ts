export const MIN_NAME_TOKEN_LENGTH = 2
// Keep in sync with web/store-platform-frontend/src/components/SellingInvoice/productSearch.ts

export const normalizeSearchQuery = (query: string): string =>
	query.replace(/[\r\n\t]+/g, '').trim()

export type SearchableProduct = {
	name?: string
	latinName?: string
	barcode?: string
	internalCode?: string
	productFactoryCode?: string
	productId?: string
}

const getProductNameWords = (name: string): string[] =>
	name.trim().split(/\s+/).filter(Boolean)

const productNameMatchesToken = (name: string, token: string): boolean => {
	const lowerToken = token.toLowerCase()

	return getProductNameWords(name).some(word =>
		word.toLowerCase().includes(lowerToken),
	)
}

const getSearchableNames = (product: SearchableProduct): string[] =>
	[product.name, product.latinName].filter(Boolean) as string[]

const getSearchableCodes = (product: SearchableProduct): string[] =>
	[
		product.barcode,
		product.internalCode,
		product.productFactoryCode,
		product.productId,
	].filter(Boolean) as string[]

export const productMatchesCode = (
	product: SearchableProduct,
	query: string,
): boolean => {
	const normalizedQuery = normalizeSearchQuery(query).toLowerCase()

	return getSearchableCodes(product).some(
		code => normalizeSearchQuery(code).toLowerCase() === normalizedQuery,
	)
}

const productMatchesCodePartial = (
	product: SearchableProduct,
	query: string,
): boolean => {
	const normalizedQuery = normalizeSearchQuery(query).toLowerCase()

	return getSearchableCodes(product).some(code =>
		normalizeSearchQuery(code).toLowerCase().includes(normalizedQuery),
	)
}

export const productMatchesNameTokens = (
	product: SearchableProduct,
	tokens: string[],
): boolean =>
	tokens.every(token =>
		getSearchableNames(product).some(name =>
			productNameMatchesToken(name, token),
		),
	)

export const searchProducts = <T extends SearchableProduct>(
	products: T[],
	query: string,
	limit = products.length,
): T[] => {
	const trimmed = normalizeSearchQuery(query)

	if (!trimmed) return []

	const tokens = trimmed.split(/\s+/).filter(Boolean)

	if (tokens.length === 1) {
		const token = tokens[0]
		const exactCodeMatches = products.filter(product =>
			productMatchesCode(product, token),
		)

		if (exactCodeMatches.length > 0) {
			return exactCodeMatches.slice(0, limit)
		}

		if (token.length >= MIN_NAME_TOKEN_LENGTH) {
			return products
				.filter(
					product =>
						productMatchesNameTokens(product, [token]) ||
						productMatchesCodePartial(product, token),
				)
				.slice(0, limit)
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
