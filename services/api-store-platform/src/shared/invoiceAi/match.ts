import { config } from '../../config/config'
import logger, { EntityType } from '../logger/logger'
import {
	ConfidenceBand,
	EntityMatch,
	MatchReason,
	RankMatchHit,
	RankMatchInput,
	ScoredInvoiceExtraction,
} from './types'

const HIGH = 0.9
const REVIEW = 0.5
const IDENTIFIER = 0.98
const EXACT_NAME = 0.95
const EXACT_ALIAS = 0.97
const CONTAINS = 0.82
const CONTAINS_MIN_LEN = 4
const FUZZY_GAP = 0.12
const CANDIDATE_LIMIT = 8
const RANK_CONCURRENCY = 4

interface CatalogProduct {
	productId: string
	name: string
	latinName?: string
	barcode?: string
	internalCode?: string
	productFactoryCode?: string
	aliases?: string[]
	unitId?: string
	categoryId?: string
	supplierId?: string
}

interface CatalogSupplier {
	supplierId: string
	name: string
	internalCode?: string
	email?: string
	vatId?: string
	aliases?: string[]
}

interface InvoiceProductQuery {
	name: string | null
	barcode?: string | null
	sku?: string | null
	unit?: string | null
}

interface InvoiceSupplierQuery {
	name: string | null
	vatId?: string | null
	email?: string | null
}

type RankMatchFn = (input: RankMatchInput) => Promise<RankMatchHit[]>

const missing = (invoiceName: string | null): EntityMatch => ({
	id: null,
	name: null,
	confidence: null,
	band: 'missing',
	reason: 'none',
	autoLink: false,
	invoiceName,
})

const hit = (
	entity: { id: string; name: string },
	confidence: number,
	reason: MatchReason,
	autoLink: boolean,
	invoiceName: string | null,
): EntityMatch => ({
	id: entity.id,
	name: entity.name,
	confidence,
	band: bandForConfidence(confidence),
	reason,
	autoLink,
	invoiceName,
})

const bandForConfidence = (confidence: number): ConfidenceBand => {
	if (confidence >= HIGH) return 'high'

	if (confidence >= REVIEW) return 'review'

	return 'missing'
}

const normalizeText = (value: string): string =>
	expandPackageSize(value)
		.toLowerCase()
		.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()

const expandPackageSize = (value: string): string =>
	value
		.replace(
			/\b(\d+(?:[.,]\d+)?)\s*(l|ltr|liter|litre|liters|litres)\b/gi,
			(_all, raw: string) =>
				`${Math.round(Number(raw.replace(',', '.')) * 1000)}ml`,
		)
		.replace(
			/\b(\d+(?:[.,]\d+)?)\s*cl\b/gi,
			(_all, raw: string) =>
				`${Math.round(Number(raw.replace(',', '.')) * 10)}ml`,
		)
		.replace(/\b(\d+(?:[.,]\d+)?)\s*ml\b/gi, '$1ml')

const normalizeCode = (value: string): string =>
	value.replace(/[\s-]/g, '').toUpperCase()

const tokens = (value: string): string[] =>
	normalizeText(value)
		.split(' ')
		.filter(token => token.length > 1)

const jaccard = (left: string[], right: string[]): number => {
	if (!left.length || !right.length) return 0

	const rightSet = new Set(right)
	const intersection = left.filter(token => rightSet.has(token)).length
	const union = new Set([...left, ...right]).size

	return union ? intersection / union : 0
}

const uniqueById = <T extends { id: string }>(
	rows: T[],
): T[] | 'conflict' | null => {
	const ids = new Set(rows.map(row => row.id))

	if (ids.size === 0) return null

	if (ids.size > 1) return 'conflict'

	return rows
}

const productNames = (product: CatalogProduct): string[] =>
	[product.name, product.latinName, ...(product.aliases ?? [])].filter(
		(value): value is string => Boolean(value?.trim()),
	)

const supplierNames = (supplier: CatalogSupplier): string[] =>
	[supplier.name, ...(supplier.aliases ?? [])].filter(
		(value): value is string => Boolean(value?.trim()),
	)

const uniqueContains = (needle: string, hay: string) =>
	needle.length >= CONTAINS_MIN_LEN &&
	hay.length >= CONTAINS_MIN_LEN &&
	(hay.includes(needle) || needle.includes(hay))

