import { useTranslation } from 'react-i18next'
import useCustomToast from '../../common/CustomToast'
import { useState } from 'react'
import { useEditProductMutation } from '../../../api/apiStore'

interface PatchProductProgressState {
	isStockQuantityInProgress: boolean
	isStockMinQuantityInProgress: boolean
	isBuyCostInProgress: boolean
	isWholesalePriceInProgress: boolean
	isSupplierFocusInProgress: boolean
	isDiscountInProgress: boolean
	isLocationShelfInProgress: boolean
	isLocationWarehouseInProgress: boolean
}

export const useListItem = <T extends Product>(productData: T) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const [editProduct] = useEditProductMutation()

	const [patchProductProgressState, setPatchProductProgressState] =
		useState<PatchProductProgressState>({
			isStockQuantityInProgress: false,
			isStockMinQuantityInProgress: false,
			isBuyCostInProgress: false,
			isWholesalePriceInProgress: false,
			isSupplierFocusInProgress: false,
			isDiscountInProgress: false,
			isLocationShelfInProgress: false,
			isLocationWarehouseInProgress: false,
		})

	const parseNumberInput = (value?: string): number => {
		if (!value?.trim()) {
			throw new Error('NO_VALUE')
		}

		const parsedValue = Number(value.replaceAll(',', '').trim())

		if (Number.isNaN(parsedValue)) {
			throw new Error('INVALID_NUMBER')
		}

		return parsedValue
	}

	const handleProductUpdate = async (
		data: Partial<Omit<Product, 'productId'>>,
	): Promise<void> => {
		try {
			await editProduct({
				id: productData.productId,
				body: data,
			}).unwrap()
		} catch (error) {
			showToastMessage({
				status: 'error',
				description: t(
					'components.activityDetail.topSection.failUpdateMessage',
				),
			})
		}
	}

	const handleEditBuyCost = async (buyCost?: string): Promise<void> => {
		if (!buyCost?.trim()) {
			showToastMessage({
				status: 'error',
				description: t('components.activityDetail.topSection.buyCostNoValue'),
			})

			return
		}

		let formattedBuyCost: number

		try {
			formattedBuyCost = parseNumberInput(buyCost)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('components.activityDetail.topSection.buyCostNoValue'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isBuyCostInProgress: true,
		})

		await handleProductUpdate({
			price: {
				...productData.price,
				buyCost: formattedBuyCost,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isBuyCostInProgress: false,
		})
	}

	const handleEditSellPrice = async (sellPrice?: string): Promise<void> => {
		let formattedSellPrice: number

		try {
			formattedSellPrice = parseNumberInput(sellPrice)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('common.sellPrice'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isWholesalePriceInProgress: true,
		})

		await handleProductUpdate({
			price: {
				...productData.price,
				wholesale: formattedSellPrice,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isWholesalePriceInProgress: false,
		})
	}

	const handleEditDiscount = async (discount?: string): Promise<void> => {
		let formattedDiscount: number

		try {
			formattedDiscount = parseNumberInput(discount)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('common.discount'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isDiscountInProgress: true,
		})

		await handleProductUpdate({
			price: {
				...productData.price,
				discount: formattedDiscount,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isDiscountInProgress: false,
		})
	}

	const handleEditStockQuantity = async (
		stockQuantity?: string,
	): Promise<void> => {
		let formattedStockQuantity: number

		try {
			formattedStockQuantity = parseNumberInput(stockQuantity)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('common.stockQuantity'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isStockQuantityInProgress: true,
		})

		await handleProductUpdate({
			stock: {
				...productData.stock,
				quantity: formattedStockQuantity,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isStockQuantityInProgress: false,
		})
	}

	const handleEditStockMinQuantity = async (
		stockMinQuantity?: string,
	): Promise<void> => {
		let formattedStockMinQuantity: number

		try {
			formattedStockMinQuantity = parseNumberInput(stockMinQuantity)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('common.stockMinQuantity'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isStockMinQuantityInProgress: true,
		})

		await handleProductUpdate({
			stock: {
				...productData.stock,
				minQuantity: formattedStockMinQuantity,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isStockMinQuantityInProgress: false,
		})
	}

	const handleEditLocationShelf = async (
		locationShelf?: string,
	): Promise<void> => {
		const formattedLocationShelf = locationShelf?.trim() ?? ''

		if (!formattedLocationShelf) {
			showToastMessage({
				status: 'error',
				description: t('common.locationShelf'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isLocationShelfInProgress: true,
		})

		await handleProductUpdate({
			location: {
				...productData.location,
				shelf: formattedLocationShelf,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isLocationShelfInProgress: false,
		})
	}

	const handleEditLocationWarehouse = async (
		locationWarehouse?: string,
	): Promise<void> => {
		const formattedLocationWarehouse = locationWarehouse?.trim() ?? ''

		if (!formattedLocationWarehouse) {
			showToastMessage({
				status: 'error',
				description: t('common.locationWarehouse'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isLocationWarehouseInProgress: true,
		})

		await handleProductUpdate({
			location: {
				...productData.location,
				warehouse: formattedLocationWarehouse,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isLocationWarehouseInProgress: false,
		})
	}

	return {
		handleEditBuyCost,
		handleEditSellPrice,
		handleEditDiscount,
		handleEditStockQuantity,
		handleEditStockMinQuantity,
		handleEditLocationShelf,
		handleEditLocationWarehouse,
		patchProductProgressState,
	}
}
