import { describe, expect, it } from 'vitest'

import { isUuidV4, resolveSyncClientId } from '../shared/uuid'

const v4 = '550e8400-e29b-41d4-a716-446655440000'

describe('uuid', () => {
	it('keeps a valid client v4 and rejects anything else', () => {
		expect(isUuidV4(v4)).toBe(true)
		expect(isUuidV4('not-a-uuid')).toBe(false)
		expect(resolveSyncClientId(v4)).toBe(v4)
		expect(resolveSyncClientId('prod-1')).not.toBe('prod-1')
		expect(isUuidV4(resolveSyncClientId(''))).toBe(true)
	})
})
