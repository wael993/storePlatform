export type WarehouseTransferMovingLeg = {
	referenceId: string
	referenceType?: string
	type?: string
	productId: string
	warehouseId: string
	quantity: number
	createdAt?: Date | string
	note?: string
	createdBy?: {
		_id?: string
		displayName?: string
		role?: string
		createdAt?: Date | string
	}
}

export type GroupedWarehouseTransferItem = {
	productId: string
	quantity: number
}

export type GroupedWarehouseTransfer = {
	referenceId: string
	fromWarehouseId: string
	toWarehouseId: string
	createdAt: Date | string
	note?: string
	createdBy?: WarehouseTransferMovingLeg['createdBy']
	items: GroupedWarehouseTransferItem[]
}

/**
 * Collapse paired transfer_out + transfer_in stockMovings (same referenceId)
 * into one warehouse-transfer action (one or many products).
 */
export const groupWarehouseTransferMovings = (
	movings: WarehouseTransferMovingLeg[],
): GroupedWarehouseTransfer[] => {
	const byRef = new Map<
		string,
		{
			fromWarehouseId?: string
			toWarehouseId?: string
			createdAt?: Date | string
			note?: string
			createdBy?: WarehouseTransferMovingLeg['createdBy']
			itemsByProduct: Map<string, { out?: number; in?: number }>
			invalid?: boolean
		}
	>()

	for (const moving of movings) {
		if (moving.referenceType && moving.referenceType !== 'warehouse_transfer') {
			continue
		}

		const group = byRef.get(moving.referenceId) ?? {
			itemsByProduct: new Map<string, { out?: number; in?: number }>(),
		}

		if (moving.type === 'transfer_out') {
			if (
				group.fromWarehouseId &&
				group.fromWarehouseId !== moving.warehouseId
			) {
				group.invalid = true
			}

			group.fromWarehouseId = moving.warehouseId
			const prev = group.itemsByProduct.get(moving.productId) ?? {}

			if (prev.out !== undefined) {
				group.invalid = true
			}

			group.itemsByProduct.set(moving.productId, {
				...prev,
				out: moving.quantity,
			})

			group.createdAt = moving.createdAt ?? group.createdAt
			group.note = moving.note ?? group.note
			group.createdBy = moving.createdBy ?? group.createdBy
		} else if (moving.type === 'transfer_in') {
			if (group.toWarehouseId && group.toWarehouseId !== moving.warehouseId) {
				group.invalid = true
			}

			group.toWarehouseId = moving.warehouseId
			const prev = group.itemsByProduct.get(moving.productId) ?? {}

			if (prev.in !== undefined) {
				group.invalid = true
			}

			group.itemsByProduct.set(moving.productId, {
				...prev,
				in: moving.quantity,
			})

			group.createdAt = group.createdAt ?? moving.createdAt
			group.note = group.note ?? moving.note
			group.createdBy = group.createdBy ?? moving.createdBy
		}

		byRef.set(moving.referenceId, group)
	}

	const grouped: GroupedWarehouseTransfer[] = []

	for (const [referenceId, group] of byRef) {
		// note: corrupt/mismatched legs are omitted (invisible until data repair).
		if (
			group.invalid ||
			!group.fromWarehouseId ||
			!group.toWarehouseId ||
			group.itemsByProduct.size === 0
		) {
			continue
		}

		const items: GroupedWarehouseTransferItem[] = []
		let legsMatch = true

		for (const [productId, legs] of group.itemsByProduct) {
			if (
				legs.out === undefined ||
				legs.in === undefined ||
				legs.out !== legs.in ||
				legs.out < 1
			) {
				legsMatch = false
				break
			}

			items.push({ productId, quantity: legs.out })
		}

		if (!legsMatch || items.length === 0) {
			continue
		}

		grouped.push({
			referenceId,
			fromWarehouseId: group.fromWarehouseId,
			toWarehouseId: group.toWarehouseId,
			createdAt: group.createdAt ?? new Date(0),
			note: group.note,
			createdBy: group.createdBy,
			items,
		})
	}

	return grouped.sort((a, b) => {
		const aTime = new Date(a.createdAt).getTime()
		const bTime = new Date(b.createdAt).getTime()

		return bTime - aTime
	})
}
