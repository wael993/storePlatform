import {
	Box,
	Button,
	Flex,
	FormControl,
	FormLabel,
	Heading,
	HStack,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Select,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useDisclosure,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AddSquareIcon } from '../icons/AddSquare'
import CustomBreadcrumb from '../CustomBreadcrumb'
import {
	useCreateEmployeeMutation,
	useGetEmployeesQuery,
} from '../../api/apiStore'
import { BreadCrumbItem } from '../../shared/globalEnums'
import { buildRoutePath, generateBreadcrumbs } from '../../shared/routes'
import {
	EMPLOYMENT_TYPES,
	Employee,
	isTerminated,
	todayCalendarDate,
} from '../../shared/employee'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { formatNumber } from '../../shared/utils'

const styles = {
	wrapper: { width: '100%', flexDir: 'column', paddingBottom: '1rem' },
	header: { flexDir: 'column', width: '100%', paddingX: '1rem' },
	title: {
		fontSize: '1.5rem',
		fontWeight: 700,
		marginTop: '0.4rem',
		paddingX: '1rem',
	},
	addButton: { ...hoverFocusActiveButtonStyles, gap: '0.25rem' },
	tab: {
		borderRadius: 0,
		fontWeight: 700,
		fontSize: '0.875rem',
	},
} satisfies StylesObject

const EmployeesPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const breadCrumbItems = generateBreadcrumbs()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const { data: employees = [], isLoading } = useGetEmployeesQuery()
	const [createEmployee, { isLoading: isCreating }] =
		useCreateEmployeeMutation()
	const [tab, setTab] = useState<'current' | 'terminated'>('current')
	const [search, setSearch] = useState('')
	const [name, setName] = useState('')
	const [employmentType, setEmploymentType] = useState('full_time')
	const [startDate, setStartDate] = useState(todayCalendarDate())
	const [phone, setPhone] = useState('')
	const [address, setAddress] = useState('')
	const [error, setError] = useState('')

	const rows = useMemo(() => {
		const needle = search.trim().toLowerCase()
		const filtered = employees.filter(employee => {
			const onTerminatedTab = tab === 'terminated'
			if (isTerminated(employee) !== onTerminatedTab) return false
			if (!needle) return true
			return [employee.name, employee.phone ?? '', employee.employeeId].some(
				value => value.toLowerCase().includes(needle),
			)
		})
		if (tab === 'terminated') {
			return [...filtered].sort((left, right) =>
				(right.endDate ?? '').localeCompare(left.endDate ?? ''),
			)
		}
		return filtered
	}, [employees, search, tab])

	const resetModal = () => {
		setName('')
		setEmploymentType('full_time')
		setStartDate(todayCalendarDate())
		setPhone('')
		setAddress('')
		setError('')
	}

	const handleCreate = async () => {
		setError('')
		try {
			const created = await createEmployee({
				name,
				employmentType,
				startDate,
				phone: phone || undefined,
				address: address || undefined,
			}).unwrap()
			resetModal()
			onClose()
			navigate(buildRoutePath.employeeById(created.employeeId))
		} catch (err) {
			const failed = err as { data?: { message?: string } }
			setError(failed?.data?.message || t('employees.saveFailed'))
		}
	}

	const salaryLabel = (employee: Employee) => {
		if (!employee.currentSalary) return '—'
		return `${formatNumber(employee.currentSalary.amount) ?? employee.currentSalary.amount} ${employee.currentSalary.currencyName}`
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.EMPLOYEES]}
				/>
			</Flex>
			<HStack
				justify="space-between"
				mb={{ base: '1.5rem', md: '2rem' }}
				flexWrap="wrap"
				gap={3}
			>
				<Heading sx={styles.title} variant="h5">
					{t('components.pageHeaders.employees')}
				</Heading>
				<Button
					leftIcon={<AddSquareIcon />}
					onClick={onOpen}
					sx={styles.addButton}
					variant="ghost"
				>
					<Text fontSize="0.875rem" fontWeight={700} color="#1E1E1E">
						{t('employees.add')}
					</Text>
				</Button>
			</HStack>
			<HStack px="1rem" mb={4} flexWrap="wrap" gap={3}>
				<Button
					sx={styles.tab}
					variant={tab === 'current' ? 'solid' : 'outline'}
					onClick={() => setTab('current')}
				>
					{t('employees.currentTab')}
				</Button>
				<Button
					sx={styles.tab}
					variant={tab === 'terminated' ? 'solid' : 'outline'}
					onClick={() => setTab('terminated')}
				>
					{t('employees.terminatedTab')}
				</Button>
				<Input
					maxW="18rem"
					value={search}
					onChange={event => setSearch(event.target.value)}
					placeholder={t('employees.search')}
				/>
			</HStack>
			{isLoading && <Spinner ml="1rem" />}
			<Box px="1rem" overflowX="auto">
				<Table size="sm">
					<Thead>
						<Tr>
							<Th>{t('employees.name')}</Th>
							<Th>{t('employees.employmentType')}</Th>
							<Th>{t('employees.status')}</Th>
							<Th>{t('employees.startDate')}</Th>
							<Th>{t('employees.currentSalary')}</Th>
						</Tr>
					</Thead>
					<Tbody>
						{rows.map(employee => (
							<Tr
								key={employee.employeeId}
								cursor="pointer"
								onClick={() =>
									navigate(buildRoutePath.employeeById(employee.employeeId))
								}
							>
								<Td>{employee.name}</Td>
								<Td>{t(`employees.types.${employee.employmentType}`)}</Td>
								<Td>{t(`employees.statuses.${employee.status}`)}</Td>
								<Td>{employee.startDate}</Td>
								<Td>{salaryLabel(employee)}</Td>
							</Tr>
						))}
					</Tbody>
				</Table>
				{!isLoading && rows.length === 0 && (
					<Text mt={4} color="gray.500">
						{t('employees.empty')}
					</Text>
				)}
			</Box>
			<Modal
				isOpen={isOpen}
				onClose={() => {
					resetModal()
					onClose()
				}}
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('employees.add')}</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<FormControl mb={3} isRequired>
							<FormLabel>{t('employees.name')}</FormLabel>
							<Input
								value={name}
								onChange={event => setName(event.target.value)}
							/>
						</FormControl>
						<FormControl mb={3} isRequired>
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
						<FormControl mb={3} isRequired>
							<FormLabel>{t('employees.startDate')}</FormLabel>
							<Input
								type="date"
								value={startDate}
								onChange={event => setStartDate(event.target.value)}
							/>
						</FormControl>
						<FormControl mb={3}>
							<FormLabel>{t('employees.phone')}</FormLabel>
							<Input
								value={phone}
								onChange={event => setPhone(event.target.value)}
							/>
						</FormControl>
						<FormControl mb={3}>
							<FormLabel>{t('employees.address')}</FormLabel>
							<Input
								value={address}
								onChange={event => setAddress(event.target.value)}
							/>
						</FormControl>
						{error && (
							<Text color="red.500" fontSize="sm">
								{error}
							</Text>
						)}
					</ModalBody>
					<ModalFooter>
						<Button
							mr={3}
							onClick={() => {
								resetModal()
								onClose()
							}}
						>
							{t('common.cancel')}
						</Button>
						<Button
							colorScheme="blue"
							isLoading={isCreating}
							isDisabled={!name.trim() || !startDate}
							onClick={handleCreate}
						>
							{t('common.save')}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Flex>
	)
}

export default EmployeesPage