const uniqueFuzzyHit = (
	invoiceName: string,
	catalog: Array<{ id: string; name: string; names: string[] }>,
): EntityMatch | null => {
	const scored = catalog
		.map(row => ({
			id: row.id,
			name: row.name,
			score: row.names.length
				? Math.max(
						0,
						...row.names.map(name =>
							jaccard(tokens(invoiceName), tokens(name)),
						),
					)
				: 0,
		}))
		.filter(row => row.score >= REVIEW)
		.sort((left, right) => right.score - left.score)

	if (scored[0] && scored[0].score - (scored[1]?.score ?? 0) >= FUZZY_GAP) {
		return hit(
			scored[0],
			Math.min(0.88, scored[0].score),
			'fuzzy',
			false,
			invoiceName,
		)
	}

	return null
}

const skipAiRank = (match: EntityMatch) =>
	match.autoLink || match.reason === 'fuzzy'

const emailDomain = (email: string): string | null => {
	const at = email.trim().toLowerCase().lastIndexOf('@')

	if (at < 1 || at === email.length - 1) return null

	const domain = email.slice(at + 1).trim()

	if (!domain || domain === 'gmail.com' || domain === 'yahoo.com') return null

	return domain
}

const matchProductDeterministic = (
	query: InvoiceProductQuery,
	catalog: CatalogProduct[],
): EntityMatch => {
	const invoiceName = query.name?.trim() || null
	const barcode = query.barcode?.trim() ? normalizeCode(query.barcode) : ''
	const sku = query.sku?.trim() ? normalizeCode(query.sku) : ''

	if (barcode) {
		const rows = catalog
			.filter(
				product =>
					product.barcode && normalizeCode(product.barcode) === barcode,
			)
			.map(product => ({
				id: product.productId,
				name: product.name,
			}))
		const found = uniqueById(rows)

		if (found === 'conflict') return missing(invoiceName)

		if (found) {
			return hit(found[0], IDENTIFIER, 'barcode', true, invoiceName)
		}
	}

	if (sku) {
		const rows = catalog
			.filter(product => {
				const internal = product.internalCode
					? normalizeCode(product.internalCode)
					: ''
				const factory = product.productFactoryCode
					? normalizeCode(product.productFactoryCode)
					: ''

				return internal === sku || factory === sku
			})
			.map(product => ({
				id: product.productId,
				name: product.name,
				reason: (product.internalCode &&
				normalizeCode(product.internalCode) === sku
					? 'sku'
					: 'factoryCode') as MatchReason,
			}))
		const found = uniqueById(rows)

		if (found === 'conflict') return missing(invoiceName)

		if (found) {
			return hit(found[0], IDENTIFIER, found[0].reason, true, invoiceName)
		}
	}

	if (!invoiceName) return missing(invoiceName)

	const needle = normalizeText(invoiceName)

	if (!needle) return missing(invoiceName)

	const aliasHits = catalog
		.filter(product =>
			(product.aliases ?? []).some(alias => normalizeText(alias) === needle),
		)
		.map(product => ({ id: product.productId, name: product.name }))
	const aliasFound = uniqueById(aliasHits)

	if (aliasFound === 'conflict') return missing(invoiceName)

	if (aliasFound) {
		return hit(aliasFound[0], EXACT_ALIAS, 'alias', true, invoiceName)
	}

	const nameHits = catalog
		.filter(product =>
			[product.name, product.latinName].some(
				value => value && normalizeText(value) === needle,
			),
		)
		.map(product => ({ id: product.productId, name: product.name }))
	const nameFound = uniqueById(nameHits)

	if (nameFound === 'conflict') return missing(invoiceName)

	if (nameFound) {
		return hit(nameFound[0], EXACT_NAME, 'name', true, invoiceName)
	}

	const containsHits = catalog
		.filter(product =>
			productNames(product).some(name =>
				uniqueContains(needle, normalizeText(name)),
			),
		)
		.map(product => ({ id: product.productId, name: product.name }))
	const containsFound = uniqueById(containsHits)

	if (containsFound && containsFound !== 'conflict') {
		return hit(containsFound[0], CONTAINS, 'contains', false, invoiceName)
	}

	return (
		uniqueFuzzyHit(
			invoiceName,
			catalog.map(product => ({
				id: product.productId,
				name: product.name,
				names: productNames(product),
			})),
		) ?? missing(invoiceName)
	)
}

