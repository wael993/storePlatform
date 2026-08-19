import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export const EMPLOYEE_STATUSES = [
	'active',
	'inactive',
	'on_leave',
	'terminated',
] as const
export const EMPLOYMENT_TYPES = [
	'full_time',
	'part_time',
	'hourly',
	'other',
] as const
export const SALARY_TYPES = ['monthly', 'hourly'] as const
export const WEEKDAYS = [
	'sun',
	'mon',
	'tue',
	'wed',
	'thu',
	'fri',
	'sat',
] as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
export type SalaryType = (typeof SALARY_TYPES)[number]
export type Weekday = (typeof WEEKDAYS)[number]

export interface EmployeeSalary {
	salaryId: string
	type: SalaryType
	amount: number
	currencyId: string
	currencyName: string
	effectiveDate: string
	overtimeRate?: number
}

export interface EmployeePayout {
	payoutId: string
	date: string
	amount: number
	currencyId: string
	currencyName: string
	note?: string
}

export interface IEmployee extends Document<string> {
	tenantId: string
	employeeId: string
	name: string
	phone?: string
	address?: string
	status: EmployeeStatus
	employmentType: EmploymentType
	startDate: string
	endDate?: string
	workingDays: Weekday[]
	workStart?: string
	workEnd?: string
	salaries: EmployeeSalary[]
	payouts: EmployeePayout[]
	createdBy: {
		_id: string
		displayName: string
		role?: string
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		role?: string
		updatedAt: Date
	}
	createdAt: Date
	updatedAt: Date
}

export type EmployeeDto = {
	employeeId: string
	name: string
	phone?: string
	address?: string
	status: EmployeeStatus
	employmentType: EmploymentType
	startDate: string
	endDate?: string
	workingDays: Weekday[]
	workStart?: string
	workEnd?: string
	salaries: EmployeeSalary[]
	payouts: EmployeePayout[]
	currentSalary?: EmployeeSalary
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const isEmployeeStatus = (value: unknown): value is EmployeeStatus =>
	typeof value === 'string' &&
	(EMPLOYEE_STATUSES as readonly string[]).includes(value)

const isEmploymentType = (value: unknown): value is EmploymentType =>
	typeof value === 'string' &&
	(EMPLOYMENT_TYPES as readonly string[]).includes(value)

const isSalaryType = (value: unknown): value is SalaryType =>
	typeof value === 'string' &&
	(SALARY_TYPES as readonly string[]).includes(value)

const isWeekday = (value: unknown): value is Weekday =>
	typeof value === 'string' && (WEEKDAYS as readonly string[]).includes(value)

export const isCalendarDate = (value: unknown): value is string => {
	if (typeof value !== 'string' || !DATE_RE.test(value)) {
		return false
	}

	const parsed = new Date(`${value}T00:00:00Z`)

	return (
		!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
	)
}

export const isClockTime = (value: unknown): value is string =>
	typeof value === 'string' && TIME_RE.test(value)

export const todayCalendarDate = (now = new Date()): string =>
	now.toISOString().slice(0, 10)

export const currentSalary = (
	salaries: EmployeeSalary[],
	onDate = todayCalendarDate(),
): EmployeeSalary | undefined =>
	[...salaries]
		.filter(salary => salary.effectiveDate <= onDate)
		.sort((left, right) =>
			right.effectiveDate.localeCompare(left.effectiveDate),
		)[0]

export const hasHourlyPay = (salaries: EmployeeSalary[]): boolean =>
	currentSalary(salaries)?.type === 'hourly'

export const assertHourlySchedule = (
	workStart?: string,
	workEnd?: string,
): void => {
	if (!isClockTime(workStart) || !isClockTime(workEnd)) {
		throw new Error('Hourly pay requires work start and end time')
	}

	if (workStart >= workEnd) {
		throw new Error('Work end must be after work start')
	}
}

export const parseWorkingDays = (value: unknown): Weekday[] => {
	if (value === undefined) {
		return []
	}

	if (!Array.isArray(value)) {
		throw new Error('workingDays must be an array')
	}

	const days: Weekday[] = []
	const seen = new Set<string>()

	for (const item of value) {
		if (!isWeekday(item)) {
			throw new Error('Invalid weekday')
		}

		if (seen.has(item)) {
			continue
		}

		seen.add(item)
		days.push(item)
	}

	return days
}

export const parseOptionalText = (value: unknown): string | undefined => {
	if (value === undefined || value === null) {
		return undefined
	}

	if (typeof value !== 'string') {
		throw new Error('Expected a string')
	}

	const trimmed = value.trim()

	return trimmed || undefined
}

export const parseRequiredName = (value: unknown): string => {
	const name = parseOptionalText(value)

	if (!name) {
		throw new Error('Employee name is required')
	}

	return name
}

export const parseEmploymentType = (value: unknown): EmploymentType => {
	if (!isEmploymentType(value)) {
		throw new Error('Employment type is required')
	}

	return value
}

export const parseStatus = (
	value: unknown,
	fallback: EmployeeStatus,
): EmployeeStatus => {
	if (value === undefined) {
		return fallback
	}

	if (!isEmployeeStatus(value)) {
		throw new Error('Invalid employment status')
	}

	return value
}

export const parseOptionalClock = (value: unknown): string | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined
	}

	if (!isClockTime(value)) {
		throw new Error('Time must be HH:mm')
	}

	return value
}

