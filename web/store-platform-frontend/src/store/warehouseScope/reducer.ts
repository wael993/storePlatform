import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import {
	getSelectedWarehouseIds,
	setSelectedWarehouseIds as writeSelectedWarehouseIds,
} from '../../shared/warehouseScope'

export interface WarehouseScopeState {
	selectedWarehouseIds: string[]
}

const initialState: WarehouseScopeState = {
	selectedWarehouseIds: getSelectedWarehouseIds(),
}

const warehouseScopeSlice = createSlice({
	name: 'warehouseScope',
	initialState,
	reducers: {
		warehouseScopeUpdated: (state, action: PayloadAction<string[]>) => {
			state.selectedWarehouseIds = action.payload
		},
	},
})

export const { warehouseScopeUpdated } = warehouseScopeSlice.actions

export const setSelectedWarehouseIds = (ids: string[]) => {
	writeSelectedWarehouseIds(ids)
	return warehouseScopeUpdated(getSelectedWarehouseIds())
}

export const selectSelectedWarehouseIds = (state: {
	warehouseScope: WarehouseScopeState
}): string[] => state.warehouseScope.selectedWarehouseIds

export default warehouseScopeSlice.reducer
