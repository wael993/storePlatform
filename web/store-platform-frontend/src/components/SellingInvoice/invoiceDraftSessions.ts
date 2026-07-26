import dayjs from 'dayjs'

import { generateId } from '../../offline/utils'
import type { SellingInvoiceDraft, SellingInvoicePaymentType } from './types'

export const WALK_IN_CUSTOMER_ID = 'walk-in'

const STORAGE_KEY = 'store-platform:selling-invoice-drafts'

export interface InvoiceDraftSession {
	id: string
	draft: SellingInvoiceDraft
	showNote: boolean
	initialProductSearch?: string
}

export interface InvoiceDraftSessionsState {
	sessions: InvoiceDraftSession[]
	activeSessionId: string | null
}

export const createInvoiceDraft = (
	salesPerson: string,
	options?: {
		paymentType?: SellingInvoicePaymentType
		invoiceNumber?: number
		customerName?: string
	},
): SellingInvoiceDraft => ({
	invoiceId: generateId(),
	invoiceNumber: options?.invoiceNumber ?? 1,
	invoiceDate: dayjs().format('YYYY-MM-DD'),
	invoiceTime: dayjs().format('HH:mm'),
	salesPerson,
	customerId: WALK_IN_CUSTOMER_ID,
	customerName: options?.customerName ?? 'Walk-in Customer',
	paymentType: options?.paymentType ?? 'cash',
	lineItems: [],
	note: '',
	paidAmount: 0,
	useInvoiceDiscount: false,
	invoiceDiscount: 0,
	invoiceDiscountIsPercent: false,
})

export const createInvoiceDraftSession = (
	salesPerson: string,
	options?: {
		paymentType?: SellingInvoicePaymentType
		invoiceNumber?: number
		customerName?: string
		productSearch?: string
	},
): InvoiceDraftSession => {
	const draft = createInvoiceDraft(salesPerson, options)
	return {
		id: draft.invoiceId,
		draft,
		showNote: false,
		initialProductSearch: options?.productSearch || undefined,
	}
}

export const isDraftSessionDirty = (session: InvoiceDraftSession): boolean =>
	session.draft.lineItems.length > 0 || Boolean(session.draft.note.trim())

const isValidSession = (value: unknown): value is InvoiceDraftSession => {
	if (!value || typeof value !== 'object') return false
	const session = value as InvoiceDraftSession
	return (
		typeof session.id === 'string' &&
		session.draft != null &&
		typeof session.draft.invoiceId === 'string' &&
		Array.isArray(session.draft.lineItems)
	)
}

export const loadInvoiceDraftSessions = (): InvoiceDraftSessionsState => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return { sessions: [], activeSessionId: null }

		const parsed = JSON.parse(raw) as InvoiceDraftSessionsState
		const sessions = Array.isArray(parsed.sessions)
			? parsed.sessions.filter(isValidSession)
			: []

		if (sessions.length === 0) {
			return { sessions: [], activeSessionId: null }
		}

		const activeSessionId = sessions.some(s => s.id === parsed.activeSessionId)
			? parsed.activeSessionId
			: sessions[0].id

		return { sessions, activeSessionId }
	} catch {
		return { sessions: [], activeSessionId: null }
	}
}

export const saveInvoiceDraftSessions = (
	state: InvoiceDraftSessionsState,
): void => {
	try {
		if (state.sessions.length === 0) {
			sessionStorage.removeItem(STORAGE_KEY)
			return
		}
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
	} catch {
		// Ignore quota / private-mode failures; in-memory state still works.
	}
}

export const withSyncedInvoiceNumbers = (
	sessions: InvoiceDraftSession[],
	invoiceNumber: number,
): InvoiceDraftSession[] =>
	sessions.map(session =>
		session.draft.invoiceNumber === invoiceNumber
			? session
			: {
					...session,
					draft: { ...session.draft, invoiceNumber },
				},
	)
