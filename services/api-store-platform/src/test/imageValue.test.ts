import { describe, expect, it } from 'vitest'

import {
	MAX_STORED_IMAGE_BYTES,
	normalizeStoredImage,
} from '../shared/imageValue'

describe('normalizeStoredImage', () => {
	it('keeps a data URL that is longer than 2000 characters', () => {
		const image = `data:image/png;base64,${'A'.repeat(3000)}`

		expect(image.length).toBeGreaterThan(2000)
		expect(normalizeStoredImage(image)).toBe(image)
	})

	it('drops a data URL over the size cap', () => {
		const image = `data:image/png;base64,${Buffer.alloc(MAX_STORED_IMAGE_BYTES + 1).toString('base64')}`

		expect(normalizeStoredImage(image)).toBe('')
	})

	it('keeps a short direct link and drops anything else', () => {
		expect(normalizeStoredImage('https://cdn.example/logo.png')).toBe(
			'https://cdn.example/logo.png',
		)

		expect(normalizeStoredImage('not a url')).toBe('')
		expect(normalizeStoredImage('')).toBe('')
		expect(normalizeStoredImage('javascript:alert(1)')).toBe('')
		expect(normalizeStoredImage('data:text/html;base64,PGI+')).toBe('')
		expect(normalizeStoredImage('data:image/webp;base64,AAAA')).toBe('')
	})
})
