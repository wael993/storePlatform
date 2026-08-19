import JsBarcode from 'jsbarcode'

export const SYSTEM_LABEL_TEMPLATE_ID = 'system'

export const LABEL_FIELD_TYPES = [
	'storeName',
	'storeLogo',
	'productName',
	'barcode',
	'barcodeValue',
	'price',
	'category',
] as const

export type LabelFieldType = (typeof LABEL_FIELD_TYPES)[number]
export type LabelTextAlign = 'left' | 'center' | 'right'

export interface LabelField {
	id: string
	type: LabelFieldType
	x: number
	y: number
	width: number
	height: number
	fontSize?: number
	align?: LabelTextAlign
	padding?: number
}

export interface LabelLayout {
	width: number
	height: number
	fields: LabelField[]
}

export interface LabelTemplate {
	templateId: string
	name: string
	isDefault: boolean
	isProtected: boolean
	layout: LabelLayout
}

export interface LabelFieldValues {
	storeName: string
	storeLogo: string
	productName: string
	barcode: string
	barcodeValue: string
	price: string
	category: string
}

export const MM_TO_PX = 4

export const SYSTEM_LABEL_LAYOUT: LabelLayout = {
	width: 50,
	height: 30,
	fields: [
		{
			id: 'storeName',
			type: 'storeName',
			x: 2,
			y: 1,
			width: 46,
			height: 4,
			fontSize: 8,
			align: 'center',
		},
		{
			id: 'productName',
			type: 'productName',
			x: 2,
			y: 5,
			width: 46,
			height: 4,
			fontSize: 8,
			align: 'center',
		},
		{
			id: 'barcode',
			type: 'barcode',
			x: 2,
			y: 9,
			width: 46,
			height: 12,
		},
		{
			id: 'barcodeValue',
			type: 'barcodeValue',
			x: 2,
			y: 21,
			width: 46,
			height: 4,
			fontSize: 7,
			align: 'center',
		},
		{
			id: 'price',
			type: 'price',
			x: 2,
			y: 25,
			width: 46,
			height: 4,
			fontSize: 8,
			align: 'center',
		},
	],
}

export const cloneLabelLayout = (layout: LabelLayout): LabelLayout =>
	JSON.parse(JSON.stringify(layout)) as LabelLayout

export const isVerticalLayout = (
	layout: Pick<LabelLayout, 'width' | 'height'>,
) => layout.height > layout.width

export const clampLabelFields = (layout: LabelLayout): LabelLayout => ({
	...layout,
	fields: layout.fields.map(field => {
		const width = Math.min(Math.max(4, field.width), Math.max(4, layout.width))
		const height = Math.min(
			Math.max(3, field.height),
			Math.max(3, layout.height),
		)

		return {
			...field,
			width,
			height,
			x: Math.min(Math.max(0, field.x), Math.max(0, layout.width - width)),
			y: Math.min(Math.max(0, field.y), Math.max(0, layout.height - height)),
		}
	}),
})

const fieldsAreLandscape = (layout: LabelLayout) => {
	const landscape = layout.fields.filter(field => field.width >= field.height)
	return landscape.length >= layout.fields.length - landscape.length
}

const rotateFieldCw = (field: LabelField, canvasWidth: number): LabelField => ({
	...field,
	x: field.y,
	y: canvasWidth - field.x - field.width,
	width: field.height,
	height: field.width,
})

const rotateFieldCcw = (
	field: LabelField,
	canvasHeight: number,
): LabelField => ({
	...field,
	x: canvasHeight - field.y - field.height,
	y: field.x,
	width: field.height,
	height: field.width,
})

export const ensureVerticalFields = (layout: LabelLayout): LabelLayout => {
	if (!isVerticalLayout(layout) || !fieldsAreLandscape(layout)) {
		return clampLabelFields(layout)
	}

	return clampLabelFields({
		...layout,
		fields: layout.fields.map(field => rotateFieldCw(field, layout.width)),
	})
}

export const setLabelOrientation = (
	layout: LabelLayout,
	vertical: boolean,
): LabelLayout => {
	const portrait = isVerticalLayout(layout)

	if (vertical) {
		if (!portrait) {
			return clampLabelFields({
				width: layout.height,
				height: layout.width,
				fields: layout.fields.map(field => rotateFieldCw(field, layout.width)),
			})
		}

		return ensureVerticalFields(layout)
	}

	if (portrait && !fieldsAreLandscape(layout)) {
		return clampLabelFields({
			width: layout.height,
			height: layout.width,
			fields: layout.fields.map(field => rotateFieldCcw(field, layout.height)),
		})
	}

	if (portrait) {
		return clampLabelFields({
			...layout,
			width: layout.height,
			height: layout.width,
		})
	}

	return clampLabelFields(layout)
}

export const defaultField = (
	type: LabelFieldType,
	layout?: Pick<LabelLayout, 'width' | 'height'>,
): LabelField => {
	const canvasWidth = layout?.width ?? 50
	const canvasHeight = layout?.height ?? 30
	const vertical = canvasHeight > canvasWidth
	const along = Math.max(4, (vertical ? canvasHeight : canvasWidth) - 4)
	const across = type === 'barcode' || type === 'storeLogo' ? 12 : 4

	return {
		id: type,
		type,
		x: 2,
		y: 2,
		width: vertical ? Math.min(across, canvasWidth - 4) : along,
		height: vertical ? along : Math.min(across, canvasHeight - 4),
		fontSize: 8,
		align: 'center',
	}
}

export const formatLabelPrice = (
	amount?: number,
	currency?: string,
): string => {
	if (amount === undefined || !Number.isFinite(amount)) {
		return ''
	}

	return [amount.toLocaleString(), currency].filter(Boolean).join(' ')
}

export const resolveLabelValues = ({
	product,
	barcode,
	storeName,
	storeLogo,
}: {
	product: Product
	barcode: string
	storeName: string
	storeLogo: string
}): LabelFieldValues => ({
	storeName,
	storeLogo,
	productName: product.name,
	barcode,
	barcodeValue: barcode,
	price: formatLabelPrice(product.price?.retailPrice, product.price?.currency),
	category: product.categoryName ?? '',
})

export const renderBarcodeSvg = (value: string): string => {
	if (!value) {
		return ''
	}

	try {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		JsBarcode(svg, value, {
			format: 'CODE128B',
			displayValue: false,
			lineColor: '#000000',
			background: '#ffffff',
			margin: 0,
			width: 1.5,
			height: 48,
		})
		svg.setAttribute('width', '100%')
		svg.setAttribute('height', '100%')
		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
		return svg.outerHTML
	} catch {
		return ''
	}
}

export const pickDefaultTemplate = (
	templates: LabelTemplate[],
): LabelTemplate =>
	templates.find(template => template.isDefault) ??
	templates.find(template => template.isProtected) ?? {
		templateId: SYSTEM_LABEL_TEMPLATE_ID,
		name: 'System default',
		isDefault: true,
		isProtected: true,
		layout: cloneLabelLayout(SYSTEM_LABEL_LAYOUT),
	}
