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
	// Replace with useGetInvoicesQuery() once invoices API is available
	const isLoading = false
	const invoices = MOCK_INVOICES
	const breadCrumbItems = generateBreadcrumbs()

	return (
		<Box>
			<CustomBreadcrumb items={breadCrumbItems[BreadCrumbItem.INVOICES]} />
			<Heading size="lg" mb={6}>
				Invoices
			</Heading>

			{isLoading && <Spinner />}

			{!isLoading && invoices.length === 0 && (
				<Text color="gray.500">No invoices found.</Text>
			)}

			{!isLoading && invoices.length > 0 && (
				<Box overflowX="auto">
					<Table variant="simple" size="sm">
						<Thead>
							<Tr>
								<Th>Invoice #</Th>
								<Th>Order #</Th>
								<Th>Status</Th>
								<Th isNumeric>Amount (€)</Th>
								<Th>Issued</Th>
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
