import {
	Box,
	Badge,
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

// Placeholder orders data until backend orders API is wired up
const MOCK_ORDERS: {
	_id: string
	orderNumber: string
	status: string
	total: number
	items: number
	date: string
}[] = []

const statusColor: Record<string, string> = {
	pending: 'yellow',
	processing: 'blue',
	completed: 'green',
	cancelled: 'red',
}

const OrdersPage = () => {
	// Replace with useGetOrdersQuery() once orders API is available
	const isLoading = false
	const orders = MOCK_ORDERS
	const breadCrumbItems = generateBreadcrumbs()

	return (
		<Box>
			<CustomBreadcrumb items={breadCrumbItems[BreadCrumbItem.ORDERS]} />
			<Heading size="lg" mb={6}>
				Orders
			</Heading>

			{isLoading && <Spinner />}

			{!isLoading && orders.length === 0 && (
				<Text color="gray.500">No orders found.</Text>
			)}

			{!isLoading && orders.length > 0 && (
				<Box overflowX="auto">
					<Table variant="simple" size="sm">
						<Thead>
							<Tr>
								<Th>Order #</Th>
								<Th>Status</Th>
								<Th isNumeric>Items</Th>
								<Th isNumeric>Total (€)</Th>
								<Th>Date</Th>
							</Tr>
						</Thead>
						<Tbody>
							{orders.map(o => (
								<Tr key={o._id}>
									<Td fontWeight="medium">{o.orderNumber}</Td>
									<Td>
										<Badge colorScheme={statusColor[o.status] ?? 'gray'}>
											{o.status}
										</Badge>
									</Td>
									<Td isNumeric>{o.items}</Td>
									<Td isNumeric>{o.total.toFixed(2)}</Td>
									<Td>{new Date(o.date).toLocaleDateString()}</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				</Box>
			)}
		</Box>
	)
}

export default OrdersPage
