import { insertDocs } from '../../db/docs'
import { pgDeleteMany, pgFind } from '../../db/mongoQuery'
import { v4 as uuidv4 } from 'uuid'

import { Category } from '../../models/Category'
import { Supplier } from '../../models/Supplier'
import { Unit } from '../../models/Unit'
import type { MasterDataImportField } from '../constants/productImport'

export const normalizeMasterName = (value: string): string =>
	value.trim().toLowerCase()

export type MasterCandidate = { id: string; name: string }

export type MasterProposal = {
	kind: MasterDataImportField
	excelValue: string
	normalized: string
	status: 'match' | 'create' | 'ambiguous'
	matchedId?: string
	matchedName?: string
	candidates: MasterCandidate[]
}

export type MasterDecision = {
	kind: MasterDataImportField
	excelValue: string
	action: 'match' | 'create' | 'skip'
	matchedId?: string
	/** Name used when action is create; defaults to excelValue. */
	createName?: string
}

export const resolveCreateMasterName = (decision: MasterDecision): string =>
	decision.createName?.trim() || decision.excelValue.trim()

export type MasterResolutions = Partial<
	Record<MasterDataImportField, Record<string, string>>
>

export type CreatedMasterData = {
	categoryIds: string[]
	supplierIds: string[]
	unitIds: string[]
}

const emptyCreated = (): CreatedMasterData => ({
	categoryIds: [],
	supplierIds: [],
	unitIds: [],
})

export const loadMasterCandidates = async (
	tenantId: string,
): Promise<Record<MasterDataImportField, MasterCandidate[]>> => {
	const [categories, suppliers, units] = await Promise.all([
		pgFind(Category, tenantId, {}, { select: { categoryId: 1, name: 1 } }),
		pgFind(Supplier, tenantId, {}, { select: { supplierId: 1, name: 1 } }),
		pgFind(Unit, tenantId, {}, { select: { unitId: 1, name: 1 } }),
	])

	return {
		category: categories.map(item => ({
			id: item.categoryId,
			name: item.name,
		})),
		supplier: suppliers.map(item => ({
			id: item.supplierId,
			name: item.name,
		})),
		unit: units.map(item => ({ id: item.unitId, name: item.name })),
	}
}

export const proposeMasterMatches = (
	kind: MasterDataImportField,
	excelValues: string[],
	candidates: MasterCandidate[],
): MasterProposal[] => {
	const byNorm = new Map<string, MasterCandidate[]>()

	for (const candidate of candidates) {
		const key = normalizeMasterName(candidate.name)
		const list = byNorm.get(key) ?? []

		list.push(candidate)
		byNorm.set(key, list)
	}

	const seen = new Set<string>()
	const out: MasterProposal[] = []

	for (const raw of excelValues) {
		const excelValue = raw.trim()

		if (!excelValue) continue

		const normalized = normalizeMasterName(excelValue)

		if (seen.has(normalized)) continue

		seen.add(normalized)
		const matches = byNorm.get(normalized) ?? []

		if (matches.length === 1) {
			out.push({
				kind,
				excelValue,
				normalized,
				status: 'match',
				matchedId: matches[0].id,
				matchedName: matches[0].name,
				candidates: matches,
			})
		} else if (matches.length > 1) {
			out.push({
				kind,
				excelValue,
				normalized,
				status: 'ambiguous',
				candidates: matches,
			})
		} else {
			out.push({
				kind,
				excelValue,
				normalized,
				status: 'create',
				candidates: [],
			})
		}
	}

	return out
}

type CreatedBy = {
	_id: string
	displayName: string
	role?: string
	createdAt: Date
}

export const applyMasterDecisions = async (
	tenantId: string,
	decisions: MasterDecision[],
	createdBy: CreatedBy,
): Promise<{ resolutions: MasterResolutions; created: CreatedMasterData }> => {
	const resolutions: MasterResolutions = {
		category: {},
		supplier: {},
		unit: {},
	}
	const created = emptyCreated()

	for (const decision of decisions) {
		const excelValue = decision.excelValue.trim()

		if (!excelValue || decision.action === 'skip') continue

		const normalized = normalizeMasterName(excelValue)
		const bucket =
			resolutions[decision.kind] ?? (resolutions[decision.kind] = {})

		if (decision.action === 'match') {
			if (!decision.matchedId?.trim()) {
				throw new Error(`Match for "${excelValue}" is missing an id.`)
			}

			bucket[normalized] = decision.matchedId.trim()

			continue
		}

		const createName = resolveCreateMasterName(decision)

		if (!createName) {
			throw new Error(`Create name for "${excelValue}" is empty.`)
		}

		if (decision.kind === 'category') {
			const categoryId = uuidv4()

			await insertDocs(Category, [
				{
					tenantId,
					categoryId,
					name: createName,
					createdBy: { ...createdBy },
				},
			])

			bucket[normalized] = categoryId
			created.categoryIds.push(categoryId)
		} else if (decision.kind === 'supplier') {
			const supplierId = uuidv4()

			await insertDocs(Supplier, [
				{
					tenantId,
					supplierId,
					name: createName,
					createdBy: {
						_id: createdBy._id,
						displayName: createdBy.displayName,
						createdAt: createdBy.createdAt,
					},
				},
			])

			bucket[normalized] = supplierId
			created.supplierIds.push(supplierId)
		} else {
			const unitId = uuidv4()

			await insertDocs(Unit, [
				{
					tenantId,
					unitId,
					name: createName,
					// FE creates units without a separate code; reuse name for uniqueness.
					internalCode: createName,
					createdBy: { ...createdBy },
				},
			])

			bucket[normalized] = unitId
			created.unitIds.push(unitId)
		}
	}

	return { resolutions, created }
}

export const rollbackCreatedMasterData = async (
	tenantId: string,
	created?: CreatedMasterData | null,
) => {
	if (!created) return

	await Promise.all([
		created.categoryIds.length
			? pgDeleteMany(Category, tenantId, {
					categoryId: { $in: created.categoryIds },
				})
			: Promise.resolve(),
		created.supplierIds.length
			? pgDeleteMany(Supplier, tenantId, {
					supplierId: { $in: created.supplierIds },
				})
			: Promise.resolve(),
		created.unitIds.length
			? pgDeleteMany(Unit, tenantId, { unitId: { $in: created.unitIds } })
			: Promise.resolve(),
	])
}
