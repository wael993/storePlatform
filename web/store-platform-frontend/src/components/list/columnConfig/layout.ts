export type ColumnDef = {
	id: string
	labelKey: string
	width: number
	locked?: boolean
	available?: boolean
	defaultHidden?: boolean
	sortKey?: string
	align?: 'left' | 'right'
}

export type ColumnLayout = {
	order: string[]
	hidden: string[]
}

const availableColumns = (catalog: ColumnDef[]): ColumnDef[] =>
	catalog.filter(column => column.available !== false)

export const defaultLayout = (catalog: ColumnDef[]): ColumnLayout => {
	const available = availableColumns(catalog)
	return {
		order: available.map(column => column.id),
		hidden: available
			.filter(column => column.defaultHidden && !column.locked)
			.map(column => column.id),
	}
}

export const mergeLayout = (
	layout: ColumnLayout,
	catalog: ColumnDef[],
): ColumnLayout => {
	const available = availableColumns(catalog)
	const availableIds = available.map(column => column.id)
	const availableSet = new Set(availableIds)
	const lockedSet = new Set(
		available.filter(column => column.locked).map(column => column.id),
	)
	const added = availableIds.filter(id => !layout.order.includes(id))
	const order = [...layout.order.filter(id => availableSet.has(id)), ...added]
	const hidden = [
		...layout.hidden.filter(id => availableSet.has(id) && !lockedSet.has(id)),
		...added.filter(id => !lockedSet.has(id)),
	]

	return { order, hidden }
}

export const parseCols = (cols: string, catalog: ColumnDef[]): ColumnLayout => {
	const available = availableColumns(catalog)
	const availableIds = new Set(available.map(column => column.id))
	const lockedSet = new Set(
		available.filter(column => column.locked).map(column => column.id),
	)
	const parsed = cols
		.split(',')
		.map(id => id.trim())
		.filter(id => availableIds.has(id))
	const parsedSet = new Set(parsed)
	const rest = available
		.filter(column => !parsedSet.has(column.id))
		.map(column => column.id)

	return {
		order: [...parsed, ...rest],
		hidden: rest.filter(id => !lockedSet.has(id)),
	}
}

export const serializeCols = (
	layout: ColumnLayout,
	catalog: ColumnDef[],
): string => {
	const merged = mergeLayout(layout, catalog)
	const hidden = new Set(merged.hidden)
	const lockedSet = new Set(
		availableColumns(catalog)
			.filter(column => column.locked)
			.map(column => column.id),
	)

	return merged.order
		.filter(id => lockedSet.has(id) || !hidden.has(id))
		.join(',')
}

export const visibleColumns = (
	layout: ColumnLayout,
	catalog: ColumnDef[],
): ColumnDef[] => {
	const merged = mergeLayout(layout, catalog)
	const byId = new Map(
		availableColumns(catalog).map(column => [column.id, column]),
	)
	const hidden = new Set(merged.hidden)

	return merged.order.flatMap(id => {
		const column = byId.get(id)
		if (!column) return []
		if (column.locked || !hidden.has(id)) return [column]
		return []
	})
}

export const pickerColumns = (
	layout: ColumnLayout,
	catalog: ColumnDef[],
): ColumnDef[] => {
	const merged = mergeLayout(layout, catalog)
	const byId = new Map(
		availableColumns(catalog).map(column => [column.id, column]),
	)

	return merged.order.flatMap(id => {
		const column = byId.get(id)
		return column ? [column] : []
	})
}

export const toggleHidden = (
	layout: ColumnLayout,
	id: string,
	catalog: ColumnDef[],
): ColumnLayout => {
	const column = catalog.find(item => item.id === id)
	if (!column || column.locked || column.available === false) return layout

	const merged = mergeLayout(layout, catalog)
	const hidden = new Set(merged.hidden)
	if (hidden.has(id)) hidden.delete(id)
	else hidden.add(id)

	return { order: merged.order, hidden: [...hidden] }
}

export const reorderColumns = (
	layout: ColumnLayout,
	fromId: string,
	toId: string,
	catalog: ColumnDef[],
): ColumnLayout => {
	if (fromId === toId) return layout
	const merged = mergeLayout(layout, catalog)
	const order = [...merged.order]
	const fromIndex = order.indexOf(fromId)
	const toIndex = order.indexOf(toId)
	if (fromIndex < 0 || toIndex < 0) return merged
	order.splice(fromIndex, 1)
	order.splice(toIndex, 0, fromId)

	return { ...merged, order }
}
