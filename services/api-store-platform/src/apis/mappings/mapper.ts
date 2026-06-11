import { Customer } from '../../shared/types/api'

export const mapCustomers = (customers: Customer[]) => {
	const mappedCustomers = customers.map(customer => {
		const actions = customer.actions ?? []

		const sold = actions.reduce((sum, action) => {
			const raw = action.totalPrice ?? '0'
			const price = parseFloat(raw.replace(/,/g, '')) || 0

			return sum + price
		}, 0)
		return {
			customerId: customer.customerId,
			name: customer.name,
			sold,
			internalCode: customer.internalCode,
			createdAt: customer.createdAt,
			updatedAt: customer.updatedAt,
			createdBy: customer.createdBy,
			updatedBy: customer.updatedBy,
			relatedActions: actions.map(action => ({
				actionId: action.actionId,
				entryType: action.entryType,
				productId: action.productId,
				invoiceNumber: action.invoiceNumber,
				productName: action.productName,
				weight: action.weight,
				singleUnitPrice: action.singleUnitPrice,
				totalPrice: action.totalPrice,
			})),
		}
	})

	return mappedCustomers
}
