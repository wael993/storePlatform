import { useCallback, useEffect, useMemo, useState } from 'react'

import type { SellingInvoiceDraft, SellingInvoicePaymentType } from './types'
import {
	createInvoiceDraftSession,
	loadInvoiceDraftSessions,
	saveInvoiceDraftSessions,
	withSyncedInvoiceNumbers,
} from './invoiceDraftSessions'

interface UseInvoiceDraftSessionsOptions {
	nextInvoiceNumber: number
	salesPerson: string
	walkInCustomerName: string
}

export const useInvoiceDraftSessions = ({
	nextInvoiceNumber,
	salesPerson,
	walkInCustomerName,
}: UseInvoiceDraftSessionsOptions) => {
	const [state, setState] = useState(() => loadInvoiceDraftSessions())
	const { sessions, activeSessionId } = state

	useEffect(() => {
		saveInvoiceDraftSessions(state)
	}, [state])

	useEffect(() => {
		setState(current => ({
			...current,
			sessions: withSyncedInvoiceNumbers(current.sessions, nextInvoiceNumber),
		}))
	}, [nextInvoiceNumber])

	const activeSession = useMemo(
		() => sessions.find(session => session.id === activeSessionId) ?? null,
		[sessions, activeSessionId],
	)

	const setActiveSessionId = useCallback((sessionId: string | null) => {
		setState(current => ({ ...current, activeSessionId: sessionId }))
	}, [])

	const createSession = useCallback(
		(options?: {
			paymentType?: SellingInvoicePaymentType
			productSearch?: string
		}) => {
			const session = createInvoiceDraftSession(salesPerson, {
				paymentType: options?.paymentType,
				invoiceNumber: nextInvoiceNumber,
				customerName: walkInCustomerName,
				productSearch: options?.productSearch,
			})

			setState(current => ({
				sessions: [
					...withSyncedInvoiceNumbers(current.sessions, nextInvoiceNumber),
					session,
				],
				activeSessionId: session.id,
			}))
			return session
		},
		[nextInvoiceNumber, salesPerson, walkInCustomerName],
	)

	const updateDraft = useCallback(
		(
			sessionId: string,
			updater:
				| SellingInvoiceDraft
				| ((current: SellingInvoiceDraft) => SellingInvoiceDraft),
		) => {
			setState(current => ({
				...current,
				sessions: current.sessions.map(session => {
					if (session.id !== sessionId) return session
					const nextDraft =
						typeof updater === 'function' ? updater(session.draft) : updater
					return { ...session, draft: nextDraft }
				}),
			}))
		},
		[],
	)

	const setShowNote = useCallback((sessionId: string, showNote: boolean) => {
		setState(current => ({
			...current,
			sessions: current.sessions.map(session =>
				session.id === sessionId ? { ...session, showNote } : session,
			),
		}))
	}, [])

	const clearInitialProductSearch = useCallback((sessionId: string) => {
		setState(current => ({
			...current,
			sessions: current.sessions.map(session =>
				session.id === sessionId
					? { ...session, initialProductSearch: undefined }
					: session,
			),
		}))
	}, [])

	const removeSession = useCallback((sessionId: string) => {
		setState(current => {
			const remaining = current.sessions.filter(
				session => session.id !== sessionId,
			)
			const nextActive =
				current.activeSessionId === sessionId
					? (remaining[remaining.length - 1]?.id ?? null)
					: current.activeSessionId

			return { sessions: remaining, activeSessionId: nextActive }
		})
	}, [])

	const clearAllSessions = useCallback(() => {
		setState({ sessions: [], activeSessionId: null })
	}, [])

	return {
		sessions,
		activeSessionId,
		activeSession,
		setActiveSessionId,
		createSession,
		updateDraft,
		setShowNote,
		clearInitialProductSearch,
		removeSession,
		clearAllSessions,
	}
}
