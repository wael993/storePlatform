import ProductController from '../api.controller'
import {
	commitProductImport,
	confirmProductImportMasterData,
	getProductImportStatus,
	parseProductImportFiles,
	prepareProductImportMasterData,
	previewProductImport,
	skipProductImport,
} from '../../shared/productImport/service'
import { RequestContext } from '../../shared/types'

export default class ProductImportController {
	public constructor(private productController: ProductController) {}

	public getStatus(requestContext: RequestContext) {
		return getProductImportStatus(requestContext)
	}

	public skip(requestContext: RequestContext) {
		return skipProductImport(requestContext)
	}

	public parse(
		requestContext: RequestContext,
		files: Array<{
			fileBase64?: unknown
			mimeType?: unknown
			fileName?: unknown
		}>,
		currency: unknown,
		selectedFields?: unknown,
	) {
		return parseProductImportFiles(
			requestContext,
			files,
			currency,
			selectedFields,
		)
	}

	public prepareMasterData(
		requestContext: RequestContext,
		sessionId: unknown,
		mapping: unknown,
	) {
		return prepareProductImportMasterData(requestContext, sessionId, mapping)
	}

	public confirmMasterData(
		requestContext: RequestContext,
		sessionId: unknown,
		decisions: unknown,
	) {
		return this.invalidatingCache(requestContext, () =>
			confirmProductImportMasterData(requestContext, sessionId, decisions),
		)
	}

	public preview(
		requestContext: RequestContext,
		sessionId: unknown,
		mapping: unknown,
		currency: unknown,
	) {
		return previewProductImport(requestContext, sessionId, mapping, currency)
	}

	public commit(
		requestContext: RequestContext,
		sessionId: unknown,
		mapping: unknown,
		offset: unknown,
		limit: unknown,
		currency: unknown,
	) {
		return this.invalidatingCache(requestContext, () =>
			commitProductImport(
				requestContext,
				sessionId,
				mapping,
				offset,
				limit,
				currency,
			),
		)
	}

	// every batch commits (or rolls back) products and master rows: drop the cache either way
	private async invalidatingCache<T>(
		requestContext: RequestContext,
		run: () => Promise<T>,
	): Promise<T> {
		try {
			return await run()
		} finally {
			await this.productController.invalidateEntityCache(requestContext)
		}
	}
}
