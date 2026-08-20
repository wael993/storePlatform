export const INVOICE_AI_PROVIDERS = [
	'mock',
	'azure',
	'openai',
	'gemini',
] as const

export type InvoiceAiProviderName = (typeof INVOICE_AI_PROVIDERS)[number]

export type ConfidenceBand = 'high' | 'review' | 'missing'

export interface RawExtractedField<T> {
	value: T | null
	confidence: number | null
	isHandwritten?: boolean
}

export interface RawInvoiceLine {
	name: RawExtractedField<string>
	quantity: RawExtractedField<number>
	unit: RawExtractedField<string>
	unitPrice: RawExtractedField<number>
	barcode?: RawExtractedField<string>
	sku?: RawExtractedField<string>
}

export interface RawInvoiceExtraction {
	supplierName: RawExtractedField<string>
	invoiceNumber: RawExtractedField<string>
	invoiceDate: RawExtractedField<string>
	vat: RawExtractedField<number>
	total: RawExtractedField<number>
	supplierVatId?: RawExtractedField<string>
	items: RawInvoiceLine[]
}

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
	barcode: string | null
	sku: string | null
}

export interface InvoiceAiUsage {
	rankMatchCalls: number
}

export interface ScoredInvoiceExtraction {
	supplierName: ScoredField<string>
	invoiceNumber: ScoredField<string>
	invoiceDate: ScoredField<string>
	vat: ScoredField<number>
	total: ScoredField<number>
	supplierVatId: string | null
	items: ScoredInvoiceLine[]
	supplierMatch?: EntityMatch
	itemMatches?: EntityMatch[]
	aiUsage?: InvoiceAiUsage
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
}

export interface RankMatchCandidate {
	id: string
	fields: Record<string, string | null>
}

export interface RankMatchInput {
	kind: 'product' | 'supplier'
	query: Record<string, string | null>
	candidates: RankMatchCandidate[]
}

export interface RankMatchHit {
	id: string
	confidence: number
}

export interface InvoiceDocumentInput {
	bytes: Buffer
	mimeType: string
	fileName?: string
}

export interface InvoiceAiProvider {
	extract(input: InvoiceDocumentInput): Promise<RawInvoiceExtraction>
	rankMatch(input: RankMatchInput): Promise<RankMatchHit[]>
}
