import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Currency } from '../../models/Currency'
import {
	assertHourlySchedule,
	Employee,
	EmployeeDto,
	hasHourlyPay,
	IEmployee,
	parseEmploymentType,
	parseOptionalClock,
	parseOptionalText,
	parsePayoutInput,
	parseRequiredName,
	parseSalaryInput,
	parseStatus,
	parseWorkingDays,
	resolveEmploymentDates,
	toEmployeeDto,
} from '../../models/Employee'
import { ERROR_CODES } from '../../shared/errorCodes'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { getTenantContext } from '../../shared/tenant'
import { ensureSeeIds } from '../../shared/seePermissions'
import { SEE } from '../../shared/seeCatalog'
import { RequestContext } from '../../shared/types'

const businessError = (message: string) =>
	new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		message,
	)

const parseOrThrow = <T>(run: () => T): T => {
	try {
		return run()
	} catch (error) {
		throw businessError(
			error instanceof Error ? error.message : 'Invalid input',
		)
	}
}

const actor = (requestContext: RequestContext) => ({
	_id: requestContext.userId ?? '',
	displayName:
		`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim() ||
		'Unknown',
	role: requestContext.user?.role ?? requestContext.role,
})

export default class EmployeeController {
	private async requireAccess(requestContext: RequestContext): Promise<string> {
		await ensureSeeIds(requestContext, [SEE.employees])

		return getTenantContext(requestContext).tenantId
	}

	private async findEmployee(
		tenantId: string,
		employeeId: string,
	): Promise<IEmployee> {
		const employee = (await withTenantScope(
			Employee.findOne({ employeeId }),
			tenantId,
		)) as IEmployee | null

		if (!employee) {
			throw businessError('Employee not found')
		}

		return employee
	}

	private async currencyName(
		tenantId: string,
		currencyId: string,
	): Promise<string> {
		const currency = await withTenantScope(
			Currency.findOne({ currencyId }).lean(),
			tenantId,
		)

		if (!currency) {
			throw businessError('Currency not found')
		}

		return currency.name
	}

	private guardHourlySchedule(employee: IEmployee): void {
		if (!hasHourlyPay(employee.salaries)) {
			return
		}

		parseOrThrow(() =>
			assertHourlySchedule(employee.workStart, employee.workEnd),
		)
	}

	public async getEmployees(
		requestContext: RequestContext,
	): Promise<{ data: EmployeeDto[]; totalCount: number }> {
		const tenantId = await this.requireAccess(requestContext)
		const employees = (await withTenantScope(Employee.find(), tenantId).sort({
			name: 1,
		})) as IEmployee[]
		const data = employees.map(toEmployeeDto)

		return { data, totalCount: data.length }
	}

	public async getEmployee(
		employeeId: string,
		requestContext: RequestContext,
	): Promise<EmployeeDto> {
		const tenantId = await this.requireAccess(requestContext)
		const employee = await this.findEmployee(tenantId, employeeId)

		return toEmployeeDto(employee)
	}

	public async postEmployee(
		requestContext: RequestContext,
		body: Record<string, unknown>,
	): Promise<{ employeeId: string }> {
		const tenantId = await this.requireAccess(requestContext)

		await ensureSeeIds(requestContext, [SEE.employeesAdd])
		const name = parseOrThrow(() => parseRequiredName(body.name))
		const employmentType = parseOrThrow(() =>
			parseEmploymentType(body.employmentType),
		)
		const status = parseOrThrow(() => parseStatus(body.status, 'active'))
		const dates = parseOrThrow(() =>
			resolveEmploymentDates(status, body.startDate, body.endDate),
		)
		const workingDays = parseOrThrow(() => parseWorkingDays(body.workingDays))
		const workStart = parseOrThrow(() => parseOptionalClock(body.workStart))
		const workEnd = parseOrThrow(() => parseOptionalClock(body.workEnd))
		const employeeId = uuidv4()
		const created = actor(requestContext)

		await Employee.create({
			_id: employeeId,
			tenantId,
			employeeId,
			name,
			phone: parseOrThrow(() => parseOptionalText(body.phone)),
			address: parseOrThrow(() => parseOptionalText(body.address)),
			status,
			employmentType,
			startDate: dates.startDate,
			endDate: dates.endDate,
			workingDays,
			workStart,
			workEnd,
			salaries: [],
			payouts: [],
			createdBy: { ...created, createdAt: new Date() },
		})

		return { employeeId }
	}

	public async patchEmployee(
		employeeId: string,
		requestContext: RequestContext,
		body: Record<string, unknown>,
	): Promise<EmployeeDto> {
		const tenantId = await this.requireAccess(requestContext)
		const employee = await this.findEmployee(tenantId, employeeId)

		if (body.name !== undefined) {
			employee.name = parseOrThrow(() => parseRequiredName(body.name))
		}

		if (body.phone !== undefined) {
			employee.phone = parseOrThrow(() => parseOptionalText(body.phone))
		}

		if (body.address !== undefined) {
			employee.address = parseOrThrow(() => parseOptionalText(body.address))
		}

		if (body.employmentType !== undefined) {
			employee.employmentType = parseOrThrow(() =>
				parseEmploymentType(body.employmentType),
			)
		}

		if (body.workingDays !== undefined) {
			employee.workingDays = parseOrThrow(() =>
				parseWorkingDays(body.workingDays),
			)
		}

		if (body.workStart !== undefined) {
			employee.workStart = parseOrThrow(() =>
				parseOptionalClock(body.workStart),
			)
		}

		if (body.workEnd !== undefined) {
			employee.workEnd = parseOrThrow(() => parseOptionalClock(body.workEnd))
		}

		const status = parseOrThrow(() => parseStatus(body.status, employee.status))
		const startDate =
			body.startDate !== undefined ? body.startDate : employee.startDate
		const endDate = body.endDate !== undefined ? body.endDate : employee.endDate
		const dates = parseOrThrow(() =>
			resolveEmploymentDates(status, startDate, endDate),
		)

		employee.status = status
		employee.startDate = dates.startDate
		employee.endDate = dates.endDate
		this.guardHourlySchedule(employee)
		employee.updatedBy = { ...actor(requestContext), updatedAt: new Date() }
		await employee.save()

		return toEmployeeDto(employee)
	}

	public async postSalary(
		employeeId: string,
		requestContext: RequestContext,
		body: Record<string, unknown>,
	): Promise<EmployeeDto> {
		const tenantId = await this.requireAccess(requestContext)
		const employee = await this.findEmployee(tenantId, employeeId)
		const salary = parseOrThrow(() => parseSalaryInput(body))
		const currencyName = await this.currencyName(tenantId, salary.currencyId)

		employee.salaries.push({
			...salary,
			salaryId: uuidv4(),
			currencyName,
		})

		this.guardHourlySchedule(employee)
		employee.updatedBy = { ...actor(requestContext), updatedAt: new Date() }
		await employee.save()

		return toEmployeeDto(employee)
	}

	public async postPayout(
		employeeId: string,
		requestContext: RequestContext,
		body: Record<string, unknown>,
	): Promise<EmployeeDto> {
		const tenantId = await this.requireAccess(requestContext)
		const employee = await this.findEmployee(tenantId, employeeId)
		const payout = parseOrThrow(() => parsePayoutInput(body))
		const currencyName = await this.currencyName(tenantId, payout.currencyId)

		employee.payouts.push({
			...payout,
			payoutId: uuidv4(),
			currencyName,
		})

		employee.updatedBy = { ...actor(requestContext), updatedAt: new Date() }
		await employee.save()

		return toEmployeeDto(employee)
	}

	public async patchPayout(
		employeeId: string,
		payoutId: string,
		requestContext: RequestContext,
		body: Record<string, unknown>,
	): Promise<EmployeeDto> {
		const tenantId = await this.requireAccess(requestContext)
		const employee = await this.findEmployee(tenantId, employeeId)
		const payout = employee.payouts.find(item => item.payoutId === payoutId)

		if (!payout) {
			throw businessError('Payout not found')
		}

		const next = parseOrThrow(() => parsePayoutInput({ ...payout, ...body }))
		const currencyName = await this.currencyName(tenantId, next.currencyId)

		payout.date = next.date
		payout.amount = next.amount
		payout.currencyId = next.currencyId
		payout.currencyName = currencyName
		payout.note = next.note
		employee.updatedBy = { ...actor(requestContext), updatedAt: new Date() }
		await employee.save()

		return toEmployeeDto(employee)
	}

	public async deletePayout(
		employeeId: string,
		payoutId: string,
		requestContext: RequestContext,
	): Promise<EmployeeDto> {
		const tenantId = await this.requireAccess(requestContext)
		const employee = await this.findEmployee(tenantId, employeeId)
		const nextPayouts = employee.payouts.filter(
			item => item.payoutId !== payoutId,
		)

		if (nextPayouts.length === employee.payouts.length) {
			throw businessError('Payout not found')
		}

		employee.payouts = nextPayouts
		employee.markModified('payouts')
		employee.updatedBy = { ...actor(requestContext), updatedAt: new Date() }
		await employee.save()

		return toEmployeeDto(employee)
	}
}
