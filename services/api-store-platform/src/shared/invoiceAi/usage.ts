import Tenant, { ITenant, InvoiceAiUsageState } from '../../models/Tenant'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import {
	DEFAULT_INVOICE_AI_MONTHLY_LIMIT,
	MAX_INVOICE_AI_MONTHLY_LIMIT,
} from '../constants/invoiceAi'
import {
	resolveTenantAccessiblePages,
	TENANT_ACCESSIBLE_PAGE,
} from '../constants/tenantAccessiblePages'

type InvoiceAiUsageView = {
	available: number
	monthlyLimit: number
	nextPeriodStartsAt: Date
}

const utcStartOfDay = (date: Date): Date =>
	new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	)

const utcAddMonths = (date: Date, months: number): Date => {
	const year = date.getUTCFullYear()
	const month = date.getUTCMonth()
	const day = date.getUTCDate()
	const lastDay = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate()

	return new Date(Date.UTC(year, month + months, Math.min(day, lastDay)))
}

const periodIndexFromActivation = (activatedAt: Date, at: Date): number => {
	const start = utcStartOfDay(activatedAt)
	let index = 0

	while (utcAddMonths(start, index + 1).getTime() <= at.getTime()) {
		index += 1
	}

	return index
}

const availableOf = (state: InvoiceAiUsageState): number =>
	Math.max(0, state.carryOver + state.monthlyLimit - state.usedInPeriod)

// note: monthlyLimit is live in availableOf, so a Super Admin change applies to the current period immediately. Next period uses the same stored limit.

export const parseInvoiceAiMonthlyLimit = (value: unknown): number => {
	const parsed =
		typeof value === 'number'
			? value
			: typeof value === 'string'
				? Number(value)
				: NaN

	if (
		!Number.isInteger(parsed) ||
		parsed < 1 ||
		parsed > MAX_INVOICE_AI_MONTHLY_LIMIT
	) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Invoice AI monthly limit must be a whole number between 1 and ' +
				String(MAX_INVOICE_AI_MONTHLY_LIMIT) +
				'.',
		)
	}

	return parsed
}

export const newInvoiceAiUsage = (
	monthlyLimit: number,
	now: Date,
): InvoiceAiUsageState => {
	const activatedAt = utcStartOfDay(now)

	return {
		monthlyLimit,
		activatedAt,
		periodStart: activatedAt,
		usedInPeriod: 0,
		carryOver: 0,
	}
}

const hydrateInvoiceAiUsage = (
	stored: InvoiceAiUsageState | undefined,
	now: Date,
): InvoiceAiUsageState => {
	if (!stored?.activatedAt) {
		const limit = stored?.monthlyLimit

		return newInvoiceAiUsage(
			limit != null && limit >= 1 ? limit : DEFAULT_INVOICE_AI_MONTHLY_LIMIT,
			now,
		)
	}

	return {
		monthlyLimit:
			stored.monthlyLimit >= 1
				? stored.monthlyLimit
				: DEFAULT_INVOICE_AI_MONTHLY_LIMIT,
		activatedAt: utcStartOfDay(stored.activatedAt),
		periodStart: utcStartOfDay(stored.periodStart ?? stored.activatedAt),
		usedInPeriod: stored.usedInPeriod || 0,
		carryOver: stored.carryOver || 0,
	}
}

const rollInvoiceAiState = (
	state: InvoiceAiUsageState,
	now: Date,
): InvoiceAiUsageState => {
	const start = utcStartOfDay(state.activatedAt)
	const indexNow = periodIndexFromActivation(start, now)
	const indexStart = periodIndexFromActivation(start, state.periodStart)
	const skipped = indexNow - indexStart

	if (skipped <= 0) {
		return state
	}

	return {
		...state,
		carryOver: availableOf(state) + (skipped - 1) * state.monthlyLimit,
		usedInPeriod: 0,
		periodStart: utcAddMonths(start, indexNow),
	}
}

const toInvoiceAiUsageView = (
	state: InvoiceAiUsageState,
	now: Date,
): InvoiceAiUsageView => {
	const start = utcStartOfDay(state.activatedAt)
	const nextPeriodStartsAt = utcAddMonths(
		start,
		periodIndexFromActivation(start, now) + 1,
	)

	return {
		available: availableOf(state),
		monthlyLimit: state.monthlyLimit,
		nextPeriodStartsAt,
	}
}

const usageUnchanged = (
	before: InvoiceAiUsageState | undefined,
	after: InvoiceAiUsageState,
): boolean =>
	Boolean(
		before &&
		before.monthlyLimit === after.monthlyLimit &&
		utcStartOfDay(before.activatedAt).getTime() ===
			utcStartOfDay(after.activatedAt).getTime() &&
		utcStartOfDay(before.periodStart).getTime() ===
			utcStartOfDay(after.periodStart).getTime() &&
		before.usedInPeriod === after.usedInPeriod &&
		before.carryOver === after.carryOver,
	)

