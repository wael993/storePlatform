import { config } from '../../config/config'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import {
	InvoiceAiProvider,
	InvoiceAiProviderName,
	InvoiceDocumentInput,
	RankMatchHit,
	RankMatchInput,
	RawExtractedField,
	RawInvoiceExtraction,
	RawInvoiceLine,
} from './types'

const emptyField = <T>(): RawExtractedField<T> => ({
	value: null,
	confidence: null,
})

const emptyExtraction = (): RawInvoiceExtraction => ({
	supplierName: emptyField(),
	invoiceNumber: emptyField(),
	invoiceDate: emptyField(),
	vat: emptyField(),
	total: emptyField(),
	supplierVatId: emptyField(),
	items: [],
})

const EXTRACTION_INSTRUCTIONS = `You extract invoice fields from a document image or PDF.
Rules:
- Return JSON only.
- Never invent a value that is not visible on the document.
- If a field is unreadable, handwritten-unclear, or absent, value must be null and confidence 0.
- confidence is 0-1 for how clearly the characters were read, not how plausible the number is.
- Mark isHandwritten true when the field is handwritten.
- invoiceDate must be YYYY-MM-DD or null.
- Numbers must be numeric, not strings.
- Include supplierVatId, and each item barcode/sku, when printed on the document.`

const EXTRACTION_JSON_SHAPE = `{
  "supplierName": { "value": string|null, "confidence": number, "isHandwritten": boolean },
  "invoiceNumber": { "value": string|null, "confidence": number, "isHandwritten": boolean },
  "invoiceDate": { "value": "YYYY-MM-DD"|null, "confidence": number, "isHandwritten": boolean },
  "vat": { "value": number|null, "confidence": number, "isHandwritten": boolean },
  "total": { "value": number|null, "confidence": number, "isHandwritten": boolean },
  "supplierVatId": { "value": string|null, "confidence": number, "isHandwritten": boolean },
  "items": [
    {
      "name": { "value": string|null, "confidence": number, "isHandwritten": boolean },
      "quantity": { "value": number|null, "confidence": number, "isHandwritten": boolean },
      "unit": { "value": string|null, "confidence": number, "isHandwritten": boolean },
      "unitPrice": { "value": number|null, "confidence": number, "isHandwritten": boolean },
      "barcode": { "value": string|null, "confidence": number, "isHandwritten": boolean },
      "sku": { "value": string|null, "confidence": number, "isHandwritten": boolean }
    }
  ]
}`

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

const asNumber = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return value

	if (typeof value === 'string') {
		const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'))

		return Number.isFinite(parsed) ? parsed : null
	}

	return null
}

const asConfidence = (value: unknown): number | null => {
	const parsed = asNumber(value)

	if (parsed == null) return null

	return parsed > 1 ? parsed / 100 : parsed
}

const parseRawField = <T>(
	value: unknown,
	read: (inner: unknown) => T | null,
): RawExtractedField<T> => {
	const record = asRecord(value)

	if (!record) return emptyField()

	return {
		value: read(record.value),
		confidence: asConfidence(record.confidence),
		isHandwritten: record.isHandwritten === true,
	}
}

const parseRawExtraction = (value: unknown): RawInvoiceExtraction => {
	const record = asRecord(value)

	if (!record) return emptyExtraction()

	const itemsRaw = Array.isArray(record.items) ? record.items : []
	const items: RawInvoiceLine[] = itemsRaw.map(item => {
		const row = asRecord(item) ?? {}

		return {
			name: parseRawField(row.name, asString),
			quantity: parseRawField(row.quantity, asNumber),
			unit: parseRawField(row.unit, asString),
			unitPrice: parseRawField(row.unitPrice, asNumber),
			barcode: parseRawField(row.barcode, asString),
			sku: parseRawField(row.sku, asString),
		}
	})

	return {
		supplierName: parseRawField(record.supplierName, asString),
		invoiceNumber: parseRawField(record.invoiceNumber, asString),
		invoiceDate: parseRawField(record.invoiceDate, asString),
		vat: parseRawField(record.vat, asNumber),
		total: parseRawField(record.total, asNumber),
		supplierVatId: parseRawField(record.supplierVatId, asString),
		items,
	}
}

