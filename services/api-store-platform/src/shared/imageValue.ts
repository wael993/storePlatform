/** Decoded size cap for one stored image. Matches the upload limit in the web app. */
export const MAX_STORED_IMAGE_BYTES = 1_200_000

const DATA_IMAGE = /^data:image\/(png|jpe?g);base64,/i
const HTTP_URL = /^https?:\/\//i
const MAX_HTTP_URL_LENGTH = 2048

const decodedBytes = (value: string): number => {
	const comma = value.indexOf(',')

	if (comma < 0) return 0

	return Buffer.from(value.slice(comma + 1), 'base64').length
}

/**
 * Keep a real image. A data URL is stored whole (a 2000-character cut breaks it).
 * A short http(s) link is kept for images already saved. Anything else is dropped.
 */
export const normalizeStoredImage = (value: string): string => {
	const image = value.trim()

	if (!image) return ''

	if (DATA_IMAGE.test(image)) {
		const bytes = decodedBytes(image)

		return bytes > 0 && bytes <= MAX_STORED_IMAGE_BYTES ? image : ''
	}

	if (HTTP_URL.test(image) && image.length <= MAX_HTTP_URL_LENGTH) return image

	return ''
}