const matchSupplierDeterministic = (
	query: InvoiceSupplierQuery,
	catalog: CatalogSupplier[],
): EntityMatch => {
	const invoiceName = query.name?.trim() || null
	const vatId = query.vatId?.trim() ? normalizeCode(query.vatId) : ''
	const email = query.email?.trim().toLowerCase() || ''

	if (vatId) {
		const rows = catalog
			.filter(
				supplier => supplier.vatId && normalizeCode(supplier.vatId) === vatId,
			)
			.map(supplier => ({
				id: supplier.supplierId,
				name: supplier.name,
			}))
		const found = uniqueById(rows)

		if (found === 'conflict') return missing(invoiceName)

		if (found) return hit(found[0], IDENTIFIER, 'vatId', true, invoiceName)
	}

	if (email) {
		const rows = catalog
			.filter(supplier => supplier.email?.trim().toLowerCase() === email)
			.map(supplier => ({
				id: supplier.supplierId,
				name: supplier.name,
			}))
		const found = uniqueById(rows)

		if (found === 'conflict') return missing(invoiceName)

		if (found) return hit(found[0], IDENTIFIER, 'email', true, invoiceName)
	}

	if (query.email) {
		const domain = emailDomain(query.email)

		if (domain) {
			const rows = catalog
				.filter(supplier => {
					const supplierDomain = supplier.email
						? emailDomain(supplier.email)
						: null

					return supplierDomain === domain
				})
				.map(supplier => ({
					id: supplier.supplierId,
					name: supplier.name,
				}))
			const found = uniqueById(rows)

			if (found && found !== 'conflict') {
				return hit(found[0], CONTAINS, 'email', false, invoiceName)
			}
		}
	}

	if (!invoiceName) return missing(invoiceName)

	const needle = normalizeText(invoiceName)

	if (!needle) return missing(invoiceName)

	const aliasHits = catalog
		.filter(supplier =>
			(supplier.aliases ?? []).some(alias => normalizeText(alias) === needle),
		)
		.map(supplier => ({ id: supplier.supplierId, name: supplier.name }))
	const aliasFound = uniqueById(aliasHits)

	if (aliasFound === 'conflict') return missing(invoiceName)

	if (aliasFound) {
		return hit(aliasFound[0], EXACT_ALIAS, 'alias', true, invoiceName)
	}

	const nameHits = catalog
		.filter(supplier => normalizeText(supplier.name) === needle)
		.map(supplier => ({ id: supplier.supplierId, name: supplier.name }))
	const nameFound = uniqueById(nameHits)

	if (nameFound === 'conflict') return missing(invoiceName)

	if (nameFound) {
		return hit(nameFound[0], EXACT_NAME, 'name', true, invoiceName)
	}

	const containsHits = catalog
		.filter(supplier =>
			supplierNames(supplier).some(name =>
				uniqueContains(needle, normalizeText(name)),
			),
		)
		.map(supplier => ({ id: supplier.supplierId, name: supplier.name }))
	const containsFound = uniqueById(containsHits)

	if (containsFound && containsFound !== 'conflict') {
		return hit(containsFound[0], CONTAINS, 'contains', false, invoiceName)
	}

	return (
		uniqueFuzzyHit(
			invoiceName,
			catalog.map(supplier => ({
				id: supplier.supplierId,
				name: supplier.name,
				names: supplierNames(supplier),
			})),
		) ?? missing(invoiceName)
	)
}

const blockProductCandidates = (
	query: InvoiceProductQuery,
	catalog: CatalogProduct[],
	limit = CANDIDATE_LIMIT,
): CatalogProduct[] => {
	const needle = [query.name, query.barcode, query.sku, query.unit]
		.filter((value): value is string => Boolean(value?.trim()))
		.join(' ')
	const queryTokens = tokens(needle)

	if (!queryTokens.length) return []

	return catalog
		.map(product => ({
			product,
			score: Math.max(
				...productNames(product).map(name =>
					jaccard(queryTokens, tokens(name)),
				),
				query.barcode &&
					product.barcode &&
					normalizeCode(product.barcode) === normalizeCode(query.barcode)
					? 1
					: 0,
			),
		}))
		.filter(row => row.score > 0)
		.sort((left, right) => right.score - left.score)
		.slice(0, limit)
		.map(row => row.product)
}

const blockSupplierCandidates = (
	query: InvoiceSupplierQuery,
	catalog: CatalogSupplier[],
	limit = CANDIDATE_LIMIT,
): CatalogSupplier[] => {
	const needle = [query.name, query.vatId, query.email]
		.filter((value): value is string => Boolean(value?.trim()))
		.join(' ')
	const queryTokens = tokens(needle)

	if (!queryTokens.length) return []

	return catalog
		.map(supplier => ({
			supplier,
			score: Math.max(
				...supplierNames(supplier).map(name =>
					jaccard(queryTokens, tokens(name)),
				),
			),
		}))
		.filter(row => row.score > 0)
		.sort((left, right) => right.score - left.score)
		.slice(0, limit)
		.map(row => row.supplier)
}

