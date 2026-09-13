import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AllowedActions } from '../shared/globalEnums'
import { isActionAllowed, useResources } from '../shared/hooks/useResources'
import { SEE } from '../shared/seeFlags'

vi.mock('../shared/hooks/useSee', () => ({
	useSee: () => ({
		canSee: (id: string) => id === SEE.productsAdd,
	}),
}))

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
		expect(
			isActionAllowed('seeStockQuantity' as AllowedActions, canSee([])),
		).toBe(false)
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

describe('useResources', () => {
	it('wires canSee through the hook', () => {
		const { result } = renderHook(() => useResources())

		expect(result.current.isActionAllowed(AllowedActions.ADD_PRODUCT)).toBe(
			true,
		)
		expect(result.current.isActionAllowed(AllowedActions.SEE_REPORT)).toBe(
			false,
		)
	})
})
