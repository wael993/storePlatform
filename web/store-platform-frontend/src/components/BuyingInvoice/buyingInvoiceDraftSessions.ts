import dayjs from 'dayjs'

import { generateId } from '../../offline/utils'
import type { BuyingInvoiceDraft, BuyingInvoicePaymentType } from './types'

const STORAGE_KEY = 'store-platform:buying-invoice-drafts'

export interface BuyingInvoiceDraftSession {
	id: string
	draft: BuyingInvoiceDraft
	showNote: boolean
	initialProductSearch?: string
}

export interface BuyingInvoiceDraftSessionsState {
	sessions: BuyingInvoiceDraftSession[]
	activeSessionId: string | null
}

export const createBuyingInvoiceDraft = (
	salesPerson: string,
	options?: {
		paymentType?: BuyingInvoicePaymentType
		invoiceNumber?: number
	},
): BuyingInvoiceDraft => ({
	invoiceId: generateId(),
	invoiceNumber: options?.invoiceNumber ?? 1,
	invoiceDate: dayjs().format('YYYY-MM-DD'),
	invoiceTime: dayjs().format('HH:mm'),
	salesPerson,
	supplierId: '',
	supplierName: '',
	paymentType: options?.paymentType ?? 'cash',
	lineItems: [],
	note: '',
	paidAmount: 0,
	useInvoiceDiscount: false,
	invoiceDiscount: 0,
	invoiceDiscountIsPercent: false,
})

export const createBuyingInvoiceDraftSession = (
	salesPerson: string,
	options?: {
		paymentType?: BuyingInvoicePaymentType
		invoiceNumber?: number
		productSearch?: string
	},
): BuyingInvoiceDraftSession => {
	const draft = createBuyingInvoiceDraft(salesPerson, options)
	return {
		id: draft.invoiceId,
		draft,
		showNote: false,
		initialProductSearch: options?.productSearch || undefined,
	}
}

export const isBuyingInvoiceDraftSessionDirty = (
	session: BuyingInvoiceDraftSession,
): boolean =>
	session.draft.lineItems.length > 0 || Boolean(session.draft.note.trim())

const isValidSession = (value: unknown): value is BuyingInvoiceDraftSession => {
	if (!value || typeof value !== 'object') return false
	const session = value as BuyingInvoiceDraftSession
	return (
		typeof session.id === 'string' &&
		session.draft != null &&
		typeof session.draft.invoiceId === 'string' &&
		Array.isArray(session.draft.lineItems)
	)
}

export const loadBuyingInvoiceDraftSessions =
	(): BuyingInvoiceDraftSessionsState => {
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY)
			if (!raw) return { sessions: [], activeSessionId: null }

			const parsed = JSON.parse(raw) as BuyingInvoiceDraftSessionsState
			const sessions = Array.isArray(parsed.sessions)
				? parsed.sessions.filter(isValidSession)
				: []

			if (sessions.length === 0) {
				return { sessions: [], activeSessionId: null }
			}

			const activeSessionId = sessions.some(
				s => s.id === parsed.activeSessionId,
			)
				? parsed.activeSessionId
				: sessions[0].id

			return { sessions, activeSessionId }
		} catch {
			return { sessions: [], activeSessionId: null }
		}
	}

export const saveBuyingInvoiceDraftSessions = (
	state: BuyingInvoiceDraftSessionsState,
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

export const withSyncedBuyingInvoiceNumbers = (
	sessions: BuyingInvoiceDraftSession[],
	invoiceNumber: number,
): BuyingInvoiceDraftSession[] =>
	sessions.map(session =>
		session.draft.invoiceNumber === invoiceNumber
			? session
			: {
					...session,
					draft: { ...session.draft, invoiceNumber },
				},
	)
