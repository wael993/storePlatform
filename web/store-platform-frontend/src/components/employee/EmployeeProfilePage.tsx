import {
	Box,
	Button,
	Checkbox,
	Flex,
	FormControl,
	FormLabel,
	Heading,
	HStack,
	Input,
	Select,
	SimpleGrid,
	Spinner,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Table,
	Tabs,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import useCustomToast from '../common/CustomToast'
import CustomBreadcrumb from '../CustomBreadcrumb'
import {
	useAddEmployeePayoutMutation,
	useAddEmployeeSalaryMutation,
	useDeleteEmployeePayoutMutation,
	useGetCurrencySettingsQuery,
	useGetEmployeeQuery,
	useUpdateEmployeeMutation,
	useUpdateEmployeePayoutMutation,
} from '../../api/apiStore'
import { BreadCrumbItem } from '../../shared/globalEnums'
import { generateBreadcrumbs, RoutePaths } from '../../shared/routes'
import {
	defaultSalaryType,
	EMPLOYEE_STATUSES,
	EMPLOYMENT_TYPES,
	EmployeePayout,
	SALARY_TYPES,
	todayCalendarDate,
	WEEKDAYS,
} from '../../shared/employee'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'

const tabStyles = {
	tab: {
		fontWeight: 600,
		fontSize: '0.95rem',
		color: '#929494',
		_selected: { color: '#376288', borderBottom: '2px solid #376288' },
	},
} satisfies StylesObject

const EmployeeProfilePage = () => {
	const { t } = useTranslation()
	const { employeeId = '' } = useParams()
	const navigate = useNavigate()
	const showToast = useCustomToast()
	const { data: employee, isLoading, isError } = useGetEmployeeQuery(employeeId)
	const { data: currencySettings } = useGetCurrencySettingsQuery()
	const [updateEmployee, { isLoading: isSaving }] = useUpdateEmployeeMutation()
	const [addSalary, { isLoading: isAddingSalary }] =
		useAddEmployeeSalaryMutation()
	const [addPayout, { isLoading: isAddingPayout }] =
		useAddEmployeePayoutMutation()
	const [updatePayout, { isLoading: isUpdatingPayout }] =
		useUpdateEmployeePayoutMutation()
	const [deletePayout, { isLoading: isDeletingPayout }] =
		useDeleteEmployeePayoutMutation()

	const currencies = useMemo(() => {
		const items = [
			currencySettings?.primaryCurrency,
			...(currencySettings?.secondaryCurrencies ?? []),
		].filter(Boolean)
		return items as { currencyId: string; name: string }[]
	}, [currencySettings])
	const defaultCurrencyId = currencies[0]?.currencyId ?? ''

	const [name, setName] = useState('')
	const [phone, setPhone] = useState('')
	const [address, setAddress] = useState('')
	const [status, setStatus] = useState('active')
	const [employmentType, setEmploymentType] = useState('full_time')
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')
	const [workingDays, setWorkingDays] = useState<string[]>([])
	const [workStart, setWorkStart] = useState('')
	const [workEnd, setWorkEnd] = useState('')
	const [salaryType, setSalaryType] = useState('monthly')
	const [salaryAmount, setSalaryAmount] = useState('')
	const [salaryCurrencyId, setSalaryCurrencyId] = useState('')
	const [salaryEffectiveDate, setSalaryEffectiveDate] =
		useState(todayCalendarDate())
	const [overtimeRate, setOvertimeRate] = useState('')
	const [payoutDate, setPayoutDate] = useState(todayCalendarDate())
	const [payoutAmount, setPayoutAmount] = useState('')
	const [payoutCurrencyId, setPayoutCurrencyId] = useState('')
	const [payoutNote, setPayoutNote] = useState('')
	const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null)

	useEffect(() => {
		if (!employee) return
		setName(employee.name)
		setPhone(employee.phone ?? '')
		setAddress(employee.address ?? '')
		setStatus(employee.status)
		setEmploymentType(employee.employmentType)
		setStartDate(employee.startDate)
		setEndDate(employee.endDate ?? '')
		setWorkingDays(employee.workingDays)
		setWorkStart(employee.workStart ?? '')
		setWorkEnd(employee.workEnd ?? '')
		setSalaryType(defaultSalaryType(employee.employmentType))
	}, [employee])

	useEffect(() => {
		if (!salaryCurrencyId && defaultCurrencyId) {
			setSalaryCurrencyId(defaultCurrencyId)
		}
		if (!payoutCurrencyId && defaultCurrencyId) {
			setPayoutCurrencyId(defaultCurrencyId)
		}
	}, [defaultCurrencyId, payoutCurrencyId, salaryCurrencyId])

	const fail = (err: unknown) => {
		const failed = err as { data?: { message?: string } }
		showToast({
			status: 'error',
			title: failed?.data?.message || t('employees.saveFailed'),
		})
	}

	const ok = () =>
		showToast({ status: 'success', title: t('employees.saveSuccess') })

	const saveOverview = async () => {
		try {
			await updateEmployee({
				employeeId,
				body: {
					name,
					phone,
					address,
					status,
					employmentType,
					startDate,
					endDate:
						status === 'terminated' ? endDate || todayCalendarDate() : '',
				},
			}).unwrap()
			ok()
		} catch (err) {
			fail(err)
		}
	}

	const saveSchedule = async () => {
		try {
			await updateEmployee({
				employeeId,
				body: {
					workingDays,
					workStart: workStart.slice(0, 5),
					workEnd: workEnd.slice(0, 5),
				},
			}).unwrap()
			ok()
		} catch (err) {
			fail(err)
		}
	}

	const handleAddSalary = async () => {
		try {
			await addSalary({
				employeeId,
				body: {
					type: salaryType,
					amount: Number(salaryAmount),
					currencyId: salaryCurrencyId,
					effectiveDate: salaryEffectiveDate,
					overtimeRate: overtimeRate === '' ? undefined : Number(overtimeRate),
				},
			}).unwrap()
			setSalaryAmount('')
			setOvertimeRate('')
			setSalaryEffectiveDate(todayCalendarDate())
			ok()
		} catch (err) {
			fail(err)
		}
	}

	const beginEditPayout = (payout: EmployeePayout) => {
		setEditingPayoutId(payout.payoutId)
		setPayoutDate(payout.date)
		setPayoutAmount(String(payout.amount))
		setPayoutCurrencyId(payout.currencyId)
		setPayoutNote(payout.note ?? '')
	}

	const resetPayoutForm = () => {
		setEditingPayoutId(null)
		setPayoutDate(todayCalendarDate())
		setPayoutAmount('')
		setPayoutNote('')
		setPayoutCurrencyId(defaultCurrencyId)
	}

	const handleSavePayout = async () => {
		const body = {
			date: payoutDate,
			amount: Number(payoutAmount),
			currencyId: payoutCurrencyId,
			note: payoutNote || undefined,
		}
		try {
			if (editingPayoutId) {
				await updatePayout({
					employeeId,
					payoutId: editingPayoutId,
					body,
				}).unwrap()
			} else {
				await addPayout({ employeeId, body }).unwrap()
			}
			resetPayoutForm()
			ok()
		} catch (err) {
			fail(err)
		}
	}

	const handleDeletePayout = async (payoutId: string) => {
		try {
			await deletePayout({ employeeId, payoutId }).unwrap()
			if (editingPayoutId === payoutId) resetPayoutForm()
			ok()
		} catch (err) {
			fail(err)
		}
	}

	if (isLoading) return <Spinner m="2rem" />
	if (isError || !employee) {
		return (
			<Text m="2rem" color="red.500">
				{t('employees.notFound')}
			</Text>
		)
	}

	const breadcrumb = generateBreadcrumbs({
		id: employee.employeeId,
		name: employee.name,
	})

	return (
		<Flex direction="column" pb="2rem">
			<Box px="1rem">
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadcrumb[BreadCrumbItem.EMPLOYEE]}
				/>
				<HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
					<Heading fontSize="1.5rem">{employee.name}</Heading>
					<Button
						variant="ghost"
						onClick={() => navigate(RoutePaths.EMPLOYEES)}
						sx={hoverFocusActiveButtonStyles}
					>
						{t('employees.backToList')}
					</Button>
				</HStack>
				<Text fontSize="sm" color="gray.500" mb={4}>
					{t('employees.employeeId')}: {employee.employeeId}
				</Text>
			</Box>
			<Tabs px="1rem">
				<TabList>
					<Tab sx={tabStyles.tab}>{t('employees.tabs.overview')}</Tab>
					<Tab sx={tabStyles.tab}>{t('employees.tabs.schedule')}</Tab>
					<Tab sx={tabStyles.tab}>{t('employees.tabs.salary')}</Tab>
					<Tab sx={tabStyles.tab}>{t('employees.tabs.attendance')}</Tab>
					<Tab sx={tabStyles.tab}>{t('employees.tabs.leave')}</Tab>
				</TabList>
				<TabPanels>
					<TabPanel>
						<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} maxW="48rem">
							<FormControl isRequired>
								<FormLabel>{t('employees.name')}</FormLabel>
								<Input
									value={name}
									onChange={event => setName(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.phone')}</FormLabel>
								<Input
									value={phone}
									onChange={event => setPhone(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.address')}</FormLabel>
								<Input
									value={address}
									onChange={event => setAddress(event.target.value)}
								/>
							</FormControl>
							<FormControl isRequired>
								<FormLabel>{t('employees.employmentType')}</FormLabel>
								<Select
									value={employmentType}
									onChange={event => setEmploymentType(event.target.value)}
								>
									{EMPLOYMENT_TYPES.map(type => (
										<option key={type} value={type}>
											{t(`employees.types.${type}`)}
										</option>
									))}
								</Select>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.status')}</FormLabel>
								<Select
									value={status}
									onChange={event => setStatus(event.target.value)}
								>
									{EMPLOYEE_STATUSES.map(value => (
										<option key={value} value={value}>
											{t(`employees.statuses.${value}`)}
										</option>
									))}
								</Select>
							</FormControl>
							<FormControl isRequired>
								<FormLabel>{t('employees.startDate')}</FormLabel>
								<Input
									type="date"
									value={startDate}
									onChange={event => setStartDate(event.target.value)}
								/>
							</FormControl>
							{status === 'terminated' && (
								<FormControl isRequired>
									<FormLabel>{t('employees.endDate')}</FormLabel>
									<Input
										type="date"
										value={endDate || todayCalendarDate()}
										onChange={event => setEndDate(event.target.value)}
									/>
								</FormControl>
							)}
						</SimpleGrid>
						<Button
							mt={4}
							colorScheme="blue"
							isLoading={isSaving}
							onClick={saveOverview}
						>
							{t('common.save')}
						</Button>
					</TabPanel>
					<TabPanel>
						<Text mb={3}>{t('employees.workingDays')}</Text>
						<HStack wrap="wrap" mb={4}>
							{WEEKDAYS.map(day => (
								<Checkbox
									key={day}
									isChecked={workingDays.includes(day)}
									onChange={event => {
										setWorkingDays(current =>
											event.target.checked
												? [...current, day]
												: current.filter(value => value !== day),
										)
									}}
								>
									{t(`employees.days.${day}`)}
								</Checkbox>
							))}
						</HStack>
						<HStack maxW="24rem" mb={4}>
							<FormControl>
								<FormLabel>{t('employees.workStart')}</FormLabel>
								<Input
									type="time"
									value={workStart}
									onChange={event => setWorkStart(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.workEnd')}</FormLabel>
								<Input
									type="time"
									value={workEnd}
									onChange={event => setWorkEnd(event.target.value)}
								/>
							</FormControl>
						</HStack>
						<Button
							colorScheme="blue"
							isLoading={isSaving}
							onClick={saveSchedule}
						>
							{t('common.save')}
						</Button>
					</TabPanel>
					<TabPanel>
						<Heading size="sm" mb={3}>
							{t('employees.rateHistory')}
						</Heading>
						<Table size="sm" mb={6}>
							<Thead>
								<Tr>
									<Th>{t('employees.effectiveDate')}</Th>
									<Th>{t('employees.salaryType')}</Th>
									<Th>{t('employees.amount')}</Th>
									<Th>{t('employees.overtimeRate')}</Th>
								</Tr>
							</Thead>
							<Tbody>
								{[...employee.salaries]
									.sort((left, right) =>
										right.effectiveDate.localeCompare(left.effectiveDate),
									)
									.map(salary => (
										<Tr key={salary.salaryId}>
											<Td>{salary.effectiveDate}</Td>
											<Td>{t(`employees.salaryTypes.${salary.type}`)}</Td>
											<Td>
												{salary.amount} {salary.currencyName}
											</Td>
											<Td>{salary.overtimeRate ?? '—'}</Td>
										</Tr>
									))}
							</Tbody>
						</Table>
						<SimpleGrid
							columns={{ base: 1, md: 2 }}
							spacing={3}
							maxW="48rem"
							mb={4}
						>
							<FormControl>
								<FormLabel>{t('employees.salaryType')}</FormLabel>
								<Select
									value={salaryType}
									onChange={event => setSalaryType(event.target.value)}
								>
									{SALARY_TYPES.map(type => (
										<option key={type} value={type}>
											{t(`employees.salaryTypes.${type}`)}
										</option>
									))}
								</Select>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.amount')}</FormLabel>
								<Input
									type="number"
									value={salaryAmount}
									onChange={event => setSalaryAmount(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.currency')}</FormLabel>
								<Select
									value={salaryCurrencyId}
									onChange={event => setSalaryCurrencyId(event.target.value)}
								>
									{currencies.map(currency => (
										<option
											key={currency.currencyId}
											value={currency.currencyId}
										>
											{currency.name}
										</option>
									))}
								</Select>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.effectiveDate')}</FormLabel>
								<Input
									type="date"
									value={salaryEffectiveDate}
									onChange={event => setSalaryEffectiveDate(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.overtimeRate')}</FormLabel>
								<Input
									type="number"
									value={overtimeRate}
									onChange={event => setOvertimeRate(event.target.value)}
								/>
							</FormControl>
						</SimpleGrid>
						<Button
							colorScheme="blue"
							mb={8}
							isLoading={isAddingSalary}
							isDisabled={!salaryAmount || !salaryCurrencyId}
							onClick={handleAddSalary}
						>
							{t('employees.addSalary')}
						</Button>
						<Heading size="sm" mb={3}>
							{t('employees.payouts')}
						</Heading>
						<Table size="sm" mb={4}>
							<Thead>
								<Tr>
									<Th>{t('employees.payoutDate')}</Th>
									<Th>{t('employees.amount')}</Th>
									<Th>{t('employees.note')}</Th>
									<Th />
								</Tr>
							</Thead>
							<Tbody>
								{[...employee.payouts]
									.sort((left, right) => right.date.localeCompare(left.date))
									.map(payout => (
										<Tr key={payout.payoutId}>
											<Td>{payout.date}</Td>
											<Td>
												{payout.amount} {payout.currencyName}
											</Td>
											<Td>{payout.note || '—'}</Td>
											<Td>
												<HStack>
													<Button
														size="xs"
														onClick={() => beginEditPayout(payout)}
													>
														{t('employees.edit')}
													</Button>
													<Button
														size="xs"
														variant="outline"
														isLoading={isDeletingPayout}
														onClick={() => handleDeletePayout(payout.payoutId)}
													>
														{t('employees.delete')}
													</Button>
												</HStack>
											</Td>
										</Tr>
									))}
							</Tbody>
						</Table>
						<SimpleGrid
							columns={{ base: 1, md: 2 }}
							spacing={3}
							maxW="48rem"
							mb={4}
						>
							<FormControl>
								<FormLabel>{t('employees.payoutDate')}</FormLabel>
								<Input
									type="date"
									value={payoutDate}
									onChange={event => setPayoutDate(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.amount')}</FormLabel>
								<Input
									type="number"
									value={payoutAmount}
									onChange={event => setPayoutAmount(event.target.value)}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.currency')}</FormLabel>
								<Select
									value={payoutCurrencyId}
									onChange={event => setPayoutCurrencyId(event.target.value)}
								>
									{currencies.map(currency => (
										<option
											key={currency.currencyId}
											value={currency.currencyId}
										>
											{currency.name}
										</option>
									))}
								</Select>
							</FormControl>
							<FormControl>
								<FormLabel>{t('employees.note')}</FormLabel>
								<Input
									value={payoutNote}
									onChange={event => setPayoutNote(event.target.value)}
								/>
							</FormControl>
						</SimpleGrid>
						<HStack>
							<Button
								colorScheme="blue"
								isLoading={isAddingPayout || isUpdatingPayout}
								isDisabled={!payoutAmount || !payoutCurrencyId}
								onClick={handleSavePayout}
							>
								{editingPayoutId
									? t('employees.updatePayout')
									: t('employees.addPayout')}
							</Button>
							{editingPayoutId && (
								<Button variant="ghost" onClick={resetPayoutForm}>
									{t('common.cancel')}
								</Button>
							)}
						</HStack>
					</TabPanel>
					<TabPanel>
						<Text color="gray.500">{t('employees.placeholder')}</Text>
					</TabPanel>
					<TabPanel>
						<Text color="gray.500">{t('employees.placeholder')}</Text>
					</TabPanel>
				</TabPanels>
			</Tabs>
		</Flex>
	)
}

export default EmployeeProfilePage
