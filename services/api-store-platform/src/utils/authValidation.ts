import validator from 'validator'

const PASSWORD_MIN_LENGTH = 8

export function validateEmail(email: string): string | null {
	if (!email || !validator.isEmail(email)) {
		return 'Please provide a valid email address (e.g. user@example.com).'
	}
	return null
}

export function validatePasswordStrength(password: string): string | null {
	if (!password || password.length < PASSWORD_MIN_LENGTH) {
		return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
	}
	// if (!/[A-Z]/.test(password)) {
	// 	return 'Password must contain at least one uppercase letter.'
	// }
	if (!/[a-z]/.test(password)) {
		return 'Password must contain at least one lowercase letter.'
	}
	if (!/\d/.test(password)) {
		return 'Password must contain at least one number.'
	}
	// if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
	// 	return 'Password must contain at least one special character (!@#$%^&* etc.).'
	// }
	return null
}