const parseJsonObject = (text: string): unknown => {
	const trimmed = text.trim()
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
	const body = fenced?.[1]?.trim() ?? trimmed

	return JSON.parse(body)
}

const RANK_INSTRUCTIONS = `Rank which catalog candidate matches the invoice entity.
Return JSON {"matches":[{"id":string,"confidence":number}]}.
Only use candidate ids from the list. confidence is 0-1.
Omit candidates that are not the same entity. Never invent ids.`

const parseRankMatches = (
	value: unknown,
	allowed: Set<string>,
): RankMatchHit[] => {
	const record = asRecord(value)
	const rows = Array.isArray(record?.matches)
		? record.matches
		: Array.isArray(value)
			? value
			: []
	const hits: RankMatchHit[] = []

	for (const row of rows) {
		const item = asRecord(row)
		const id = asString(item?.id)
		const confidence = asConfidence(item?.confidence)

		if (!id || !allowed.has(id) || confidence == null || confidence < 0.5) {
			continue
		}

		hits.push({ id, confidence })
	}

	return hits.sort((left, right) => right.confidence - left.confidence)
}

const mockRankScore = (
	query: Record<string, string | null>,
	fields: Record<string, string | null>,
): number => {
	const q = Object.values(query)
		.filter((value): value is string => Boolean(value?.trim()))
		.join(' ')
		.toLowerCase()
	const c = Object.values(fields)
		.filter((value): value is string => Boolean(value?.trim()))
		.join(' ')
		.toLowerCase()

	if (/\bcoca\b/.test(q) && /\bcoke\b/.test(c)) return 0.94

	if (/\bcoke\b/.test(q) && /\bcoca\b/.test(c)) return 0.94

	if (/\bmetro\b/.test(q) && /\bmetro\b/.test(c) && q !== c) return 0.97

	const qTokens = new Set(q.split(/[^a-z0-9]+/).filter(Boolean))
	const cTokens = c.split(/[^a-z0-9]+/).filter(Boolean)
	const shared = cTokens.filter(token => qTokens.has(token)).length

	if (!shared) return 0

	return Math.min(0.88, shared / Math.max(qTokens.size, cTokens.length))
}

const rankMatchPrompt = (input: RankMatchInput) =>
	`${RANK_INSTRUCTIONS}
kind: ${input.kind}
query: ${JSON.stringify(input.query)}
candidates: ${JSON.stringify(input.candidates)}`

const mockProvider = (): InvoiceAiProvider => ({
	async extract() {
		return {
			supplierName: {
				value: 'METRO Cash & Carry GmbH',
				confidence: 0.97,
			},
			invoiceNumber: {
				value: 'INV-1042',
				confidence: 0.94,
			},
			invoiceDate: {
				value: '2026-08-18',
				confidence: 0.91,
			},
			vat: {
				value: 12.5,
				confidence: 0.88,
			},
			total: {
				value: 95.5,
				confidence: 0.96,
			},
			items: [
				{
					name: { value: 'Coca Cola Zero 0.33L', confidence: 0.93 },
					quantity: {
						value: 24,
						confidence: 0.91,
					},
					unit: { value: 'pcs', confidence: 0.9 },
					unitPrice: { value: 0.45, confidence: 0.95 },
				},
				{
					name: { value: 'Sunflower oil 1L', confidence: 0.93 },
					quantity: {
						value: 12,
						confidence: 0.72,
						isHandwritten: true,
					},
					unit: { value: 'pcs', confidence: 0.9 },
					unitPrice: { value: 6.5, confidence: 0.95 },
				},
				{
					name: { value: 'QX-NOMATCH-WIDGET-ZZ', confidence: 0.91 },
					quantity: { value: 1, confidence: 0.9 },
					unit: { value: 'pcs', confidence: 0.9 },
					unitPrice: { value: 3, confidence: 0.9 },
				},
				{
					name: { value: null, confidence: 0.2 },
					quantity: { value: null, confidence: 0.1 },
					unit: { value: null, confidence: null },
					unitPrice: { value: null, confidence: 0.15 },
				},
			],
		}
	},
	async extractRegion() {
		return { value: '12', confidence: 0.72, isHandwritten: true }
	},
	async rankMatch(input) {
		const allowed = new Set(input.candidates.map(candidate => candidate.id))

		return input.candidates
			.map(candidate => ({
				id: candidate.id,
				confidence: mockRankScore(input.query, candidate.fields),
			}))
			.filter(
				row =>
					allowed.has(row.id) &&
					Number.isFinite(row.confidence) &&
					row.confidence >= 0.5,
			)
			.sort((left, right) => right.confidence - left.confidence)
	},
})

