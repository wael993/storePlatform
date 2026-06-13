import {
	Badge,
	Box,
	Heading,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'
import { useTranslation } from 'react-i18next'

// Placeholder invoices data until backend invoices API is wired up
const MOCK_INVOICES: {
	_id: string
	invoiceNumber: string
	orderNumber: string
	status: string
	amount: number
	issuedAt: string
}[] = []

const statusColor: Record<string, string> = {
	draft: 'gray',
	issued: 'blue',
	paid: 'green',
	overdue: 'red',
	cancelled: 'orange',
}

const InvoicesPage = () => {
	const { t } = useTranslation()
	// Replace with useGetInvoicesQuery() once invoices API is available
	const isLoading = false
	const invoices = MOCK_INVOICES
	const breadCrumbItems = generateBreadcrumbs()

	return (
		<Box>
			<CustomBreadcrumb items={breadCrumbItems[BreadCrumbItem.INVOICES]} />
			<Heading size="lg" mb={6}>
				{t('components.pageHeaders.invoices')}
			</Heading>

			{isLoading && <Spinner />}

			{!isLoading && invoices.length === 0 && (
				<Text color="gray.500">{t('invoices.empty')}</Text>
			)}

			{!isLoading && invoices.length > 0 && (
				<Box overflowX="auto">
					<Table variant="simple" size="sm">
						<Thead>
							<Tr>
								<Th>{t('invoices.invoiceNumber')}</Th>
								<Th>{t('orders.orderNumber')}</Th>
								<Th>{t('common.status')}</Th>
								<Th isNumeric>{t('invoices.amount')}</Th>
								<Th>{t('invoices.issued')}</Th>
							</Tr>
						</Thead>
						<Tbody>
							{invoices.map(inv => (
								<Tr key={inv._id}>
									<Td fontWeight="medium">{inv.invoiceNumber}</Td>
									<Td>{inv.orderNumber}</Td>
									<Td>
										<Badge colorScheme={statusColor[inv.status] ?? 'gray'}>
											{inv.status}
										</Badge>
									</Td>
									<Td isNumeric>{inv.amount.toFixed(2)}</Td>
									<Td>{new Date(inv.issuedAt).toLocaleDateString()}</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				</Box>
			)}
		</Box>
	)
}

export default InvoicesPage
