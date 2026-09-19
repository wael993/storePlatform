import { describe, expect, it } from 'vitest'

import { filterSupplierRelatedActions } from '../apis/mappings/mapper'
import { DailyActionType } from '../shared/globalEnums'
import type { DailyAction } from '../shared/types/api'

const action = (
	partial: Partial<DailyAction> & Pick<DailyAction, 'actionId' | 'entryType'>,
): DailyAction =>
	({
		currencyId: 'primary',
		currencyName: 'SYP',
		...partial,
	}) as DailyAction

describe('filterSupplierRelatedActions', () => {
	const supplier = {
		supplierId: 'sup-1',
		internalCode: undefined as string | undefined,
	}

	it('keeps only actions for this supplierId', () => {
		const actions = [
			action({
				actionId: 'a1',
				entryType: DailyActionType.BUYING_ENTRY,
				supplierId: 'sup-1',
			}),
			action({
				actionId: 'a2',
				entryType: DailyActionType.BUYING_ENTRY,
				supplierId: 'sup-other',
				supplierName: 'Same Name',
			}),
			action({
				actionId: 'a3',
				entryType: DailyActionType.EXPENSE_ENTRY,
			}),
			action({
				actionId: 'a4',
				entryType: DailyActionType.PAYMENT_ENTRY,
				supplierId: 'sup-1',
			}),
		]

		expect(
			filterSupplierRelatedActions(actions, supplier).map(a => a.actionId),
		).toEqual(['a1', 'a4'])
	})

	it('does not match undefined supplierId when supplier has no internalCode', () => {
		const actions = [
			action({
				actionId: 'orphan',
				entryType: DailyActionType.EXPENSE_ENTRY,
			}),
		]

		expect(filterSupplierRelatedActions(actions, supplier)).toHaveLength(0)
	})

	it('matches legacy internalCode stored as supplierId', () => {
		const actions = [
			action({
				actionId: 'legacy',
				entryType: DailyActionType.BUYING_ENTRY,
				supplierId: 'OLD-CODE',
			}),
		]

		expect(
			filterSupplierRelatedActions(actions, {
				supplierId: 'sup-1',
				internalCode: 'OLD-CODE',
			}),
		).toHaveLength(1)
	})
})
