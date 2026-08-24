import { describe, expect, it } from 'vitest'

import { AllowedActions } from '../shared/globalEnums'
import { isActionAllowed } from '../shared/hooks/useResources'
import { SEE } from '../shared/seeFlags'

const canSee = (allowed: string[]) => {
	const set = new Set(allowed)
	return (id: string) => set.has(id)
}

describe('isActionAllowed', () => {
	it('allows a mapped action when the see id is present', () => {
		expect(
			isActionAllowed(AllowedActions.ADD_PRODUCT, canSee([SEE.productsAdd])),
		).toBe(true)
	})

	it('blocks a mapped action when the see id is missing', () => {
		expect(isActionAllowed(AllowedActions.ADD_PRODUCT, canSee([]))).toBe(false)
	})

	it('blocks an unmapped action', () => {
		expect(isActionAllowed(AllowedActions.SEE_STOCK_QUANTITY, canSee([]))).toBe(
			false,
		)
	})

	it('maps customer and partner delete to *.delete see ids', () => {
		expect(
			isActionAllowed(
				AllowedActions.CAN_DELETE_CUSTOMER,
				canSee([SEE.customersDelete]),
			),
		).toBe(true)
		expect(
			isActionAllowed(
				AllowedActions.CAN_DELETE_PARTNER,
				canSee([SEE.partnersDelete]),
			),
		).toBe(true)
		expect(
			isActionAllowed(AllowedActions.CAN_DELETE_CUSTOMER, canSee([])),
		).toBe(false)
	})
})
