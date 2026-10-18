import { describe, expect, it } from 'vitest'

import { clipNewsroomDescription } from '../components/newsroom/NewsroomViews'

describe('newsroom card copy', () => {
	it('clips long descriptions to about 30 words', () => {
		const words = Array.from({ length: 35 }, (_, index) => `w${index + 1}`)

		expect(clipNewsroomDescription(words.join(' ')).endsWith('…')).toBe(true)
		expect(clipNewsroomDescription('Short note')).toBe('Short note')
	})
})