export const parseSalaryInput = (
	value: unknown,
): Omit<EmployeeSalary, 'salaryId'> => {
	if (!value || typeof value !== 'object') {
		throw new Error('Salary is required')
	}

	const input = value as Record<string, unknown>

	if (!isSalaryType(input.type)) {
		throw new Error('Salary type is required')
	}

	const amount = Number(input.amount)

	if (!Number.isFinite(amount) || amount <= 0) {
		throw new Error('Salary amount must be greater than 0')
	}

	const currencyId = parseOptionalText(input.currencyId)

	if (!currencyId) {
		throw new Error('Salary currency is required')
	}

	if (!isCalendarDate(input.effectiveDate)) {
		throw new Error('Salary effective date is required')
	}

	const overtimeRate =
		input.overtimeRate === undefined ||
		input.overtimeRate === null ||
		input.overtimeRate === ''
			? undefined
			: Number(input.overtimeRate)

	if (
		overtimeRate !== undefined &&
		(!Number.isFinite(overtimeRate) || overtimeRate < 0)
	) {
		throw new Error('Overtime rate must be 0 or greater')
	}

	return {
		type: input.type,
		amount,
		currencyId,
		currencyName: '',
		effectiveDate: input.effectiveDate,
		overtimeRate,
	}
}

export const parsePayoutInput = (
	value: unknown,
): Omit<EmployeePayout, 'payoutId' | 'currencyName'> => {
	if (!value || typeof value !== 'object') {
		throw new Error('Payout is required')
	}

	const input = value as Record<string, unknown>
	const amount = Number(input.amount)

	if (!Number.isFinite(amount) || amount <= 0) {
		throw new Error('Payout amount must be greater than 0')
	}

	const currencyId = parseOptionalText(input.currencyId)

	if (!currencyId) {
		throw new Error('Payout currency is required')
	}

	if (!isCalendarDate(input.date)) {
		throw new Error('Payout date is required')
	}

	return {
		date: input.date,
		amount,
		currencyId,
		note: parseOptionalText(input.note),
	}
}

export const resolveEmploymentDates = (
	status: EmployeeStatus,
	startDate: unknown,
	endDate: unknown,
): { startDate: string; endDate?: string } => {
	if (!isCalendarDate(startDate)) {
		throw new Error('Start date is required')
	}

	if (status === 'terminated') {
		const resolvedEnd =
			endDate === undefined || endDate === null || endDate === ''
				? todayCalendarDate()
				: endDate

		if (!isCalendarDate(resolvedEnd)) {
			throw new Error('End date is required when terminated')
		}

		if (resolvedEnd < startDate) {
			throw new Error('End date cannot be before start date')
		}

		return { startDate, endDate: resolvedEnd }
	}

	if (endDate !== undefined && endDate !== null && endDate !== '') {
		if (!isCalendarDate(endDate)) {
			throw new Error('Invalid end date')
		}

		if (endDate < startDate) {
			throw new Error('End date cannot be before start date')
		}
	}

	return { startDate, endDate: undefined }
}

export const toEmployeeDto = (employee: IEmployee): EmployeeDto => ({
	employeeId: employee.employeeId,
	name: employee.name,
	phone: employee.phone,
	address: employee.address,
	status: employee.status,
	employmentType: employee.employmentType,
	startDate: employee.startDate,
	endDate: employee.endDate,
	workingDays: employee.workingDays,
	workStart: employee.workStart,
	workEnd: employee.workEnd,
	salaries: employee.salaries,
	payouts: employee.payouts,
	currentSalary: currentSalary(employee.salaries),
})

const SalarySchema = new Schema<EmployeeSalary>(
	{
		salaryId: { type: String, required: true },
		type: { type: String, required: true, enum: SALARY_TYPES },
		amount: { type: Number, required: true },
		currencyId: { type: String, required: true },
		currencyName: { type: String, required: true },
		effectiveDate: { type: String, required: true },
		overtimeRate: { type: Number },
	},
	{ _id: false },
)

const PayoutSchema = new Schema<EmployeePayout>(
	{
		payoutId: { type: String, required: true },
		date: { type: String, required: true },
		amount: { type: Number, required: true },
		currencyId: { type: String, required: true },
		currencyName: { type: String, required: true },
		note: { type: String },
	},
	{ _id: false },
)

const EmployeeSchema = new Schema<IEmployee>(
	{
		_id: { type: String, required: true },
		employeeId: { type: String, required: true, index: true },
		name: { type: String, required: true, index: true },
		phone: { type: String },
		address: { type: String },
		status: {
			type: String,
			required: true,
			enum: EMPLOYEE_STATUSES,
			default: 'active',
		},
		employmentType: { type: String, required: true, enum: EMPLOYMENT_TYPES },
		startDate: { type: String, required: true },
		endDate: { type: String },
		workingDays: { type: [String], default: [] },
		workStart: { type: String },
		workEnd: { type: String },
		salaries: { type: [SalarySchema], default: [] },
		payouts: { type: [PayoutSchema], default: [] },
	},
	{ timestamps: true },
)

tenantScopedSchema(EmployeeSchema)
EmployeeSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true })

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema)
