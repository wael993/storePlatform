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
				customerId,
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
						'SupplierId is Missing',
					)
				}
			}

			if (entryType === DailyActionType.PAYMENT_ENTRY) {
				if (!supplierId || !String(supplierId).trim()) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'SupplierId is Missing',
					)
				}
			}

			if (entryType === DailyActionType.RECEIPT_ENTRY) {
				if (!customerId || !String(customerId).trim()) {
					throw new RequiredParameterMissingError(
						ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
						'CustomerId is Missing',
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
