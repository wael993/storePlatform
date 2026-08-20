import { config } from '../../config/config'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import logger, { EntityType } from '../logger/logger'
import {
	ReportAiProvider,
	ReportAiProviderName,
	ReportChatMessage,
	ReportToolName,
} from './types'

const PROVIDER_TIMEOUT_MS = 20_000

const ASSISTANT_NAME = 'Zain'

const SYSTEM_PROMPT = (
	now: Date,
	timezone: string,
) => `You are ${ASSISTANT_NAME}, a read-only business assistant for this store tenant.
Today is ${now.toISOString().slice(0, 10)} (${timezone}).
Identity: your name is ${ASSISTANT_NAME}. You help tenant users understand sales, products, suppliers, invoices, customers, and profit. You cannot create, edit, or delete records. You only see this tenant's data.
If the user asks your name, who you are, or what you can do, answer from this profile. Do not call tools for that.
For business numbers, call tools. Never invent numbers, products, suppliers, or customers.
If tools return empty data, say the data is not available for that period.
Convert natural-language dates to YYYY-MM-DD startDate/endDate before calling tools. For current outstanding balances, omit dates unless the user named a period.
Use the user's follow-up context. Answer in the user's language. Do not mention tools, SQL, or databases.
Keep answers short and professional.`

const TOOL_SPECS: Array<{
	name: ReportToolName
	description: string
	parameters: Record<string, unknown>
}> = [
	{
		name: 'topSellingProducts',
		description: 'Top products by quantity sold in a date range.',
		parameters: {
			type: 'object',
			properties: {
				startDate: { type: 'string', description: 'YYYY-MM-DD' },
				endDate: { type: 'string', description: 'YYYY-MM-DD' },
				limit: { type: 'integer', minimum: 1, maximum: 20 },
			},
		},
	},
	{
		name: 'salesSummary',
		description: 'Selling invoice count and revenue in a date range.',
		parameters: {
			type: 'object',
			properties: {
				startDate: { type: 'string' },
				endDate: { type: 'string' },
			},
		},
	},
	{
		name: 'purchaseSummary',
		description: 'Buying invoice spend, optionally filtered by supplier name.',
		parameters: {
			type: 'object',
			properties: {
				startDate: { type: 'string' },
				endDate: { type: 'string' },
				supplierName: { type: 'string' },
			},
		},
	},
	{
		name: 'profitSummary',
		description: 'Revenue minus cost of goods sold for a date range.',
		parameters: {
			type: 'object',
			properties: {
				startDate: { type: 'string' },
				endDate: { type: 'string' },
			},
		},
	},
	{
		name: 'topSuppliers',
		description: 'Suppliers ranked by purchase spend in a date range.',
		parameters: {
			type: 'object',
			properties: {
				startDate: { type: 'string' },
				endDate: { type: 'string' },
				limit: { type: 'integer', minimum: 1, maximum: 20 },
			},
		},
	},
	{
		name: 'topCustomersByOutstanding',
		description:
			'Customers ranked by current unpaid selling-invoice balance. Omit dates for all open invoices; dates filter by invoice issue date.',
		parameters: {
			type: 'object',
			properties: {
				startDate: { type: 'string' },
				endDate: { type: 'string' },
				limit: { type: 'integer', minimum: 1, maximum: 20 },
			},
		},
	},
]

const requireConfig = (ok: boolean, message: string) => {
	if (!ok) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			message,
		)
	}
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null

const asString = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null

const lastMonthRange = (now: Date) => {
	const end = now.toISOString().slice(0, 10)
	const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10)

	return { startDate: start, endDate: end }
}

const mockProvider = (): ReportAiProvider => ({
	async answer({ messages, runTool, now }) {
		const question = messages[messages.length - 1]?.content.toLowerCase() ?? ''

		if (/your name|who are you|what can you|what do you do/.test(question)) {
			return `I am ${ASSISTANT_NAME}. I can answer questions about this store's sales, products, suppliers, invoices, customers, and profit. I cannot change any records.`
		}

		const range = lastMonthRange(now)
		const tool: ReportToolName = /customer|outstanding|receivable|owed/.test(
			question,
		)
			? 'topCustomersByOutstanding'
			: /supplier|buy|purchase/.test(question)
				? /most|top|best/.test(question)
					? 'topSuppliers'
					: 'purchaseSummary'
				: /profit/.test(question)
					? 'profitSummary'
					: /best.?sell|top.?product|sold/.test(question)
						? 'topSellingProducts'
						: 'salesSummary'
		const result = await runTool(tool, {
			...(tool === 'topCustomersByOutstanding' ? {} : range),
			limit: 5,
			supplierName: question.match(/supplier\s+(.+)$/)?.[1],
		})

		return JSON.stringify({ tool, result }, null, 2)
	},
})

