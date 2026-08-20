import { generateId } from '../../offline/utils'
import {
	isPendingProductId,
	PENDING_PRODUCT_PREFIX,
	reviewFromScored,
	type EntityMatch,
	type InvoiceExtractionReview,
	type ScoredInvoiceExtraction,
} from '../../shared/invoiceExtraction'
import type { BuyingInvoiceDraft, BuyingInvoiceLineItem } from './types'

const toView = (
	match: EntityMatch | undefined,
	invoiceName: string | null,
): EntityMatch => ({
	id: match?.id ?? null,
	name: match?.name ?? null,
	confidence: match?.confidence ?? null,
	band: match?.band ?? 'missing',
	reason: match?.reason ?? 'none',
	autoLink: Boolean(match?.autoLink),
	invoiceName: match?.invoiceName ?? invoiceName,
	confirmed: Boolean(match?.autoLink && match.id),
})

export const applyScoredExtraction = (
	draft: BuyingInvoiceDraft,
	extraction: ScoredInvoiceExtraction,
	suppliers: Array<{ supplierId: string; name: string }>,
	products: Product[],
): BuyingInvoiceDraft => {
	const lines: BuyingInvoiceLineItem[] = []
	const lineReviews: InvoiceExtractionReview['lines'] = {}
	const lineMatches: Record<string, EntityMatch> = {}
	const useServerMatches = Array.isArray(extraction.itemMatches)

	extraction.items.forEach((item, index) => {
		if (
			item.name.band === 'missing' &&
			item.quantity.band === 'missing' &&
			item.unitPrice.band === 'missing'
		) {
			return
		}

		const serverMatch = useServerMatches
			? extraction.itemMatches?.[index]
			: undefined
		const linkedId =
			serverMatch?.autoLink && serverMatch.id ? serverMatch.id : undefined
		const catalogProduct = linkedId
			? products.find(product => product.productId === linkedId)
			: undefined
		const id = generateId()
		lines.push({
			id,
			productId: linkedId ?? `${PENDING_PRODUCT_PREFIX}${id}`,
			name:
				catalogProduct?.name ??
				(serverMatch?.autoLink ? serverMatch.name : null) ??
				item.name.value ??
				'',
			barcode: catalogProduct?.barcode ?? item.barcode ?? undefined,
			quantity: item.quantity.value ?? 0,
			unit: item.unit.value ?? catalogProduct?.unitId ?? 'pcs',
			unitPrice: item.unitPrice.value ?? 0,
			discount: 0,
			discountIsPercent: true,
			taxRate: 0,
			imageUrl: catalogProduct?.images?.[0],
			sourceName: item.name.value ?? undefined,
		})
		lineReviews[id] = {
			name: reviewFromScored(item.name),
			quantity: reviewFromScored(item.quantity),
			unit: reviewFromScored(item.unit),
			unitPrice: reviewFromScored(item.unitPrice),
		}
		lineMatches[id] = toView(serverMatch, item.name.value)
	})

	const supplierMatch = extraction.supplierMatch
	const matchedSupplierId =
		supplierMatch?.autoLink && supplierMatch.id ? supplierMatch.id : ''
	const matchedSupplier = suppliers.find(
		supplier => supplier.supplierId === matchedSupplierId,
	)

	return {
		...draft,
		supplierId: matchedSupplierId,
		supplierName: matchedSupplier?.name ?? extraction.supplierName.value ?? '',
		supplierInvoiceNumber: extraction.invoiceNumber.value ?? '',
		sourceSupplierName: extraction.supplierName.value ?? undefined,
		invoiceDate: extraction.invoiceDate.value || draft.invoiceDate,
		lineItems: lines,
		extraction: {
			supplierName: reviewFromScored(extraction.supplierName),
			invoiceNumber: reviewFromScored(extraction.invoiceNumber),
			invoiceDate: reviewFromScored(extraction.invoiceDate),
			vat: reviewFromScored(extraction.vat),
			total: reviewFromScored(extraction.total),
			lines: lineReviews,
			supplierMatch: toView(supplierMatch, extraction.supplierName.value),
			lineMatches,
		},
	}
}

export const draftHasUnresolvedExtraction = (draft: BuyingInvoiceDraft) => {
	const extraction = draft.extraction
	if (!extraction) {
		return draft.lineItems.some(item => isPendingProductId(item.productId))
	}

	const headerBlocked = [extraction.supplierName, extraction.invoiceDate].some(
		field => !field.confirmed && field.band !== 'high',
	)
	const moneyReviewBlocked = [extraction.vat, extraction.total].some(
		field => field.band === 'review' && !field.confirmed,
	)

	const linesBlocked = draft.lineItems.some(item => {
		if (isPendingProductId(item.productId) || item.quantity < 1) return true
		const line = extraction.lines[item.id]
		if (!line) return false
		return [line.name, line.quantity, line.unitPrice].some(
			field => !field.confirmed && field.band !== 'high',
		)
	})

	return headerBlocked || moneyReviewBlocked || linesBlocked
}

export const dropExtractedImport = (
	draft: BuyingInvoiceDraft,
	previousSupplier: { supplierId: string; supplierName: string } | null,
): BuyingInvoiceDraft => {
	if (!draft.extraction) return draft

	const extractedIds = new Set(Object.keys(draft.extraction.lines))

	return {
		...draft,
		extraction: null,
		sourceSupplierName: undefined,
		supplierId: previousSupplier?.supplierId ?? '',
		supplierName: previousSupplier?.supplierName ?? '',
		lineItems: draft.lineItems.filter(item => !extractedIds.has(item.id)),
	}
}
