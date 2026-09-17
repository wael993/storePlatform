import { useCallback, useEffect, useState } from 'react'

import {
	type InsufficientStockItem,
	setInsufficientStockConfirmationHandler,
} from '../../offline/insufficientStockConfirmation'

interface PendingConfirmation {
	items: InsufficientStockItem[]
	resolve: (confirmed: boolean) => void
}

export const useInsufficientStockConfirmation = () => {
	const [pending, setPending] = useState<PendingConfirmation | null>(null)

	useEffect(() => {
		setInsufficientStockConfirmationHandler(
			items =>
				new Promise<boolean>(resolve => {
					setPending({ items, resolve })
				}),
		)

		return () => setInsufficientStockConfirmationHandler(null)
	}, [])

	const cancel = useCallback(() => {
		pending?.resolve(false)
		setPending(null)
	}, [pending])

	return {
		isOpen: pending !== null,
		items: pending?.items ?? [],
		cancel,
	}
}
