export const IMPORT_AI_PROVIDERS = ['mock', 'openai', 'gemini'] as const

export type ImportAiProviderName = (typeof IMPORT_AI_PROVIDERS)[number]

export type ImportAiHeaderSuggestion = {
	field: string
	header: string
}

export interface ImportAiProvider {
	mapProductHeaders(input: {
		headers: string[]
		fields: string[]
	}): Promise<ImportAiHeaderSuggestion[]>
}
