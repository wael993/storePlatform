import { v4 as uuidv4 } from 'uuid'

import { Report } from '../../models/Report'
import MongodbController from '../../shared/mongodb/mongodbController'
import { COLLECTION_NAMES } from '../../shared/general'
import { getTenantContext } from '../../shared/tenant'
import { analyzeBusinessQuestion } from '../../shared/reportAi/chat'
import { ReportRequestBody, RequestContext } from '../../shared/types'

export default class ReportController {
	public constructor(private mongoDbClient: MongodbController) {}

	public async getReports(requestContext: RequestContext) {
		const reports = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.REPORTS,
			model: Report,
			sort: { createdAt: 'desc' },
		})

		return reports.documents
	}

	public async getReport(reportId: string, requestContext: RequestContext) {
		return this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.REPORTS,
			Report,
			{ fieldName: 'reportId', fieldValue: reportId },
		)
	}

	public async postReport(
		requestBody: ReportRequestBody,
		requestContext: RequestContext,
	) {
		const reportData = {
			reportId: uuidv4(),
			name: requestBody.name,
			type: requestBody.type,
			periodStart: requestBody.periodStart,
			periodEnd: requestBody.periodEnd,
			data: requestBody.data,
		}

		const createReportResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.REPORTS, data: reportData },
			Report,
			requestContext,
		)

		return { _id: createReportResponse._id }
	}

	public async patchReport(
		reportId: string,
		requestBody: Partial<ReportRequestBody>,
		requestContext: RequestContext,
	) {
		return this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.REPORTS, id: reportId },
			requestContext,
			Report,
			requestBody,
		)
	}

	public async deleteReport(reportId: string, requestContext: RequestContext) {
		return this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.REPORTS, id: reportId },
			requestContext,
			Report,
		)
	}

	public async postReportChat(
		requestBody: Record<string, unknown>,
		requestContext: RequestContext,
	) {
		const tenantId = getTenantContext(requestContext).tenantId

		return analyzeBusinessQuestion(tenantId, requestBody.messages)
	}
}