const providerFetch = async (
	url: string,
	init: RequestInit,
): Promise<Response> => {
	let response: Response

	try {
		response = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
		})
	} catch (error) {
		if (error instanceof BusinessLogicError) throw error

		logger.warn(
			`Report AI provider request failed: ${error instanceof Error ? error.message : 'unknown'}`,
			{ entity: EntityType.STORAGE },
		)

		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Report AI failed.',
		)
	}

	if (!response.ok) {
		const detail = await response.text()

		logger.warn(
			`Report AI provider ${response.status}: ${detail.slice(0, 280)}`,
			{
				entity: EntityType.STORAGE,
			},
		)

		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Report AI failed.',
		)
	}

	return response
}

const openaiTools = TOOL_SPECS.map(spec => ({
	type: 'function',
	function: {
		name: spec.name,
		description: spec.description,
		parameters: spec.parameters,
	},
}))

const openaiProvider = (): ReportAiProvider => {
	const apiKey = config.aiReport.openai.apiKey
	const model = config.aiReport.openai.model

	return {
		async answer({ messages, runTool, now, timezone }) {
			requireConfig(Boolean(apiKey), 'OPENAI_API_KEY is required.')

			const history: Array<Record<string, unknown>> = [
				{ role: 'system', content: SYSTEM_PROMPT(now, timezone) },
				...messages.map(message => ({
					role: message.role,
					content: message.content,
				})),
			]

			for (let round = 0; round < 4; round += 1) {
				const response = await providerFetch(
					'https://api.openai.com/v1/chat/completions',
					{
						method: 'POST',
						headers: {
							Authorization: `Bearer ${apiKey}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							model,
							temperature: 0,
							messages: history,
							tools: openaiTools,
						}),
					},
				)

				const payload = (await response.json()) as Record<string, unknown>
				const choices = Array.isArray(payload.choices) ? payload.choices : []
				const message = asRecord(asRecord(choices[0])?.message)
				const content = asString(message?.content)
				const toolCalls = Array.isArray(message?.tool_calls)
					? message.tool_calls
					: []

				if (!toolCalls.length) {
					return (
						content ||
						'I could not find matching business data for that question.'
					)
				}

				history.push(message as Record<string, unknown>)

				for (const call of toolCalls) {
					const item = asRecord(call)
					const fn = asRecord(item?.function)
					const name = asString(fn?.name) as ReportToolName | null
					let args: Record<string, unknown> = {}

					try {
						args = asRecord(JSON.parse(asString(fn?.arguments) ?? '{}')) ?? {}
					} catch {
						args = {}
					}

					const result = name
						? await runTool(name, args)
						: { error: 'Unknown tool' }

					history.push({
						role: 'tool',
						tool_call_id: asString(item?.id),
						content: JSON.stringify(result),
					})
				}
			}

			return 'I could not finish that analysis. Try a narrower date range.'
		},
	}
}

const geminiProvider = (): ReportAiProvider => {
	const apiKey = config.aiReport.gemini.apiKey
	const model = config.aiReport.gemini.model

	const toContents = (messages: ReportChatMessage[]) =>
		messages.map(message => ({
			role: message.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: message.content }],
		}))

	return {
		async answer({ messages, runTool, now, timezone }) {
			requireConfig(Boolean(apiKey), 'GEMINI_API_KEY is required.')

			const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
			const contents: Array<Record<string, unknown>> = toContents(messages)

			for (let round = 0; round < 4; round += 1) {
				const response = await providerFetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						systemInstruction: {
							parts: [{ text: SYSTEM_PROMPT(now, timezone) }],
						},
						generationConfig: { temperature: 0 },
						tools: [
							{
								functionDeclarations: TOOL_SPECS.map(spec => ({
									name: spec.name,
									description: spec.description,
									parameters: spec.parameters,
								})),
							},
						],
						contents,
					}),
				})

				const payload = (await response.json()) as Record<string, unknown>
				const candidates = Array.isArray(payload.candidates)
					? payload.candidates
					: []
				const content = asRecord(asRecord(candidates[0])?.content)
				const parts = Array.isArray(content?.parts) ? content.parts : []
				const functionCalls = parts
					.map(part => asRecord(asRecord(part)?.functionCall))
					.filter(Boolean) as Array<Record<string, unknown>>
				const text = parts
					.map(part => asString(asRecord(part)?.text))
					.filter(Boolean)
					.join('\n')
					.trim()

				if (!functionCalls.length) {
					return (
						text || 'I could not find matching business data for that question.'
					)
				}

				contents.push({ role: 'model', parts })

				const responses = []

				for (const call of functionCalls) {
					const name = asString(call.name) as ReportToolName | null
					const args = asRecord(call.args) ?? {}
					const result = name
						? await runTool(name, args)
						: { error: 'Unknown tool' }

					responses.push({
						functionResponse: {
							name: name ?? 'unknown',
							response: result,
						},
					})
				}

				contents.push({ role: 'user', parts: responses })
			}

			return 'I could not finish that analysis. Try a narrower date range.'
		},
	}
}

export const getReportAiProvider = (): ReportAiProvider => {
	const name = config.aiReport.provider as ReportAiProviderName

	if (name === 'openai') return openaiProvider()

	if (name === 'gemini') return geminiProvider()

	if (name === 'mock') return mockProvider()

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		`Unknown AI_REPORT_PROVIDER "${config.aiReport.provider}". Use mock, openai, or gemini.`,
	)
}
