import { config } from '../../config/config'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { normalizeEasternNumerals } from './intent'
import { getReportAiProvider } from './providers'
import { canRunReportTool, isReportToolName, runReportTool } from './tools'
import { ReportAiAuth, ReportChatMessage, ReportToolName } from './types'

const MAX_MESSAGES = 16
const MAX_CONTENT = 4000

export const analyzeBusinessQuestion = async (
	tenantId: string,
	messages: unknown,
	auth: ReportAiAuth,
	now = new Date(),
): Promise<{ reply: string }> => {
	if (!Array.isArray(messages) || !messages.length) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'messages is required.',
		)
	}

	const chat: ReportChatMessage[] = messages.slice(-MAX_MESSAGES).map(row => {
		const record =
			row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
		const role = record.role === 'assistant' ? 'assistant' : 'user'
		const content =
			typeof record.content === 'string'
				? normalizeEasternNumerals(record.content).trim().slice(0, MAX_CONTENT)
				: ''

		return { role, content }
	})

	if (
		!chat[chat.length - 1]?.content ||
		chat[chat.length - 1].role !== 'user'
	) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'The last message must be a non-empty user question.',
		)
	}

	const reply = await getReportAiProvider().answer({
		messages: chat.filter(message => message.content),
		runTool: async (name: ReportToolName, args) => {
			if (!isReportToolName(name)) {
				return { error: `Unknown tool ${name}` }
			}

			if (!canRunReportTool(auth, name)) {
				return { error: 'unauthorized' }
			}

			return JSON.parse(
				JSON.stringify(
					await runReportTool(tenantId, name, args ?? {}, now, auth),
				),
			)
		},
		now,
		timezone: config.cron.timezone,
	})

	return { reply }
}
