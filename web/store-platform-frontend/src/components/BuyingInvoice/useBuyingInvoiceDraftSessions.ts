import { useCallback, useEffect, useMemo, useState } from 'react'

import type { BuyingInvoiceDraft, BuyingInvoicePaymentType } from './types'
import {
	createBuyingInvoiceDraftSession,
	loadBuyingInvoiceDraftSessions,
	saveBuyingInvoiceDraftSessions,
	withSyncedBuyingInvoiceNumbers,
} from './buyingInvoiceDraftSessions'

interface UseBuyingInvoiceDraftSessionsOptions {
	nextInvoiceNumber: number
}

export const useBuyingInvoiceDraftSessions = ({
	nextInvoiceNumber,
}: UseBuyingInvoiceDraftSessionsOptions) => {
	const [state, setState] = useState(() => loadBuyingInvoiceDraftSessions())
	const { sessions, activeSessionId } = state

	useEffect(() => {
		saveBuyingInvoiceDraftSessions(state)
	}, [state])

	useEffect(() => {
		setState(current => ({
			...current,
			sessions: withSyncedBuyingInvoiceNumbers(
				current.sessions,
				nextInvoiceNumber,
			),
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
			paymentType?: BuyingInvoicePaymentType
			productSearch?: string
		}) => {
			const session = createBuyingInvoiceDraftSession({
				paymentType: options?.paymentType,
				invoiceNumber: nextInvoiceNumber,
				productSearch: options?.productSearch,
			})

			setState(current => ({
				sessions: [
					...withSyncedBuyingInvoiceNumbers(current.sessions, nextInvoiceNumber),
					session,
				],
				activeSessionId: session.id,
			}))
			return session
		},
		[nextInvoiceNumber],
	)

	const updateDraft = useCallback(
		(
			sessionId: string,
			updater:
				| BuyingInvoiceDraft
				| ((current: BuyingInvoiceDraft) => BuyingInvoiceDraft),
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
	}
}