const requireConfig = (ok: boolean, message: string) => {
	if (!ok) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			message,
		)
	}
}

const dataUrl = (input: InvoiceDocumentInput) =>
	`data:${input.mimeType};base64,${input.bytes.toString('base64')}`

const azureField = <T>(
	field: Record<string, unknown> | null | undefined,
	read: (field: Record<string, unknown>) => T | null,
	handwritten: boolean,
): RawExtractedField<T> => {
	if (!field) return emptyField()

	return {
		value: read(field),
		confidence: asConfidence(field.confidence),
		isHandwritten: handwritten,
	}
}

const azureString = (field: Record<string, unknown>) =>
	asString(field.valueString ?? field.content)

const azureNumber = (field: Record<string, unknown>) => {
	const currency = asRecord(field.valueCurrency)

	if (currency) {
		return asNumber(currency.amount)
	}

	return asNumber(field.valueNumber ?? field.valueInteger)
}

const azureDate = (field: Record<string, unknown>) =>
	asString(field.valueDate) ?? azureString(field)

const azureProvider = (): InvoiceAiProvider => {
	const endpoint = config.aiInvoice.azure.endpoint.replace(/\/+$/, '')
	const key = config.aiInvoice.azure.key
	const apiVersion = '2024-11-30'

	const analyze = async (
		input: InvoiceDocumentInput,
		modelId: string,
	): Promise<Record<string, unknown>> => {
		requireConfig(
			Boolean(endpoint && key),
			'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY are required.',
		)

		const analyzeUrl = `${endpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=${apiVersion}`
		const started = await fetch(analyzeUrl, {
			method: 'POST',
			headers: {
				'Ocp-Apim-Subscription-Key': key,
				'Content-Type': input.mimeType,
			},
			body: new Uint8Array(input.bytes),
		})

		if (started.status !== 202) {
			const detail = await started.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Invoice extraction failed (${started.status}). ${detail.slice(0, 280)}`,
			)
		}

		const operationLocation = started.headers.get('operation-location')

		if (!operationLocation) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Invoice extraction did not return an operation location.',
			)
		}

		for (let attempt = 0; attempt < 40; attempt += 1) {
			await new Promise(resolve => setTimeout(resolve, 750))
			const polled = await fetch(operationLocation, {
				headers: { 'Ocp-Apim-Subscription-Key': key },
			})
			const payload = (await polled.json()) as Record<string, unknown>
			const status = String(payload.status ?? '')

			if (status === 'succeeded') {
				return asRecord(payload.analyzeResult) ?? payload
			}

			if (status === 'failed') {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Invoice extraction failed.',
				)
			}
		}

		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Invoice extraction timed out.',
		)
	}

	const fromInvoiceResult = (
		result: Record<string, unknown>,
	): RawInvoiceExtraction => {
		const documents = Array.isArray(result.documents) ? result.documents : []
		const document = asRecord(documents[0])
		const fields = asRecord(document?.fields) ?? {}
		const styles = Array.isArray(result.styles) ? result.styles : []
		const handwritten = styles.some(
			style => asRecord(style)?.isHandwritten === true,
		)

		const itemsField = asRecord(fields.Items)
		const itemRows = Array.isArray(itemsField?.valueArray)
			? itemsField.valueArray
			: []

		return {
			supplierName: azureField(
				asRecord(fields.VendorName),
				azureString,
				handwritten,
			),
			invoiceNumber: azureField(
				asRecord(fields.InvoiceId),
				azureString,
				handwritten,
			),
			invoiceDate: azureField(
				asRecord(fields.InvoiceDate),
				azureDate,
				handwritten,
			),
			vat: azureField(asRecord(fields.TotalTax), azureNumber, handwritten),
			total: azureField(
				asRecord(fields.InvoiceTotal),
				azureNumber,
				handwritten,
			),
			supplierVatId: azureField(
				asRecord(fields.VendorTaxId),
				azureString,
				handwritten,
			),
			items: itemRows.map(row => {
				const object =
					asRecord(asRecord(row)?.valueObject) ?? asRecord(row) ?? {}

				return {
					name: azureField(
						asRecord(object.Description),
						azureString,
						handwritten,
					),
					quantity: azureField(
						asRecord(object.Quantity),
						azureNumber,
						handwritten,
					),
					unit: azureField(asRecord(object.Unit), azureString, handwritten),
					unitPrice: azureField(
						asRecord(object.UnitPrice),
						azureNumber,
						handwritten,
					),
					barcode: azureField(
						asRecord(object.ProductCode),
						azureString,
						handwritten,
					),
					sku: emptyField<string>(),
				}
			}),
		}
	}

	return {
		async extract(input) {
			return fromInvoiceResult(await analyze(input, 'prebuilt-invoice'))
		},
		async extractRegion(input) {
			const result = await analyze(input, 'prebuilt-read')
			const content = asString(result.content)

			if (content) {
				return { value: content, confidence: 0.8 }
			}

			const pages = Array.isArray(result.pages) ? result.pages : []
			const lines = asRecord(pages[0])?.lines
			const firstLine = Array.isArray(lines) ? asRecord(lines[0]) : null

			return {
				value: asString(firstLine?.content),
				confidence: asConfidence(firstLine?.confidence),
			}
		},
		async rankMatch() {
			// note: Azure Document Intelligence has no entity-ranking API; match.ts still does identifier + fuzzy matching.
			return []
		},
	}
}

const openaiProvider = (): InvoiceAiProvider => {
	const apiKey = config.aiInvoice.openai.apiKey
	const model = config.aiInvoice.openai.model

	const complete = async (
		input: InvoiceDocumentInput,
		userText: string,
	): Promise<unknown> => {
		requireConfig(Boolean(apiKey), 'OPENAI_API_KEY is required.')

		const content: Array<Record<string, unknown>> = [
			{ type: 'text', text: userText },
		]

		if (input.mimeType === 'application/pdf') {
			content.push({
				type: 'file',
				file: {
					filename: input.fileName || 'invoice.pdf',
					file_data: dataUrl(input),
				},
			})
		} else {
			content.push({
				type: 'image_url',
				image_url: { url: dataUrl(input) },
			})
		}

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
				messages: [
					{ role: 'system', content: EXTRACTION_INSTRUCTIONS },
					{ role: 'user', content },
				],
			}),
		})

		if (!response.ok) {
			const detail = await response.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Invoice extraction failed (${response.status}). ${detail.slice(0, 280)}`,
			)
		}

		const payload = (await response.json()) as Record<string, unknown>
		const choices = Array.isArray(payload.choices) ? payload.choices : []
		const message = asRecord(asRecord(choices[0])?.message)

		return parseJsonObject(asString(message?.content) ?? '{}')
	}

	const completeText = async (userText: string): Promise<unknown> => {
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
				messages: [{ role: 'user', content: userText }],
			}),
		})

		if (!response.ok) {
			const detail = await response.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Invoice matching failed (${response.status}). ${detail.slice(0, 280)}`,
			)
		}

		const payload = (await response.json()) as Record<string, unknown>
		const choices = Array.isArray(payload.choices) ? payload.choices : []
		const message = asRecord(asRecord(choices[0])?.message)

		return parseJsonObject(asString(message?.content) ?? '{}')
	}

	return {
		async extract(input) {
			return parseRawExtraction(
				await complete(
					input,
					`Extract the invoice. Use this shape:\n${EXTRACTION_JSON_SHAPE}`,
				),
			)
		},
		async extractRegion(input) {
			const parsed = asRecord(
				await complete(
					input,
					`Read only this cropped region for field "${input.field}". Return JSON {"value": string|null, "confidence": number, "isHandwritten": boolean}. Null if unreadable.`,
				),
			)

			return parseRawField(parsed, asString)
		},
		async rankMatch(input) {
			if (!input.candidates.length) return []

			return parseRankMatches(
				await completeText(rankMatchPrompt(input)),
				new Set(input.candidates.map(candidate => candidate.id)),
			)
		},
	}
}

const geminiProvider = (): InvoiceAiProvider => {
	const apiKey = config.aiInvoice.gemini.apiKey
	const model = config.aiInvoice.gemini.model

	const generate = async (
		input: InvoiceDocumentInput,
		userText: string,
	): Promise<unknown> => {
		requireConfig(Boolean(apiKey), 'GEMINI_API_KEY is required.')

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				generationConfig: {
					temperature: 0,
					responseMimeType: 'application/json',
				},
				contents: [
					{
						role: 'user',
						parts: [
							{ text: `${EXTRACTION_INSTRUCTIONS}\n${userText}` },
							{
								inline_data: {
									mime_type: input.mimeType,
									data: input.bytes.toString('base64'),
								},
							},
						],
					},
				],
			}),
		})

		if (!response.ok) {
			const detail = await response.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Invoice extraction failed (${response.status}). ${detail.slice(0, 280)}`,
			)
		}

		const payload = (await response.json()) as Record<string, unknown>
		const candidates = Array.isArray(payload.candidates)
			? payload.candidates
			: []
		const content = asRecord(asRecord(candidates[0])?.content)
		const parts = Array.isArray(content?.parts) ? content.parts : []
		const text = asString(asRecord(parts[0])?.text) ?? '{}'

		return parseJsonObject(text)
	}

	const generateText = async (userText: string): Promise<unknown> => {
		requireConfig(Boolean(apiKey), 'GEMINI_API_KEY is required.')

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				generationConfig: {
					temperature: 0,
					responseMimeType: 'application/json',
				},
				contents: [{ role: 'user', parts: [{ text: userText }] }],
			}),
		})

		if (!response.ok) {
			const detail = await response.text()

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Invoice matching failed (${response.status}). ${detail.slice(0, 280)}`,
			)
		}

		const payload = (await response.json()) as Record<string, unknown>
		const candidates = Array.isArray(payload.candidates)
			? payload.candidates
			: []
		const content = asRecord(asRecord(candidates[0])?.content)
		const parts = Array.isArray(content?.parts) ? content.parts : []
		const text = asString(asRecord(parts[0])?.text) ?? '{}'

		return parseJsonObject(text)
	}

	return {
		async extract(input) {
			return parseRawExtraction(
				await generate(
					input,
					`Extract the invoice. Use this shape:\n${EXTRACTION_JSON_SHAPE}`,
				),
			)
		},
		async extractRegion(input) {
			const parsed = asRecord(
				await generate(
					input,
					`Read only this cropped region for field "${input.field}". Return JSON {"value": string|null, "confidence": number, "isHandwritten": boolean}. Null if unreadable.`,
				),
			)

			return parseRawField(parsed, asString)
		},
		async rankMatch(input) {
			if (!input.candidates.length) return []

			return parseRankMatches(
				await generateText(rankMatchPrompt(input)),
				new Set(input.candidates.map(candidate => candidate.id)),
			)
		},
	}
}

export const getInvoiceAiProvider = (): InvoiceAiProvider => {
	const name = config.aiInvoice.provider as InvoiceAiProviderName

	if (name === 'azure') return azureProvider()

	if (name === 'openai') return openaiProvider()

	if (name === 'gemini') return geminiProvider()

	if (name === 'mock') return mockProvider()

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		`Unknown AI_PROVIDER "${config.aiInvoice.provider}". Use mock, azure, openai, or gemini.`,
	)
}
