import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'
import mongoose from 'mongoose'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { ensureTenantAccess, getTenantContext } from '../tenant'
import { COLLECTION_NAMES } from '../general'
import { withTenantScope } from '../mongodb/tenantScopedModel'
import {
	PRODUCT_IMPORT_FIELDS,
	PRODUCT_IMPORT_LIMITS,
	PRODUCT_IMPORT_STATUS,
	REQUIRED_PRODUCT_IMPORT_FIELDS,
	isProductImportField,
} from '../constants/productImport'
import {
	HeaderMapping,
	mappingIsComplete,
	mapSourceRows,
	suggestHeaderMapping,
	type SourceRow,
} from './mapRows'
import { assertImportLimits, parseImportFile } from './parse'
import { getImportAiProvider } from '../importAi/providers'
import { Product } from '../../models/Products'
import { Category } from '../../models/Category'
import { Supplier } from '../../models/Supplier'
import Tenant from '../../models/Tenant'
import ProductImportSession from '../../models/ProductImportSession'
import { Invoice } from '../../models/Invoice'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { SellingInvoiceItem } from '../../models/SellingInvoices'
import { Order } from '../../models/Order'
import { StockMoving } from '../../models/StockMovings'
import { Inventory } from '../../models/Inventory'
import { RequestContext } from '../types'

const OWNER_ADMIN = new Set(['owner', 'admin'])

const decodeFile = (file: {
	fileBase64?: unknown
	mimeType?: unknown
	fileName?: unknown
}) => {
	const mimeType =
		typeof file.mimeType === 'string' ? file.mimeType.trim().toLowerCase() : ''
	const fileBase64 =
		typeof file.fileBase64 === 'string' ? file.fileBase64.trim() : ''
	const fileName =
		typeof file.fileName === 'string' ? file.fileName.trim() : 'upload'

	if (!fileBase64 || !mimeType) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'fileBase64 and mimeType are required.',
		)
	}

	const bytes = Buffer.from(
		fileBase64.replace(/^data:[^;]+;base64,/, ''),
		'base64',
	)

	if (!bytes.length) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'File is empty or not valid base64.',
		)
	}

	if (bytes.length > PRODUCT_IMPORT_LIMITS.maxFileBytes) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Each file must be 8MB or smaller.',
		)
	}

	return { bytes, mimeType, fileName }
}

const assertOwnerOrAdmin = (requestContext: RequestContext) => {
	const { role } = getTenantContext(requestContext)

	if (!OWNER_ADMIN.has(role)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Product import is only available to owner and admin.',
		)
	}
}

const tenantImportStatus = (tenant: {
	productImport?: { status?: string }
}) => {
	const status = tenant.productImport?.status

	if (
		status === PRODUCT_IMPORT_STATUS.SKIPPED ||
		status === PRODUCT_IMPORT_STATUS.COMPLETED ||
		status === PRODUCT_IMPORT_STATUS.IN_PROGRESS
	) {
		return status
	}

	return PRODUCT_IMPORT_STATUS.NOT_STARTED
}

const setTenantImportStatus = async (tenantId: string, status: string) => {
	await Tenant.updateOne(
		{ tenantId },
		{ $set: { 'productImport.status': status } },
	)
}

const loadTenant = async (tenantId: string) => {
	const tenant = await Tenant.findOne({ tenantId }).lean()

	if (!tenant) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Tenant not found.',
		)
	}

	return tenant
}

const headerSuggestions = (headers: string[]) => {
	const mapping = suggestHeaderMapping(headers)

	return PRODUCT_IMPORT_FIELDS.flatMap(field => {
		const header = mapping[field]

		return header ? [{ field, header }] : []
	})
}

export const getProductImportStatus = async (
	requestContext: RequestContext,
) => {
	assertOwnerOrAdmin(requestContext)
	const { tenantId } = getTenantContext(requestContext)
	const tenant = await loadTenant(tenantId)
	const productCount = await Product.countDocuments().setOptions({
		__tenantContext: { tenantId },
	})
	const session = await ProductImportSession.findOne({
		tenantId,
		status: PRODUCT_IMPORT_STATUS.IN_PROGRESS,
		expiresAt: { $gt: new Date() },
	})
		.sort({ updatedAt: -1 })
		.lean()
	const headers = session
		? [...new Set(session.files.flatMap(file => file.headers))]
		: []
	const suggestedMapping: HeaderMapping = { ...(session?.mapping ?? {}) }

	if (session && !Object.values(suggestedMapping).some(Boolean)) {
		for (const suggestion of headerSuggestions(headers)) {
			suggestedMapping[suggestion.field] = suggestion.header
		}
	}

	return {
		status: tenantImportStatus(tenant),
		productCount,
		fields: PRODUCT_IMPORT_FIELDS.map(key => ({
			key,
			required: REQUIRED_PRODUCT_IMPORT_FIELDS.includes(key),
		})),
		resume: session
			? {
					sessionId: session.sessionId,
					files: session.files.map(file => ({
						fileName: file.fileName,
						headers: file.headers,
						rowCount: file.rows.length,
					})),
					headers,
					suggestedMapping,
					aiSuggestedFields: [],
				}
			: undefined,
	}
}

