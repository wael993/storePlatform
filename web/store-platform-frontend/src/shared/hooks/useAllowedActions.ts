import { SEE } from '../seeFlags'
import { useSee } from './useSee'

interface AllowedActionsMap {
	canAddProduct: boolean
	canDeleteProduct: boolean
	canEditProduct: boolean
	canPrintBarcode: boolean

	seeStockQuantity: boolean
	canEditStockQuantity: boolean
	seeNotifications: boolean

	seeMinStockQuantity: boolean
	canEditMinStockQuantity: boolean

	seeWholesalePrice: boolean
	canEditWholesalePrice: boolean

	seeSemiWholesalePrice: boolean
	canEditSemiWholesalePrice: boolean

	seeDiscount: boolean
	canEditDiscount: boolean

	seeReport: boolean
	canAddReport: boolean
	canEditReport: boolean
	canDeleteReport: boolean

	seeBuyCost: boolean
	canEditBuyCost: boolean

	seeSupplier: boolean
	canAddSupplier: boolean
	canEditSupplier: boolean
	canDeleteSupplier: boolean

	seeLocationShelf: boolean
	canEditLocationShelf: boolean
	seeLocationWarehouse: boolean
	canEditLocationWarehouse: boolean
}

const useAllowedActions = (_overriddenPath?: string): AllowedActionsMap => {
	const { canSee } = useSee()

	return {
		canAddProduct: canSee(SEE.productsAdd),
		canDeleteProduct: canSee(SEE.productsDelete),
		canEditProduct: canSee(SEE.productsEdit),
		canPrintBarcode: canSee(SEE.productsPrintBarcode),

		seeStockQuantity: true,
		canEditStockQuantity: true,
		seeNotifications: canSee(SEE.productsNotifications),

		seeMinStockQuantity: true,
		canEditMinStockQuantity: true,

		seeWholesalePrice: canSee(SEE.productsWholesalePrice),
		canEditWholesalePrice: canSee(SEE.productsWholesalePrice),

		seeSemiWholesalePrice: canSee(SEE.productsSemiWholesalePrice),
		canEditSemiWholesalePrice: canSee(SEE.productsSemiWholesalePrice),

		seeDiscount: true,
		canEditDiscount: true,

		seeReport: canSee(SEE.reports),
		canAddReport: canSee(SEE.reports),
		canEditReport: canSee(SEE.reports),
		canDeleteReport: canSee(SEE.reports),

		seeBuyCost: canSee(SEE.productsBuyingPrice),
		canEditBuyCost: canSee(SEE.productsBuyingPrice),

		seeSupplier: canSee(SEE.supplier),
		canAddSupplier: canSee(SEE.suppliersAdd),
		canEditSupplier: canSee(SEE.supplier),
		canDeleteSupplier: canSee(SEE.suppliersDelete),

		seeLocationShelf: true,
		canEditLocationShelf: true,
		seeLocationWarehouse: true,
		canEditLocationWarehouse: true,
	}
}

export default useAllowedActions
