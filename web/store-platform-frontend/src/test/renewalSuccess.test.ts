import { describe, expect, it } from 'vitest'

import { shouldShowRenewalSuccess } from '../components/SubscriptionRenewalBanner'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const reviewedAt = '2026-11-01T12:00:00.000Z'
const reviewedMs = Date.parse(reviewedAt)

describe('renewal success message', () => {
	it('shows on the first look during the week after approval, then not again', () => {
		expect(shouldShowRenewalSuccess(reviewedAt, reviewedMs + 1000, false)).toBe(
			true,
		)
		expect(shouldShowRenewalSuccess(reviewedAt, reviewedMs + 1000, true)).toBe(
			false,
		)
		expect(
			shouldShowRenewalSuccess(reviewedAt, reviewedMs + WEEK_MS + 1, false),
		).toBe(false)
		expect(shouldShowRenewalSuccess(null, reviewedMs, false)).toBe(false)
	})
})
