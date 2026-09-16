import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import en from '../i18n/en/translation.json'
import { usePrintProductBarcode } from '../components/product/usePrintProductBarcode'

const online = { value: true }
const generate = {
	mutate: vi.fn(),
	isLoading: false,
}
const showToast = vi.fn()

vi.mock('../offline/connectivity', async importOriginal => {
	const actual =
		await importOriginal<typeof import('../offline/connectivity')>()

	return {
		...actual,
		getIsOnline: () => online.value,
	}
})

vi.mock('../components/common/CustomToast', () => ({
	default: () => showToast,
}))

vi.mock('../api/apiStore', async importOriginal => {
	const actual = await importOriginal<typeof import('../api/apiStore')>()

	return {
		...actual,
		useGenerateProductBarcodeMutation: () => [
			generate.mutate,
			{
				get isLoading() {
					return generate.isLoading
				},
			},
		],
	}
})

const product = (barcode?: string): Product =>
	({
		productId: 'prod-1',
		barcode,
		name: 'Tea',
		status: 'active',
		price: { retailPrice: 1, currency: 'SYP' },
	}) as Product

beforeEach(() => {
	online.value = true
	generate.isLoading = false
	generate.mutate.mockReset()
	showToast.mockReset()
})

describe('usePrintProductBarcode', () => {
	it('opens the preview for a real barcode without generating', async () => {
		const { result } = renderHook(() =>
			usePrintProductBarcode(product('001070002')),
		)

		await act(() => result.current.printBarcode())

		expect(generate.mutate).not.toHaveBeenCalled()
		expect(result.current.barcode).toBe('001070002')
		expect(result.current.preview.isOpen).toBe(true)
		expect(showToast).not.toHaveBeenCalled()
	})

	it('generates once when barcode is empty', async () => {
		generate.mutate.mockReturnValue({
			unwrap: () => Promise.resolve({ barcode: '001010219' }),
		})
		const { result } = renderHook(() => usePrintProductBarcode(product('')))

		await act(() => result.current.printBarcode())

		expect(generate.mutate).toHaveBeenCalledTimes(1)
		expect(generate.mutate).toHaveBeenCalledWith('prod-1')
		expect(result.current.barcode).toBe('001010219')
		expect(result.current.barcode).not.toBe('prod-1')
		expect(result.current.preview.isOpen).toBe(true)
	})

	it('treats a legacy product-id barcode as missing', async () => {
		generate.mutate.mockReturnValue({
			unwrap: () => Promise.resolve({ barcode: '001010219' }),
		})
		const { result } = renderHook(() =>
			usePrintProductBarcode(product('prod-1')),
		)

		await act(() => result.current.printBarcode())

		expect(generate.mutate).toHaveBeenCalledTimes(1)
		expect(result.current.barcode).toBe('001010219')
		expect(result.current.preview.isOpen).toBe(true)
	})

	it('toasts offline and does not print the product id', async () => {
		online.value = false
		const { result } = renderHook(() => usePrintProductBarcode(product('')))

		await act(() => result.current.printBarcode())

		expect(generate.mutate).not.toHaveBeenCalled()
		expect(result.current.preview.isOpen).toBe(false)
		expect(result.current.barcode).toBe('')
		expect(showToast).toHaveBeenCalledWith({
			status: 'error',
			description: en.components.product.printBarcodeOffline,
		})
	})

	it('toasts when generate fails and keeps the preview closed', async () => {
		generate.mutate.mockReturnValue({
			unwrap: () => Promise.reject(new Error('fail')),
		})
		const { result } = renderHook(() => usePrintProductBarcode(product('')))

		await act(() => result.current.printBarcode())

		expect(result.current.preview.isOpen).toBe(false)
		expect(result.current.barcode).toBe('')
		expect(showToast).toHaveBeenCalledWith({
			status: 'error',
			description: en.components.activityDetail.topSection.failUpdateMessage,
		})
	})

	it('ignores a second click while generate is in flight', async () => {
		let release!: (value: { barcode: string }) => void
		const hang = new Promise<{ barcode: string }>(resolve => {
			release = resolve
		})
		generate.mutate.mockReturnValue({ unwrap: () => hang })
		const { result } = renderHook(() => usePrintProductBarcode(product('')))

		await act(async () => {
			const first = result.current.printBarcode()
			await result.current.printBarcode()
			release({ barcode: '001010219' })
			await first
		})

		expect(generate.mutate).toHaveBeenCalledTimes(1)
		expect(result.current.preview.isOpen).toBe(true)
		expect(result.current.barcode).toBe('001010219')
	})
})
