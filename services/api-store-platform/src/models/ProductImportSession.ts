import mongoose, { HydratedDocument, Model, Schema } from 'mongoose'
import {
	PRODUCT_IMPORT_STATUS,
	ProductImportStatus,
} from '../shared/constants/productImport'
import { HeaderMapping, SourceRow } from '../shared/productImport/mapRows'

export type ProductImportSessionFile = {
	fileName: string
	headers: string[]
	rows: SourceRow[]
}

export interface IProductImportSession {
	sessionId: string
	tenantId: string
	status: ProductImportStatus
	files: ProductImportSessionFile[]
	mapping?: HeaderMapping
	expiresAt: Date
	createdAt: Date
	updatedAt: Date
}

export type ProductImportSessionDocument =
	HydratedDocument<IProductImportSession>

const productImportSessionSchema = new Schema<IProductImportSession>(
	{
		sessionId: { type: String, required: true, unique: true, index: true },
		tenantId: { type: String, required: true, index: true },
		status: {
			type: String,
			enum: Object.values(PRODUCT_IMPORT_STATUS),
			required: true,
		},
		files: [
			{
				fileName: { type: String, required: true },
				headers: { type: [String], default: [] },
				rows: [
					{
						fileName: { type: String, required: true },
						rowNumber: { type: Number, required: true },
						values: { type: Schema.Types.Mixed, default: {} },
						_id: false,
					},
				],
			},
		],
		mapping: { type: Schema.Types.Mixed, default: undefined },
		expiresAt: { type: Date, required: true, index: { expires: 0 } },
	},
	{ timestamps: true, versionKey: false },
)

const ProductImportSession: Model<IProductImportSession> =
	mongoose.models.ProductImportSession ||
	mongoose.model<IProductImportSession>(
		'ProductImportSession',
		productImportSessionSchema,
	)

export default ProductImportSession
