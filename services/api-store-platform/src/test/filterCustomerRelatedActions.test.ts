import { describe, expect, it } from 'vitest'

import { filterCustomerRelatedActions } from '../apis/mappings/mapper'
import { DailyActionType } from '../shared/globalEnums'
import type { CustomerDailyAction } from '../shared/types/api'

const action = (
	partial: Partial<CustomerDailyAction> &
		Pick<CustomerDailyAction, 'actionId' | 'entryType'>,
): CustomerDailyAction =>
	({
		currencyId: 'primary',
		currencyName: 'SYP',
		...partial,
	}) as CustomerDailyAction

describe('filterCustomerRelatedActions', () => {
	const customer = {
		customerId: 'cust-1',
		internalCode: undefined as string | undefined,
	}

	it('keeps only actions for this customerId', () => {
		const actions = [
			action({
				actionId: 'a1',
				entryType: DailyActionType.SELLING_ENTRY,
				customerId: 'cust-1',
			}),
			action({
				actionId: 'a2',
				entryType: DailyActionType.SELLING_ENTRY,
				customerId: 'cust-other',
				customerName: 'Same Name',
			}),
			action({
				actionId: 'a3',
				entryType: DailyActionType.EXPENSE_ENTRY,
			}),
			action({
				actionId: 'a4',
				entryType: DailyActionType.RECEIPT_ENTRY,
				customerId: 'cust-1',
			}),
		]

		expect(
			filterCustomerRelatedActions(actions, customer).map(a => a.actionId),
		).toEqual(['a1', 'a4'])
	})

	it('does not match undefined customerId when customer has no internalCode', () => {
		const actions = [
			action({
				actionId: 'orphan',
				entryType: DailyActionType.EXPENSE_ENTRY,
			}),
		]

		expect(filterCustomerRelatedActions(actions, customer)).toHaveLength(0)
	})

	it('matches legacy internalCode stored as customerId', () => {
		const actions = [
			action({
				actionId: 'legacy',
				entryType: DailyActionType.SELLING_ENTRY,
				customerId: 'OLD-CODE',
			}),
		]

		expect(
			filterCustomerRelatedActions(actions, {
				customerId: 'cust-1',
				internalCode: 'OLD-CODE',
			}),
		).toHaveLength(1)
	})
})
