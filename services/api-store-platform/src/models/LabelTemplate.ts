import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

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

export interface LabelTemplateDto {
	templateId: string
	name: string
	isDefault: boolean
	isProtected: boolean
	layout: LabelLayout
}

export interface ILabelTemplate extends Document {
	tenantId: string
	templateId: string
	name: string
	isDefault: boolean
	layout: LabelLayout
	createdBy: {
		_id: string
		displayName: string
		role?: string
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		role?: string
		updatedAt: Date
	}
}

const LabelFieldSchema = new Schema<LabelField>(
	{
		id: { type: String, required: true },
		type: { type: String, required: true, enum: LABEL_FIELD_TYPES },
		x: { type: Number, required: true },
		y: { type: Number, required: true },
		width: { type: Number, required: true },
		height: { type: Number, required: true },
		fontSize: { type: Number },
		align: { type: String, enum: ['left', 'center', 'right'] },
		padding: { type: Number },
	},
	{ _id: false },
)

const LabelLayoutSchema = new Schema<LabelLayout>(
	{
		width: { type: Number, required: true },
		height: { type: Number, required: true },
		fields: { type: [LabelFieldSchema], required: true },
	},
	{ _id: false },
)

const LabelTemplateSchema = new Schema<ILabelTemplate>(
	{
		templateId: { type: String, required: true },
		name: { type: String, required: true, trim: true },
		isDefault: { type: Boolean, default: false },
		layout: { type: LabelLayoutSchema, required: true },
	},
	{ timestamps: true },
)

tenantScopedSchema(LabelTemplateSchema)

LabelTemplateSchema.index({ tenantId: 1, templateId: 1 }, { unique: true })
LabelTemplateSchema.index(
	{ tenantId: 1 },
	{ unique: true, partialFilterExpression: { isDefault: true } },
)

export const LabelTemplate = mongoose.model<ILabelTemplate>(
	'LabelTemplate',
	LabelTemplateSchema,
	'labelTemplates',
)

export const isLabelFieldType = (value: string): value is LabelFieldType =>
	LABEL_FIELD_TYPES.includes(value as LabelFieldType)

export const cloneLabelLayout = (layout: LabelLayout): LabelLayout =>
	JSON.parse(JSON.stringify(layout)) as LabelLayout

const asFiniteNumber = (value: unknown): number | undefined => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

export const validateLabelLayout = (layout: unknown): LabelLayout => {
	if (!layout || typeof layout !== 'object') {
		throw new Error('layout is required')
	}

	const candidate = layout as LabelLayout
	const width = asFiniteNumber(candidate.width)
	const height = asFiniteNumber(candidate.height)

	if (width === undefined || height === undefined || width <= 0 || height <= 0) {
		throw new Error('layout width and height must be positive')
	}

	if (!Array.isArray(candidate.fields)) {
		throw new Error('layout fields are required')
	}

	const seen = new Set<string>()
	const fields: LabelField[] = []

	for (const field of candidate.fields) {
		if (!field || !isLabelFieldType(field.type)) {
			throw new Error('unsupported label field')
		}

		if (seen.has(field.type)) {
			throw new Error('duplicate label field type')
		}

		seen.add(field.type)

		const x = asFiniteNumber(field.x)
		const y = asFiniteNumber(field.y)
		const fieldWidth = asFiniteNumber(field.width)
		const fieldHeight = asFiniteNumber(field.height)

		if (
			x === undefined ||
			y === undefined ||
			fieldWidth === undefined ||
			fieldHeight === undefined ||
			!(fieldWidth > 0) ||
			!(fieldHeight > 0)
		) {
			throw new Error('invalid label field geometry')
		}

		fields.push({
			id: String(field.id || field.type),
			type: field.type,
			x,
			y,
			width: fieldWidth,
			height: fieldHeight,
			fontSize: asFiniteNumber(field.fontSize),
			align:
				field.align === 'left' ||
				field.align === 'center' ||
				field.align === 'right'
					? field.align
					: 'left',
			padding: asFiniteNumber(field.padding),
		})
	}

	if (!seen.has('barcode')) {
		throw new Error('layout must include a barcode field')
	}

	return { width, height, fields }
}

export const systemLabelTemplateDto = (
	isDefault: boolean,
): LabelTemplateDto => ({
	templateId: SYSTEM_LABEL_TEMPLATE_ID,
	name: 'System default',
	isDefault,
	isProtected: true,
	layout: cloneLabelLayout(SYSTEM_LABEL_LAYOUT),
})

export const toLabelTemplateDto = (
	template: Pick<ILabelTemplate, 'templateId' | 'name' | 'isDefault' | 'layout'>,
): LabelTemplateDto => ({
	templateId: template.templateId,
	name: template.name,
	isDefault: Boolean(template.isDefault),
	isProtected: false,
	layout: cloneLabelLayout(template.layout),
})