const requireTenant = async (tenantId: string): Promise<ITenant> => {
	const tenant = await Tenant.findOne({ tenantId }).lean<ITenant | null>()

	if (!tenant) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_READ_ERROR,
			'Tenant not found.',
		)
	}

	return tenant
}

const remainingExpr = {
	$subtract: [
		{ $add: ['$invoiceAi.carryOver', '$invoiceAi.monthlyLimit'] },
		'$invoiceAi.usedInPeriod',
	],
}

const throwLimitReached = async (
	tenantId: string,
	now: Date,
): Promise<never> => {
	const usage = await getInvoiceAiUsage(tenantId, now)

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.INVOICE_AI_LIMIT_REACHED,
		`You have used all available Invoice AI invoices. Your next allowance will be available on ${usage.nextPeriodStartsAt.toISOString().slice(0, 10)}.`,
	)
}

export const persistRolledInvoiceAiUsage = async (
	tenantId: string,
	now = new Date(),
): Promise<InvoiceAiUsageState> => {
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const tenant = await requireTenant(tenantId)

		if (!tenant.invoiceAi?.activatedAt) {
			const initial = hydrateInvoiceAiUsage(tenant.invoiceAi, now)
			const created = await Tenant.findOneAndUpdate(
				{
					tenantId,
					$or: [
						{ invoiceAi: { $exists: false } },
						{ 'invoiceAi.activatedAt': { $exists: false } },
					],
				},
				{ $set: { invoiceAi: initial } },
				{ new: true, runValidators: true },
			).lean<ITenant | null>()

			if (created?.invoiceAi?.activatedAt) {
				return created.invoiceAi
			}

			continue
		}

		const rolled = rollInvoiceAiState(
			hydrateInvoiceAiUsage(tenant.invoiceAi, now),
			now,
		)

		if (usageUnchanged(tenant.invoiceAi, rolled)) {
			return rolled
		}

		const result = await Tenant.updateOne(
			{
				tenantId,
				'invoiceAi.periodStart': tenant.invoiceAi.periodStart,
				'invoiceAi.usedInPeriod': tenant.invoiceAi.usedInPeriod,
				'invoiceAi.carryOver': tenant.invoiceAi.carryOver,
				'invoiceAi.monthlyLimit': tenant.invoiceAi.monthlyLimit,
			},
			{
				$set: {
					'invoiceAi.periodStart': rolled.periodStart,
					'invoiceAi.carryOver': rolled.carryOver,
					'invoiceAi.usedInPeriod': rolled.usedInPeriod,
				},
			},
		)

		if (result.modifiedCount === 1) {
			return rolled
		}
	}

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		'Could not update Invoice AI usage period.',
	)
}

export const getInvoiceAiUsage = async (
	tenantId: string,
	now = new Date(),
): Promise<InvoiceAiUsageView> => {
	const rolled = await persistRolledInvoiceAiUsage(tenantId, now)

	return toInvoiceAiUsageView(rolled, now)
}

export const reserveInvoiceAiCredit = async (
	tenantId: string,
	now = new Date(),
): Promise<InvoiceAiUsageState> => {
	await persistRolledInvoiceAiUsage(tenantId, now)

	const updated = await Tenant.findOneAndUpdate(
		{
			tenantId,
			$expr: { $gt: [remainingExpr, 0] },
		},
		{ $inc: { 'invoiceAi.usedInPeriod': 1 } },
		{ new: true },
	).lean<ITenant | null>()

	if (!updated?.invoiceAi) {
		return throwLimitReached(tenantId, now)
	}

	return updated.invoiceAi
}

export const refundInvoiceAiCredit = async (
	tenantId: string,
	periodStart: Date,
): Promise<void> => {
	const samePeriod = await Tenant.updateOne(
		{
			tenantId,
			'invoiceAi.periodStart': periodStart,
			'invoiceAi.usedInPeriod': { $gt: 0 },
		},
		{ $inc: { 'invoiceAi.usedInPeriod': -1 } },
	)

	if (samePeriod.modifiedCount === 1) {
		return
	}

	await Tenant.updateOne(
		{
			tenantId,
			'invoiceAi.periodStart': { $ne: periodStart },
		},
		{ $inc: { 'invoiceAi.carryOver': 1 } },
	)
}

export const tenantHasInvoiceAi = (
	tenant: Pick<ITenant, 'accessiblePages'>,
): boolean =>
	resolveTenantAccessiblePages(tenant).includes(
		TENANT_ACCESSIBLE_PAGE.INVOICE_AI,
	)
