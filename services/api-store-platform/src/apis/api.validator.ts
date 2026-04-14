import express from 'express'
import { RequiredParameterMissingError } from '../shared/errors'
import { ERROR_CODES } from '../shared/errorCodes'
import { validateInternalId } from '../shared/validator/validator'
import { handleError } from '../middleware/errorHandler'

export class PlatformValidator {
	public constructor() {}

	protected validateGetProducts(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	): void {
		try {
			validateInternalId(req.params?.id, 'Activity id')

			next()
		} catch (err: any) {
			handleError(err, 400, res)
		}
	}
}