export const skipProductImport = async (requestContext: RequestContext) => {
	assertOwnerOrAdmin(requestContext)
	const { tenantId } = getTenantContext(requestContext)
	const tenant = await loadTenant(tenantId)

	if (tenantImportStatus(tenant) === PRODUCT_IMPORT_STATUS.COMPLETED) {
		return { status: PRODUCT_IMPORT_STATUS.COMPLETED }
	}

	await setTenantImportStatus(tenantId, PRODUCT_IMPORT_STATUS.SKIPPED)

	return { status: PRODUCT_IMPORT_STATUS.SKIPPED }
}

const assertImportAllowed = async (
	requestContext: RequestContext,
	options?: { ignoreExistingProducts?: boolean },
) => {
	assertOwnerOrAdmin(requestContext)
	await ensureTenantAccess(requestContext, COLLECTION_NAMES.PRODUCTS)
	const { tenantId } = getTenantContext(requestContext)
	const tenant = await loadTenant(tenantId)
	const status = tenantImportStatus(tenant)

	if (
		status === PRODUCT_IMPORT_STATUS.SKIPPED ||
		status === PRODUCT_IMPORT_STATUS.COMPLETED
	) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Initial product import is no longer available for this tenant.',
		)
	}

	if (!options?.ignoreExistingProducts) {
		const productCount = await Product.countDocuments().setOptions({
			__tenantContext: { tenantId },
		})

		if (productCount > 0) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Existing products found (${productCount}). Delete them from the Products page before importing.`,
			)
		}
	}

	return tenantId
}

export const parseProductImportFiles = async (
	requestContext: RequestContext,
	files: Array<{
		fileBase64?: unknown
		mimeType?: unknown
		fileName?: unknown
	}>,
) => {
	const tenantId = await assertImportAllowed(requestContext)

	if (!Array.isArray(files) || files.length === 0) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'Upload at least one file.',
		)
	}

	if (files.length > PRODUCT_IMPORT_LIMITS.maxFiles) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			`You can upload at most ${PRODUCT_IMPORT_LIMITS.maxFiles} files.`,
		)
	}

	const parsed = []

	for (const file of files) {
		parsed.push(await parseImportFile(decodeFile(file)))
	}

	assertImportLimits(parsed)

	const headers = [...new Set(parsed.flatMap(file => file.headers))]
	let suggestions = headerSuggestions(headers)

	try {
		const aiSuggestions = await getImportAiProvider().mapProductHeaders({
			headers,
			fields: [...PRODUCT_IMPORT_FIELDS],
		})
		const valid = aiSuggestions.flatMap(item =>
			isProductImportField(item.field)
				? [{ field: item.field, header: item.header }]
				: [],
		)

		if (valid.length) suggestions = valid
	} catch {
		suggestions = headerSuggestions(headers)
	}

	const suggestedMapping: HeaderMapping = {}

	for (const suggestion of suggestions) {
		suggestedMapping[suggestion.field] = suggestion.header
	}

	const sessionId = uuidv4()

	await ProductImportSession.create({
		sessionId,
		tenantId,
		status: PRODUCT_IMPORT_STATUS.IN_PROGRESS,
		files: parsed,
		expiresAt: new Date(Date.now() + PRODUCT_IMPORT_LIMITS.sessionTtlMs),
	})

	await setTenantImportStatus(tenantId, PRODUCT_IMPORT_STATUS.IN_PROGRESS)

	return {
		sessionId,
		files: parsed.map(file => ({
			fileName: file.fileName,
			headers: file.headers,
			rowCount: file.rows.length,
		})),
		headers,
		suggestedMapping,
		aiSuggestedFields: suggestions.map(item => item.field),
	}
}

const loadSession = async (tenantId: string, sessionId: string) => {
	const session = await ProductImportSession.findOne({ sessionId, tenantId })

	if (!session || session.expiresAt.getTime() < Date.now()) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Import session expired. Upload the files again.',
		)
	}

	return session
}

const readMapping = (raw: unknown): HeaderMapping => {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Mapping is required.',
		)
	}

	const mapping: HeaderMapping = {}
	const record = raw as Record<string, unknown>

	for (const field of PRODUCT_IMPORT_FIELDS) {
		const value = record[field]

		if (typeof value === 'string' && value.trim()) {
			mapping[field] = value.trim()
		} else {
			mapping[field] = null
		}
	}

	if (!mappingIsComplete(mapping)) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'Map Product Name and Selling Price before continuing.',
		)
	}

	return mapping
}

const catalogMatcher = async (tenantId: string) => {
	const [categories, suppliers] = await Promise.all([
		withTenantScope(
			Category.find().select({ categoryId: 1, name: 1 }).lean(),
			tenantId,
		),
		withTenantScope(
			Supplier.find().select({ supplierId: 1, name: 1 }).lean(),
			tenantId,
		),
	])
	const categoryByName = new Map(
		categories.map(item => [item.name.trim().toLowerCase(), item.categoryId]),
	)
	const supplierByName = new Map(
		suppliers.map(item => [item.name.trim().toLowerCase(), item.supplierId]),
	)

	return (kind: 'category' | 'supplier', name: string) => {
		const key = name.trim().toLowerCase()

		if (kind === 'category') {
			const categoryId = categoryByName.get(key)

			return categoryId
				? { categoryId }
				: {
						warning: `Category "${name}" could not be matched to an existing category.`,
					}
		}

		const supplierId = supplierByName.get(key)

		return supplierId
			? { supplierId }
			: {
					warning: `Supplier "${name}" could not be matched to an existing supplier.`,
				}
	}
}

const summarizeRows = (mapped: ReturnType<typeof mapSourceRows>) => {
	const valid = mapped.filter(row => row.errors.length === 0)
	const duplicates = mapped.filter(row => row.duplicate)
	const invalid = mapped.filter(row => row.errors.length > 0 && !row.duplicate)

	return { mapped, valid, duplicates, invalid }
}

const flattenSessionRows = (session: {
	files: Array<{ rows: SourceRow[] }>
}): SourceRow[] =>
	session.files.flatMap((file, fileIndex) =>
		file.rows.map(row => ({ ...row, fileIndex })),
	)

const importProductId = (
	sessionId: string,
	row: { fileIndex?: number; fileName: string; rowNumber: number },
) => uuidv5(`${row.fileIndex ?? 0}:${row.fileName}:${row.rowNumber}`, sessionId)

const rowProductIds = (
	sessionId: string,
	row: { fileIndex?: number; fileName: string; rowNumber: number },
) => [
	importProductId(sessionId, row),
	uuidv5(`${row.fileName}:${row.rowNumber}`, sessionId),
]

const foreignBarcodes = async (
	tenantId: string,
	sessionProductIds: string[],
) => {
	const existing = await withTenantScope(
		Product.find({ barcode: { $gt: '' } })
			.select({ barcode: 1, productId: 1 })
			.lean(),
		tenantId,
	)
	const fromSession = new Set(sessionProductIds)

	return new Set(
		existing.flatMap(item =>
			item.barcode && !fromSession.has(item.productId) ? [item.barcode] : [],
		),
	)
}

export const previewProductImport = async (
	requestContext: RequestContext,
	sessionId: unknown,
	mappingRaw: unknown,
) => {
	const tenantId = await assertImportAllowed(requestContext, {
		ignoreExistingProducts: true,
	})

	if (typeof sessionId !== 'string' || !sessionId.trim()) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'sessionId is required.',
		)
	}

	const mapping = readMapping(mappingRaw)
	const session = await loadSession(tenantId, sessionId.trim())

	session.mapping = mapping
	await session.save()
	const rows = flattenSessionRows(session)
	const sessionProductIds = rows.flatMap(row =>
		rowProductIds(session.sessionId, row),
	)
	const existingBarcodes = await foreignBarcodes(tenantId, sessionProductIds)
	const matchCatalog = await catalogMatcher(tenantId)
	const { mapped, valid, duplicates, invalid } = summarizeRows(
		mapSourceRows(rows, mapping, existingBarcodes, matchCatalog),
	)

	return {
		sessionId: session.sessionId,
		fileCount: session.files.length,
		detected: mapped.length,
		valid: valid.length,
		duplicates: duplicates.length,
		invalid: invalid.length,
		preview: valid.slice(0, PRODUCT_IMPORT_LIMITS.previewRows).map(row => ({
			name: row.name,
			internalCode: row.internalCode,
			barcode: row.barcode,
			purchasePrice: row.purchasePrice,
			retailPrice: row.retailPrice,
			quantity: row.quantity,
		})),
		errors: [...invalid, ...duplicates].slice(0, 100).map(row => ({
			fileName: row.fileName,
			rowNumber: row.rowNumber,
			errors: row.errors,
			warnings: row.warnings,
		})),
		warnings: mapped
			.filter(row => row.warnings.length)
			.slice(0, 50)
			.map(row => ({
				fileName: row.fileName,
				rowNumber: row.rowNumber,
				warnings: row.warnings,
			})),
	}
}

export const commitProductImport = async (
	requestContext: RequestContext,
	sessionId: unknown,
	mappingRaw: unknown,
	offsetRaw: unknown,
	limitRaw: unknown,
	invalidateCaches: () => Promise<void>,
) => {
	const tenantId = await assertImportAllowed(requestContext, {
		ignoreExistingProducts: true,
	})

	await ensureTenantAccess(requestContext, COLLECTION_NAMES.INVENTORY)

	if (typeof sessionId !== 'string' || !sessionId.trim()) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'sessionId is required.',
		)
	}

	const mapping = readMapping(mappingRaw)
	const session = await loadSession(tenantId, sessionId.trim())
	const rows = flattenSessionRows(session)
	const sessionProductIds = rows.flatMap(row =>
		rowProductIds(session.sessionId, row),
	)
	const sessionStarted = sessionProductIds.length
		? await withTenantScope(
				Product.findOne({ productId: { $in: sessionProductIds } })
					.select({ productId: 1 })
					.lean(),
				tenantId,
			)
		: null

	if (!sessionStarted) {
		const productCount = await Product.countDocuments().setOptions({
			__tenantContext: { tenantId },
		})

		if (productCount > 0) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Existing products found (${productCount}). Delete them from the Products page before importing.`,
			)
		}
	}

	const matchCatalog = await catalogMatcher(tenantId)
	const existingBarcodes = await foreignBarcodes(tenantId, sessionProductIds)
	const { valid, duplicates, invalid } = summarizeRows(
		mapSourceRows(rows, mapping, existingBarcodes, matchCatalog),
	)
	const offset = readBatchOffset(offsetRaw)
	const limit = readBatchLimit(limitRaw)
	const batch = valid.slice(offset, offset + limit)
	const productIds = batch.map(row => importProductId(session.sessionId, row))
	const alreadyImported = new Set(
		productIds.length
			? (
					await withTenantScope(
						Product.find({
							productId: {
								$in: batch.flatMap(row =>
									rowProductIds(session.sessionId, row),
								),
							},
						})
							.select({ productId: 1 })
							.lean(),
						tenantId,
					)
				).map(item => item.productId)
			: [],
	)
	const createdByBase = {
		_id: requestContext.userId ?? '',
		displayName:
			`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim() ||
			'Import',
		role: requestContext.user?.role ?? requestContext.role,
		createdAt: new Date(),
	}
	const products = batch.flatMap((row, index) => {
		const productId = productIds[index]

		if (
			rowProductIds(session.sessionId, row).some(id => alreadyImported.has(id))
		) {
			return []
		}

		return [
			{
				tenantId,
				productId,
				name: row.name,
				latinName: row.latinName,
				barcode: row.barcode?.trim() || productId,
				internalCode: row.internalCode?.trim(),
				productFactoryCode: row.productFactoryCode?.trim(),
				categoryId: row.categoryId,
				supplierId: row.supplierId,
				description: row.description,
				price: {
					retailPrice: row.retailPrice,
					purchasePrice: row.purchasePrice,
					wholesalePrice: row.wholesalePrice,
					currency: 'SYP',
				},
				status: 'active' as const,
				createdBy: { ...createdByBase },
			},
		]
	})
	const quantityByProductId = new Map(
		batch.map((row, index) => [productIds[index], row.quantity]),
	)
	const inventories = products.map(product => ({
		tenantId,
		inventoryId: uuidv4(),
		productId: product.productId,
		quantity: quantityByProductId.get(product.productId) ?? 0,
		createdBy: { ...createdByBase },
	}))

	if (products.length) {
		const mongoSession = await mongoose.startSession()

		try {
			await mongoSession.withTransaction(async () => {
				await Product.insertMany(products, {
					session: mongoSession,
					ordered: true,
				})

				await Inventory.insertMany(inventories, {
					session: mongoSession,
					ordered: true,
				})
			})
		} finally {
			await mongoSession.endSession()
		}
	}

	const reachedEnd =
		valid.length > 0 &&
		offset < valid.length &&
		offset + batch.length >= valid.length
	const processed = reachedEnd
		? valid.length
		: Math.min(offset + batch.length, valid.length)

	if (reachedEnd) {
		await setTenantImportStatus(tenantId, PRODUCT_IMPORT_STATUS.COMPLETED)
		session.status = PRODUCT_IMPORT_STATUS.COMPLETED
		await session.save()
		await invalidateCaches()
	}

	return {
		imported: batch.length,
		processed,
		total: valid.length,
		done: reachedEnd,
		duplicates: duplicates.length,
		invalid: invalid.length,
		errors: invalid
			.map(row => ({
				fileName: row.fileName,
				rowNumber: row.rowNumber,
				errors: row.errors,
			}))
			.slice(0, 100),
	}
}

const readBatchOffset = (value: unknown) => {
	const offset = typeof value === 'number' ? value : Number(value)

	if (!Number.isFinite(offset) || offset < 0) return 0

	return Math.floor(offset)
}

const readBatchLimit = (value: unknown) => {
	const limit = typeof value === 'number' ? value : Number(value)

	if (!Number.isFinite(limit) || limit <= 0) {
		return PRODUCT_IMPORT_LIMITS.commitBatchSize
	}

	return Math.min(Math.floor(limit), PRODUCT_IMPORT_LIMITS.maxCommitBatchSize)
}

const REFERENCE_REASON: Record<string, string> = {
	invoice: 'This product is used on a selling invoice and cannot be deleted.',
	buyingInvoice:
		'This product is used on a buying invoice and cannot be deleted.',
	order: 'This product is used on an order and cannot be deleted.',
	stockMoving: 'This product has stock movements and cannot be deleted.',
}

export const findProductDeleteBlocks = async (
	tenantId: string,
	productIds: string[],
) => {
	const ids = [...new Set(productIds.filter(Boolean))]
	const blocked = new Map<string, string>()
	const mark = (id: string, reason: string) => {
		if (!blocked.has(id)) blocked.set(id, reason)
	}

	const [invoices, buying, sellingItems, orders, movings] = await Promise.all([
		withTenantScope(
			Invoice.find({ 'items.productId': { $in: ids } })
				.select({ items: 1 })
				.lean(),
			tenantId,
		),
		withTenantScope(
			BuyingInvoice.find({ 'items.productId': { $in: ids } })
				.select({ items: 1 })
				.lean(),
			tenantId,
		),
		withTenantScope(
			SellingInvoiceItem.find({ 'items.productId': { $in: ids } })
				.select({ items: 1 })
				.lean(),
			tenantId,
		),
		withTenantScope(
			Order.find({ 'items.productId': { $in: ids } })
				.select({ items: 1 })
				.lean(),
			tenantId,
		),
		withTenantScope(
			StockMoving.find({ productId: { $in: ids } })
				.select({ productId: 1 })
				.lean(),
			tenantId,
		),
	])

	for (const invoice of invoices) {
		for (const item of invoice.items ?? []) {
			if (ids.includes(item.productId))
				mark(item.productId, REFERENCE_REASON.invoice)
		}
	}

	for (const invoice of sellingItems) {
		for (const item of invoice.items ?? []) {
			if (ids.includes(item.productId))
				mark(item.productId, REFERENCE_REASON.invoice)
		}
	}

	for (const invoice of buying) {
		for (const item of invoice.items ?? []) {
			if (ids.includes(item.productId)) {
				mark(item.productId, REFERENCE_REASON.buyingInvoice)
			}
		}
	}

	for (const order of orders) {
		for (const item of order.items ?? []) {
			if (ids.includes(item.productId))
				mark(item.productId, REFERENCE_REASON.order)
		}
	}

	for (const moving of movings) {
		mark(moving.productId, REFERENCE_REASON.stockMoving)
	}

	return blocked
}

export const assertProductDeletable = async (
	tenantId: string,
	productId: string,
) => {
	const blocked = await findProductDeleteBlocks(tenantId, [productId])
	const reason = blocked.get(productId)

	if (reason) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			reason,
		)
	}
}

export const deleteProductInventory = async (
	tenantId: string,
	productIds: string[],
) => {
	await Inventory.deleteMany({ productId: { $in: productIds } }).setOptions({
		__tenantContext: { tenantId },
	})
}
