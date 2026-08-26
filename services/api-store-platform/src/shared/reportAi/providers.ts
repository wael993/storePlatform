import { config } from '../../config/config'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import logger, { EntityType } from '../logger/logger'
import {
	classifyRivoIntent,
	detectRivoLanguage,
	rivoPersonaReply,
	rivoSystemPrompt,
	switchTargetLanguage,
	type RivoLang,
} from './intent'
import {
	ReportAiProvider,
	ReportAiProviderName,
	ReportChatMessage,
	ReportToolName,
} from './types'

const PROVIDER_TIMEOUT_MS = 20_000

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
		name: 'businessWatch',
		description:
			'What deserves attention now: low stock, sales/profit change vs prior 30 days, unpaid customer balances. Call on greetings or "what should I watch".',
		parameters: { type: 'object', properties: {} },
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

const EMPTY_DATA: Record<RivoLang, string> = {
	ar: 'ما لقيت بيانات تجارية مطابقة لهالسؤال.',
	en: 'I could not find matching business data for that question.',
	de: 'Ich habe keine passenden Geschäftsdaten zu dieser Frage gefunden.',
}

const UNFINISHED: Record<RivoLang, string> = {
	ar: 'ما قدرت أكمّل التحليل. جرّب فترة أقصر.',
	en: 'I could not finish that analysis. Try a narrower date range.',
	de: 'Ich konnte die Analyse nicht abschließen. Bitte einen kürzeren Zeitraum wählen.',
}

const replyLang = (messages: ReportChatMessage[]): RivoLang =>
	detectRivoLanguage(messages[messages.length - 1]?.content ?? '')

const formatMockWatch = (result: unknown, lang: RivoLang): string => {
	const record = asRecord(result)
	const items = Array.isArray(record?.items) ? record.items : []
	const empty = {
		ar: 'راقبت تجارتك. ما في شي بارز يستاهل انتباهك هلق.',
		en: 'I monitored your business. Nothing unusual stands out right now.',
		de: 'Ich habe Ihr Geschäft geprüft. Im Moment fällt nichts Ungewöhnliches auf.',
	}
	const intro = {
		ar: 'راقبت تجارتك. هدول النقاط تستاهل انتباهك:',
		en: 'I monitored your business. Here’s what deserves your attention:',
		de: 'Ich habe Ihr Geschäft geprüft. Das verdient Ihre Aufmerksamkeit:',
	}
	const partial = {
		ar: 'بعض الأرقام ما قدرت تتحمّل. اللي ظاهر هون مو الصورة الكاملة.',
		en: 'Some figures could not be loaded. This is not the full picture.',
		de: 'Einige Zahlen konnten nicht geladen werden. Das ist nicht das vollständige Bild.',
	}
	const partialLine = record?.partial ? partial[lang] : ''

	if (!items.length) return partialLine || empty[lang]

	const lines = items.map(item => {
		const row = asRecord(item)
		const kind = asString(row?.kind)
		const count = Number(row?.count) || 0
		const percent = Number(row?.percent) || 0
		const topName = asString(row?.topName) || ''

		if (kind === 'lowStock') {
			const n = row?.truncated ? `${count}+` : String(count)

			return lang === 'de'
				? `${n} Produkte gehen zur Neige.`
				: lang === 'en'
					? `${n} products may be running low.`
					: `${n} منتجات قرب يخلص مخزونها.`
		}

		if (kind === 'salesChange' || kind === 'profitChange') {
			const up = percent >= 0
			const n = Math.abs(percent)

			if (kind === 'salesChange') {
				return lang === 'de'
					? `Umsatz ${up ? 'plus' : 'minus'} ${n}%.`
					: lang === 'en'
						? `Sales ${up ? 'up' : 'down'} ${n}%.`
						: `المبيعات ${up ? 'ارتفعت' : 'نزلت'} ${n}%.`
			}

			return lang === 'de'
				? `Gewinn ${up ? 'plus' : 'minus'} ${n}%.`
				: lang === 'en'
					? `Profit ${up ? 'up' : 'down'} ${n}%.`
					: `الربح ${up ? 'ارتفع' : 'نزل'} ${n}%.`
		}

		if (kind === 'outstanding') {
			return lang === 'de'
				? `${count} Kunden mit offenen Rechnungen. Höchster: ${topName}.`
				: lang === 'en'
					? `${count} customers have unpaid invoices. Highest: ${topName}.`
					: `${count} زبائن عليهم دين. الأكثر: ${topName}.`
		}

		return ''
	})

	return [intro[lang], ...lines.filter(Boolean), partialLine]
		.filter(Boolean)
		.join('\n')
}

const lastMonthRange = (now: Date) => {
	const end = now.toISOString().slice(0, 10)
	const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10)

	return { startDate: start, endDate: end }
}

const pickMockTool = (question: string): ReportToolName => {
	if (
		/customer|outstanding|receivable|owed|زبون|عميل|دين|مستحق/.test(question)
	) {
		return 'topCustomersByOutstanding'
	}

	if (/supplier|buy|purchase|مورد|شراء|مشتريات|اشتري/.test(question)) {
		return /most|top|best|أكثر|اكتر/.test(question)
			? 'topSuppliers'
			: 'purchaseSummary'
	}

	if (/profit|ربح|أرباح/.test(question)) return 'profitSummary'

	if (/best.?sell|top.?product|sold|أكثر.*بيع|اكتر.*بيع/.test(question)) {
		return 'topSellingProducts'
	}

	return 'salesSummary'
}

const mockProvider = (): ReportAiProvider => ({
	async answer({ messages, runTool, now }) {
		const last = messages[messages.length - 1]?.content ?? ''
		const intent = classifyRivoIntent(last)
		const lang =
			intent === 'language_switch'
				? switchTargetLanguage(last)
				: detectRivoLanguage(last)

		if (intent === 'insult') {
			const insultTurns = messages.filter(
				message =>
					message.role === 'user' &&
					classifyRivoIntent(message.content) === 'insult',
			).length

			return rivoPersonaReply('insult', lang, insultTurns >= 2)
		}

		if (
			intent === 'identity' ||
			intent === 'off_topic' ||
			intent === 'language_switch'
		) {
			return rivoPersonaReply(intent, lang)
		}

		if (intent === 'watch') {
			return formatMockWatch(await runTool('businessWatch', {}), lang)
		}

		const question = last.toLowerCase()
		const today = now.toISOString().slice(0, 10)
		const range =
			/اليوم|today|heute/.test(question) &&
			!/شهر|month|monat|أسبوع|week/.test(question)
				? { startDate: today, endDate: today }
				: lastMonthRange(now)
		const tool = pickMockTool(question)
		const result = await runTool(tool, {
			...(tool === 'topCustomersByOutstanding' ? {} : range),
			limit: 5,
			supplierName: last.match(/supplier\s+(.+)$/i)?.[1],
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
				{ role: 'system', content: rivoSystemPrompt(now, timezone) },
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
					return content || EMPTY_DATA[replyLang(messages)]
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

			return UNFINISHED[replyLang(messages)]
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
							parts: [{ text: rivoSystemPrompt(now, timezone) }],
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
					return text || EMPTY_DATA[replyLang(messages)]
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

			return UNFINISHED[replyLang(messages)]
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
