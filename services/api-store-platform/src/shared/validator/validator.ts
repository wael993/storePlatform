import { ERROR_CODES } from '../errorCodes'
import { InvalidParameterError, RequiredParameterMissingError } from '../errors'

type Type = 'string' | 'number' | 'boolean' | 'object' | 'integer'

const validateType = (
	property: unknown,
	type: Type,
	errorPlaceHolder?: string,
	customErrorMessage?: string,
): void => {
	if (type === 'integer' && Number.isInteger(property)) return

	if (typeof property === type) return

	throw new InvalidParameterError(
		ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
		customErrorMessage || `${errorPlaceHolder || 'property'} should be ${type}`,
	)
}

const validateInternalId = (id: string, nameHint: string): void => {
	if (!id) {
		throw new RequiredParameterMissingError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			`${nameHint} is missing`,
		)
	}

	validateType(id, 'string', nameHint)
}
export { validateType, validateInternalId }
