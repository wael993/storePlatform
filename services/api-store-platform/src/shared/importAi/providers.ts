import { config } from '../../config/config'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { PRODUCT_IMPORT_FIELDS } from '../constants/productImport'
import { suggestHeaderMapping } from '../productImport/mapRows'
import {
	ImportAiProvider,
	ImportAiProviderName,
	ImportAiHeaderSuggestion,
} from './types'

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null

const asString = (value: unknown): string | null => {
	if (typeof value === 'string') {
		const trimmed = value.trim()

		return trimmed.length ? trimmed : null
	}

	if (typeof value === 'number' && Number.isFinite(value)) return String(value)

	return null
}

const parseJsonObject = (text: string): Record<string, unknown> => {
	try {
		const parsed: unknown = JSON.parse(text)

		return asRecord(parsed) ?? {}
	} catch {
		return {}
	}
}

const requireConfig = (ok: boolean, message: string) => {
	if (!ok) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			message,
		)
	}
}

const heuristicSuggestions = (
	headers: string[],
): ImportAiHeaderSuggestion[] => {
	const mapping = suggestHeaderMapping(headers)

	return PRODUCT_IMPORT_FIELDS.flatMap(field => {
		const header = mapping[field]

		return header ? [{ field, header }] : []
	})
}

const parseSuggestions = (
	payload: unknown,
	headers: Set<string>,
	fields: Set<string>,
): ImportAiHeaderSuggestion[] => {
	const record = asRecord(payload)
	const mappings = Array.isArray(record?.mappings) ? record.mappings : []

	return mappings.flatMap(item => {
		const row = asRecord(item)
		const field = asString(row?.field)
		const header = asString(row?.header)

		if (!field || !header || !fields.has(field) || !headers.has(header)) {
			return []
		}

		return [{ field, header }]
	})
}

const mockProvider = (): ImportAiProvider => ({
	async mapProductHeaders({ headers }) {
		return heuristicSuggestions(headers)
	},
})

const openaiProvider = (): ImportAiProvider => {
	const apiKey = config.aiImport.openai.apiKey
	const model = config.aiImport.openai.model

	const complete = async (prompt: string) => {
		requireConfig(Boolean(apiKey), 'OPENAI_API_KEY is required.')

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model,
				temperature: 0,
				response_format: { type: 'json_object' },
				messages: [{ role: 'user', content: prompt }],
			}),
		})

		if (!response.ok) {
			const detail = await response.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Product import AI failed (${response.status}). ${detail.slice(0, 280)}`,
			)
		}

		const payload = (await response.json()) as Record<string, unknown>
		const choices = Array.isArray(payload.choices) ? payload.choices : []
		const message = asRecord(asRecord(choices[0])?.message)
		const text = asString(message?.content) ?? '{}'

		return parseJsonObject(text)
	}

	return {
		async mapProductHeaders({ headers, fields }) {
			const json = await complete(
				`Map file headers to product fields. Return JSON {"mappings":[{"field":"...","header":"..."}]}.
Only use these fields: ${fields.join(', ')}.
Only use these headers: ${headers.join(', ')}.
Do not invent fields. Leave unmatched fields out.`,
			)

			return parseSuggestions(json, new Set(headers), new Set(fields))
		},
	}
}

const geminiProvider = (): ImportAiProvider => {
	const apiKey = config.aiImport.gemini.apiKey
	const model = config.aiImport.gemini.model

	const generate = async (prompt: string) => {
		requireConfig(
			Boolean(apiKey),
			'GEMINI_IMPORT_API_KEY or GEMINI_API_KEY is required.',
		)

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				generationConfig: {
					temperature: 0,
					responseMimeType: 'application/json',
				},
				contents: [{ role: 'user', parts: [{ text: prompt }] }],
			}),
		})

		if (!response.ok) {
			const detail = await response.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Product import AI failed (${response.status}). ${detail.slice(0, 280)}`,
			)
		}

		const payload = (await response.json()) as Record<string, unknown>
		const candidates = Array.isArray(payload.candidates)
			? payload.candidates
			: []
		const content = asRecord(asRecord(candidates[0])?.content)
		const responseParts = Array.isArray(content?.parts) ? content.parts : []
		const text = asString(asRecord(responseParts[0])?.text) ?? '{}'

		return parseJsonObject(text)
	}

	return {
		async mapProductHeaders({ headers, fields }) {
			const json = await generate(
				`Map file headers to product fields. Return JSON {"mappings":[{"field":"...","header":"..."}]}.
Only use these fields: ${fields.join(', ')}.
Only use these headers: ${headers.join(', ')}.
Do not invent fields. Leave unmatched fields out.`,
			)

			return parseSuggestions(json, new Set(headers), new Set(fields))
		},
	}
}

export const getImportAiProvider = (): ImportAiProvider => {
	const name = config.aiImport.provider as ImportAiProviderName

	if (name === 'openai') return openaiProvider()

	if (name === 'gemini') return geminiProvider()

	if (name === 'mock') return mockProvider()

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		`Unknown AI_IMPORT_PROVIDER "${config.aiImport.provider}". Use mock, openai, or gemini.`,
	)
}
