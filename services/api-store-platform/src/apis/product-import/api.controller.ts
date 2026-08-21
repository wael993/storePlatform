import ProductController from '../api.controller'
import {
	commitProductImport,
	getProductImportStatus,
	parseProductImportFiles,
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
	) {
		return parseProductImportFiles(requestContext, files)
	}

	public preview(
		requestContext: RequestContext,
		sessionId: unknown,
		mapping: unknown,
	) {
		return previewProductImport(requestContext, sessionId, mapping)
	}

	public commit(
		requestContext: RequestContext,
		sessionId: unknown,
		mapping: unknown,
		offset: unknown,
		limit: unknown,
	) {
		return commitProductImport(
			requestContext,
			sessionId,
			mapping,
			offset,
			limit,
			async () => {
				await this.productController.invalidateEntityCache(
					'products',
					requestContext,
				)
				await this.productController.invalidateEntityCache(
					'inventory',
					requestContext,
				)
			},
		)
	}
}