const withAiRank = async (
	deterministic: EntityMatch,
	invoiceName: string | null,
	input: RankMatchInput,
	namesById: Map<string, string>,
	rankMatch: RankMatchFn,
): Promise<EntityMatch> => {
	if (skipAiRank(deterministic) || !input.candidates.length) {
		return deterministic
	}

	let ranked: RankMatchHit[] = []

	try {
		ranked = await rankMatch(input)
	} catch (error) {
		logger.warn(
			`invoice AI rankMatch failed: ${
				error instanceof Error ? error.message : 'unknown'
			}`,
			{ entity: EntityType.PRODUCTS },
		)

		return deterministic
	}

	const allowed = new Set(input.candidates.map(candidate => candidate.id))
	const eligible = ranked.filter(
		row =>
			allowed.has(row.id) &&
			Number.isFinite(row.confidence) &&
			row.confidence >= REVIEW,
	)
	const best = eligible[0]
	const runnerUp = eligible[1]

	if (!best) return deterministic

	if (runnerUp && best.confidence - runnerUp.confidence < FUZZY_GAP) {
		return deterministic
	}

	if ((deterministic.confidence ?? 0) >= best.confidence) return deterministic

	const name = namesById.get(best.id)

	if (!name) return deterministic

	return hit({ id: best.id, name }, best.confidence, 'ai', false, invoiceName)
}

const matchProduct = async (
	query: InvoiceProductQuery,
	catalog: CatalogProduct[],
	rankMatch: RankMatchFn,
): Promise<EntityMatch> => {
	const deterministic = matchProductDeterministic(query, catalog)

	if (skipAiRank(deterministic)) return deterministic

	const candidates = blockProductCandidates(query, catalog)

	return withAiRank(
		deterministic,
		query.name?.trim() || null,
		{
			kind: 'product',
			query: {
				name: query.name,
				barcode: query.barcode ?? null,
				sku: query.sku ?? null,
				unit: query.unit ?? null,
			},
			candidates: candidates.map(product => ({
				id: product.productId,
				fields: {
					name: product.name,
					latinName: product.latinName ?? null,
					barcode: product.barcode ?? null,
					sku: product.internalCode ?? null,
					factoryCode: product.productFactoryCode ?? null,
					aliases: (product.aliases ?? []).join(', ') || null,
					unit: product.unitId ?? null,
					category: product.categoryId ?? null,
				},
			})),
		},
		new Map(candidates.map(product => [product.productId, product.name])),
		rankMatch,
	)
}

const matchSupplier = async (
	query: InvoiceSupplierQuery,
	catalog: CatalogSupplier[],
	rankMatch: RankMatchFn,
): Promise<EntityMatch> => {
	const deterministic = matchSupplierDeterministic(query, catalog)

	if (skipAiRank(deterministic)) return deterministic

	const candidates = blockSupplierCandidates(query, catalog)

	return withAiRank(
		deterministic,
		query.name?.trim() || null,
		{
			kind: 'supplier',
			query: {
				name: query.name,
				vatId: query.vatId ?? null,
				email: query.email ?? null,
			},
			candidates: candidates.map(supplier => ({
				id: supplier.supplierId,
				fields: {
					name: supplier.name,
					vatId: supplier.vatId ?? null,
					email: supplier.email ?? null,
					internalCode: supplier.internalCode ?? null,
					aliases: (supplier.aliases ?? []).join(', ') || null,
				},
			})),
		},
		new Map(candidates.map(supplier => [supplier.supplierId, supplier.name])),
		rankMatch,
	)
}

export const matchExtractedInvoice = async (
	extraction: ScoredInvoiceExtraction,
	products: CatalogProduct[],
	suppliers: CatalogSupplier[],
	rankMatch: RankMatchFn,
): Promise<ScoredInvoiceExtraction> => {
	let rankMatchCalls = 0
	const countedRankMatch: RankMatchFn = async input => {
		rankMatchCalls += 1

		return rankMatch(input)
	}

	const supplierMatch = await matchSupplier(
		{
			name: extraction.supplierName.value,
			vatId: extraction.supplierVatId,
		},
		suppliers,
		countedRankMatch,
	)
	const itemMatches: EntityMatch[] = []

	for (let i = 0; i < extraction.items.length; i += RANK_CONCURRENCY) {
		const slice = extraction.items.slice(i, i + RANK_CONCURRENCY)

		itemMatches.push(
			...(await Promise.all(
				slice.map(item =>
					matchProduct(
						{
							name: item.name.value,
							barcode: item.barcode,
							sku: item.sku,
							unit: item.unit.value,
						},
						products,
						countedRankMatch,
					),
				),
			)),
		)
	}

	const aiUsage = { rankMatchCalls }

	logger.info(
		`invoice AI usage provider=${config.aiInvoice.provider} rankMatch=${aiUsage.rankMatchCalls} items=${extraction.items.length}`,
	)

	return { ...extraction, supplierMatch, itemMatches, aiUsage }
}
