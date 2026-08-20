export type InvoiceImportStatus =
	| 'processing'
	| 'review_required'
	| 'ready_for_approval'
	| 'rejected'
	| 'failed'

export type ConfidenceBand = 'high' | 'review' | 'missing'

export interface ScoredField<T> {
	value: T | null
	confidence: number | null
	band: ConfidenceBand
	isHandwritten: boolean
}

export interface ScoredInvoiceLine {
	name: ScoredField<string>
	quantity: ScoredField<number>
	unit: ScoredField<string>
	unitPrice: ScoredField<number>
	barcode?: string | null
	sku?: string | null
}

export type MatchReason =
	| 'barcode'
	| 'sku'
	| 'factoryCode'
	| 'alias'
	| 'name'
	| 'vatId'
	| 'email'
	| 'contains'
	| 'fuzzy'
	| 'ai'
	| 'none'

export interface EntityMatch {
	id: string | null
	name: string | null
	confidence: number | null
	band: ConfidenceBand
	reason: MatchReason
	autoLink: boolean
	invoiceName: string | null
	confirmed?: boolean
}

export interface ScoredInvoiceExtraction {
	supplierName: ScoredField<string>
	invoiceNumber: ScoredField<string>
	invoiceDate: ScoredField<string>
	vat: ScoredField<number>
	total: ScoredField<number>
	supplierVatId?: string | null
	items: ScoredInvoiceLine[]
	supplierMatch?: EntityMatch
	itemMatches?: EntityMatch[]
}

export interface ExtractFieldReview {
	band: ConfidenceBand
	confidence: number | null
	isHandwritten: boolean
	confirmed: boolean
	value?: string | number | null
}

export interface LineExtractReview {
	name: ExtractFieldReview
	quantity: ExtractFieldReview
	unit: ExtractFieldReview
	unitPrice: ExtractFieldReview
}

export interface InvoiceExtractionReview {
	supplierName: ExtractFieldReview
	invoiceNumber: ExtractFieldReview
	invoiceDate: ExtractFieldReview
	vat: ExtractFieldReview
	total: ExtractFieldReview
	lines: Record<string, LineExtractReview>
	supplierMatch?: EntityMatch
	lineMatches?: Record<string, EntityMatch>
}

export const PENDING_PRODUCT_PREFIX = 'pending:'

export const isPendingProductId = (productId: string) =>
	productId.startsWith(PENDING_PRODUCT_PREFIX)

export const reviewFromScored = <T>(
	field: ScoredField<T>,
): ExtractFieldReview => ({
	band: field.band,
	confidence: field.confidence,
	isHandwritten: field.isHandwritten,
	confirmed: field.band === 'high',
	value: field.value as string | number | null,
})

export const confirmReview = (
	review: ExtractFieldReview,
): ExtractFieldReview =>
	review.band === 'missing' ? review : { ...review, confirmed: true }

export const reviewAfterEdit = (
	review: ExtractFieldReview | undefined,
): ExtractFieldReview => ({
	band: 'high',
	confidence: review?.confidence ?? 1,
	isHandwritten: false,
	confirmed: true,
})

export const isReviewBlocking = (review?: ExtractFieldReview) => {
	if (!review) return false
	if (review.confirmed && review.band !== 'missing') return false
	return review.band !== 'high'
}

export const formatConfidencePercent = (confidence: number | null) => {
	if (confidence == null) return null
	return `${Math.round(confidence * 100)}%`
}
