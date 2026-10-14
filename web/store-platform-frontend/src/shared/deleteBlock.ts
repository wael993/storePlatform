import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getIsOnline, subscribeConnectivity } from '../offline/connectivity'

const DELETE_BLOCK_REASONS = new Set([
	'invoice',
	'buyingInvoice',
	'project',
	'stockMoving',
	'dailyAction',
	'products',
	'primaryCurrency',
	'cashLedger',
	'employee',
	'offline',
])

type Translate = (key: string) => string

export const translateDeleteBlock = (t: Translate, reason?: string | null) => {
	if (reason && DELETE_BLOCK_REASONS.has(reason)) {
		return t(`deleteBlock.${reason}`)
	}

	return reason || t('deleteBlock.unknown')
}

export const deleteErrorDescription = (
	t: Translate,
	message: string | undefined,
	fallback: string,
) => {
	if (message && DELETE_BLOCK_REASONS.has(message)) {
		return translateDeleteBlock(t, message)
	}

	return message || fallback
}

type DeletableRow = {
	isDeletable?: boolean
	deleteBlockReason?: string | null
}

const useDeleteConnection = () => {
	const { t } = useTranslation()
	const [isOnline, setIsOnline] = useState(getIsOnline)

	useEffect(() => subscribeConnectivity(setIsOnline), [])

	return {
		t,
		offline: !isOnline,
	}
}

export const useMasterDelete = (row?: DeletableRow) => {
	const { t, offline } = useDeleteConnection()
	const blocked = !offline && row?.isDeletable !== true

	return {
		deleteDisabled: offline || blocked,
		deleteTooltip: offline
			? t('deleteBlock.offline')
			: blocked
				? translateDeleteBlock(t, row?.deleteBlockReason)
				: undefined,
	}
}

export const useMasterBulkDelete = (rows: DeletableRow[]) => {
	const { t, offline } = useDeleteConnection()
	const blocked = rows.find(row => row.isDeletable !== true)

	return {
		deleteDisabled: offline || rows.length === 0 || Boolean(blocked),
		deleteTooltip: offline
			? t('deleteBlock.offline')
			: blocked
				? translateDeleteBlock(t, blocked.deleteBlockReason)
				: undefined,
	}
}
