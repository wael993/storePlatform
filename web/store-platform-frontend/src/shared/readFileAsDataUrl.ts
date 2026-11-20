/** FileReader data URL. Release notes, invoice logo/QR, and payment QR all use this. */
export const readFileAsDataUrl = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = () => resolve(String(reader.result || ''))
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})

/** Same cap as a release-note screenshot. A data URL is about 4/3 of this. */
export const MAX_UPLOADED_IMAGE_BYTES = 1_200_000

export const readImageFile = async (file: File): Promise<string> => {
	if (!['image/png', 'image/jpeg'].includes(file.type)) {
		throw new Error('not-image')
	}

	if (file.size > MAX_UPLOADED_IMAGE_BYTES) {
		throw new Error('too-large')
	}

	return readFileAsDataUrl(file)
}
