import express from 'express'
import { RequiredParameterMissingError } from '../shared/errors'
import { ERROR_CODES } from '../shared/errorCodes'
import { validateInternalId } from '../shared/validator/validator'
import { handleError } from '../middleware/errorHandler'
import { DailyActionType } from '../shared/globalEnums'

export class PlatformValidator {
	public constructor() {}

	protected validatePostDailyAction(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	): void {
		try {
			const {
				entryType,
				productId,
				productName,
				supplierId,
				partnerId,
				customerId,
				expenseId,
				currencyId,
				currencyName,
				unitId,
				unitName,
				weight,
				singleUnitPrice,
				totalPrice,
				invoiceNumber,
			} = req.body ?? {}

			if (!entryType) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'EntryType is Missing',
				)
			}

			if (!Object.values(DailyActionType).includes(entryType)) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Invalid EntryType.',
				)
			}

			if (entryType === DailyActionType.SELLING_ENTRY) {
				if (!customerId || !String(customerId).trim()) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'CustomerId is Missing',
					)
				}
			}

			if (entryType === DailyActionType.BUYING_ENTRY) {
				if (!supplierId || !String(supplierId).trim()) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'SupplierId  is Missing',
					)
				}
			}

			if (entryType === DailyActionType.PAYMENT_ENTRY) {
				if (
					(!supplierId || !String(supplierId).trim()) &&
					(!partnerId || !String(partnerId).trim())
				) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'SupplierId or PartnerId is Missing',
					)
				}
			}

			if (entryType === DailyActionType.RECEIPT_ENTRY) {
				if (
					(!customerId || !String(customerId).trim()) &&
					(!partnerId || !String(partnerId).trim())
				) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'CustomerId or PartnerId is Missing',
					)
				}
			}

			if (entryType === DailyActionType.EXPENSE_ENTRY) {
				if (!expenseId || !String(expenseId).trim()) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'ExpenseId is Missing',
					)
				}
			}

			if (!currencyId || !currencyName || !singleUnitPrice) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'One or more required fields are missing.',
				)
			}

			if (
				(entryType === DailyActionType.BUYING_ENTRY ||
					entryType === DailyActionType.SELLING_ENTRY) &&
				(!productId ||
					!productName ||
					!unitId ||
					!unitName ||
					!weight ||
					!totalPrice ||
					!invoiceNumber)
			) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'One or more required fields are missing.',
				)
			}

			next()
		} catch (err: any) {
			handleError(err, 400, res)
		}
	}

	protected validateBudgetOverview(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	): void {
		const { entityType, id } = req.params
		try {
			if (!entityType) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Entity type is required.',
				)
			}

			if (!id) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Id is required.',
				)
			}

			if (
				!Object.values(['customer', 'supplier', 'partner']).includes(entityType)
			) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Invalid entity type.',
				)
			}

			if (!id || !String(id).trim()) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Id is required.',
				)
			}

			next()
		} catch (err: any) {
			handleError(err, 400, res)
		}
	}

	protected validateDeleteDailyAction(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	): void {
		try {
			const actionIds: unknown[] = Array.isArray(req.body?.actionIds)
				? req.body.actionIds
				: req.params.id
					? [req.params.id]
					: []

			const hasOnlyValidActionIds =
				actionIds.length > 0 &&
				actionIds.every(
					(actionId: unknown) =>
						typeof actionId === 'string' && actionId.trim().length > 0,
				)

			if (!hasOnlyValidActionIds) {
				throw new RequiredParameterMissingError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Daily action ids are missing.',
				)
			}

			next()
		} catch (err: any) {
			handleError(err, 400, res)
		}
	}

	protected validateGetProducts(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	): void {
		try {
			// validateInternalId(req.user.tenantId, 'tenantId id')
			// validateInternalId(req.user.role, 'role')
			validateInternalId(req.params.role, 'role')

			next()
		} catch (err: any) {
			handleError(err, 400, res)
		}
	}
}
