import { v4 as uuidv4 } from 'uuid'

import { Category } from '../../models/Category'
import { Supplier } from '../../models/Supplier'
import { Unit } from '../../models/Unit'
import { withTenantScope } from '../mongodb/tenantScopedModel'
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
		withTenantScope(
			Category.find().select({ categoryId: 1, name: 1 }).lean(),
			tenantId,
		),
		withTenantScope(
			Supplier.find().select({ supplierId: 1, name: 1 }).lean(),
			tenantId,
		),
		withTenantScope(
			Unit.find().select({ unitId: 1, name: 1 }).lean(),
			tenantId,
		),
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

			await Category.insertMany([
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

			await Supplier.insertMany([
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

			await Unit.insertMany([
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
			? Category.deleteMany({
					categoryId: { $in: created.categoryIds },
				}).setOptions({ __tenantContext: { tenantId } })
			: Promise.resolve(),
		created.supplierIds.length
			? Supplier.deleteMany({
					supplierId: { $in: created.supplierIds },
				}).setOptions({ __tenantContext: { tenantId } })
			: Promise.resolve(),
		created.unitIds.length
			? Unit.deleteMany({ unitId: { $in: created.unitIds } }).setOptions({
					__tenantContext: { tenantId },
				})
			: Promise.resolve(),
	])
}
