import { BusinessLogicError } from '../middleware/errorHandler'
import { loadCashCurrencyRates } from './cashAccounts/posting'
import { ERROR_CODES } from './errorCodes'
import { calculateInvoiceTotals } from './store-domain'

const TOLERANCE = 0.01

type MoneyLine = {
	quantity?: number
	unitPrice?: number
	discount?: number
	discountIsPercent?: boolean
}

type MoneyRow = {
	currencyId?: string
	isPrimary?: boolean
	exchangeRate?: number
	amount?: number
	paidAmount?: number
	remainingAmount?: number
	subtotal?: number
	discount?: number
}

const refuse = (message: string) =>
	new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		message,
	)

const off = (a: unknown, b: number) =>
	typeof a !== 'number' || !Number.isFinite(a) || Math.abs(a - b) > TOLERANCE

/**
 * The money an invoice request claims must follow from its lines and rates
 * (INV-MONEY-1). Totals are recomputed with the web app's own formula, so a
 * correct client always passes. `todayRates` is set for live requests only:
 * a sync replay keeps the rates it was created with.
 */
export const assertInvoiceMoney = (params: {
	items: readonly MoneyLine[]
	currencyAmounts: readonly MoneyRow[]
	invoiceDiscount?: number
	invoiceDiscountIsPercent?: boolean
	todayRates?: ReadonlyMap<string, number>
}) => {
	const rows = params.currencyAmounts
	const primaries = rows.filter(row => row.isPrimary)

	if (primaries.length !== 1) {
		throw refuse('Invoice needs exactly one primary currency amount.')
	}

	for (const row of rows) {
		const rate = row.exchangeRate

		if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
			throw refuse('Invoice exchange rates must be positive numbers.')
		}
	}

	const [primary] = primaries

	if (primary.exchangeRate !== 1) {
		throw refuse('The primary currency rate must be 1.')
	}

	const invoiceDiscount = params.invoiceDiscount ?? 0
	const totals = calculateInvoiceTotals(
		params.items.map(item => ({
			quantity: Number(item.quantity ?? 0),
			unitPrice: Number(item.unitPrice ?? 0),
			discount: Number(item.discount ?? 0),
			discountIsPercent: item.discountIsPercent ?? false,
		})),
		{
			useInvoiceDiscount: invoiceDiscount > 0,
			invoiceDiscount,
			invoiceDiscountIsPercent: params.invoiceDiscountIsPercent ?? false,
		},
	)

	if (
		off(primary.amount, totals.grandTotal) ||
		(primary.subtotal !== undefined &&
			off(primary.subtotal, totals.subtotal)) ||
		(primary.discount !== undefined && off(primary.discount, totals.discount))
	) {
		throw refuse('Invoice totals do not match its lines.')
	}

	const amount = primary.amount as number
	const paid = primary.paidAmount ?? 0

	if (paid < -TOLERANCE || paid > amount + TOLERANCE) {
		throw refuse('Paid amount must be between 0 and the invoice total.')
	}

	if (
		primary.remainingAmount !== undefined &&
		off(paid + primary.remainingAmount, amount)
	) {
		throw refuse('Paid and remaining amounts must add up to the total.')
	}

	for (const row of rows) {
		if (row.isPrimary) continue

		const rate = row.exchangeRate as number

		if (off(row.amount, amount * rate)) {
			throw refuse('Invoice currency amounts do not match the exchange rates.')
		}

		if (params.todayRates) {
			const today = params.todayRates.get(String(row.currencyId ?? ''))

			if (today === undefined || Math.abs(today - rate) > 1e-9) {
				throw refuse(
					'Exchange rates changed. Reload the invoice and save it again.',
				)
			}
		}
	}
}

type InvoiceMoneyFields = {
	items?: readonly MoneyLine[]
	currencyAmounts?: readonly MoneyRow[]
	invoiceDiscount?: number
	invoiceDiscountIsPercent?: boolean
}

/**
 * Create / edit entry point. `stored` is the saved invoice on edit: request
 * fields win, the rest comes from it. Nothing to check when the request leaves
 * the money untouched or lets the server build the amounts from the lines.
 */
export const checkInvoiceRequestMoney = async (params: {
	tenantId: string
	request: InvoiceMoneyFields
	stored?: InvoiceMoneyFields | null
	isSyncReplay: boolean
}) => {
	const { request, stored } = params
	const touchesMoney =
		request.currencyAmounts?.length ||
		request.items?.length ||
		request.invoiceDiscount !== undefined

	if (!touchesMoney) return

	const currencyAmounts = request.currencyAmounts?.length
		? request.currencyAmounts
		: stored?.currencyAmounts

	if (!currencyAmounts?.length) return

	// only amounts sent now must use today's rates; stored ones keep their snapshot
	const todayRates =
		!params.isSyncReplay && request.currencyAmounts?.length
			? new Map(
					(await loadCashCurrencyRates(params.tenantId)).map(rate => [
						rate.currencyId,
						rate.exchangeRate,
					]),
				)
			: undefined

	assertInvoiceMoney({
		items: request.items ?? stored?.items ?? [],
		currencyAmounts,
		invoiceDiscount: request.invoiceDiscount ?? stored?.invoiceDiscount,
		invoiceDiscountIsPercent:
			request.invoiceDiscountIsPercent ?? stored?.invoiceDiscountIsPercent,
		todayRates,
	})
}
