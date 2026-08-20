export const REPORT_AI_PROVIDERS = ['mock', 'openai', 'gemini'] as const

export type ReportAiProviderName = (typeof REPORT_AI_PROVIDERS)[number]

export type ReportChatRole = 'user' | 'assistant'

export type ReportChatMessage = {
	role: ReportChatRole
	content: string
}

export type ReportToolName =
	| 'topSellingProducts'
	| 'salesSummary'
	| 'purchaseSummary'
	| 'profitSummary'
	| 'topSuppliers'
	| 'topCustomersByOutstanding'

export type ReportToolRunner = (
	name: ReportToolName,
	args: Record<string, unknown>,
) => Promise<unknown>

export interface ReportAiProvider {
	answer(input: {
		messages: ReportChatMessage[]
		runTool: ReportToolRunner
		now: Date
		timezone: string
	}): Promise<string>
}
