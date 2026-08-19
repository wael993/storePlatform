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

export interface Employee {
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

export const defaultSalaryType = (
	employmentType: EmploymentType,
): SalaryType => (employmentType === 'hourly' ? 'hourly' : 'monthly')

export const isTerminated = (employee: Employee) =>
	employee.status === 'terminated'

export const todayCalendarDate = () => {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}
