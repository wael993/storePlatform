export interface OrderItemMock {
	productId: string
	productName: string
	quantity: number
	unitPrice: number
	totalPrice: number
}

export interface OrderMock {
	_id: string
	orderNumber: string
	customerId?: string
	customerName?: string
	items: OrderItemMock[]
	status: 'draft' | 'open' | 'paid' | 'cancelled'
	totalAmount: number
	tax: number
	discount?: number
	finalAmount: number
	orderDate: Date
	dueDate?: Date
	notes?: string
}

export const ORDERS_MOCK: OrderMock[] = [
	{
		_id: 'order-001',
		orderNumber: 'ORD-001-2026',
		customerId: 'cust-001',
		customerName: 'Tech Store Berlin',
		items: [
			{
				productId: '321654987352',
				productName: 'Wireless Mouse',
				quantity: 50,
				unitPrice: 19.99,
				totalPrice: 999.5,
			},
			{
				productId: '321654987353',
				productName: 'USB-C Cable',
				quantity: 100,
				unitPrice: 5.99,
				totalPrice: 599.0,
			},
		],
		status: 'open',
		totalAmount: 1598.5,
		tax: 303.73,
		discount: 100.0,
		finalAmount: 1802.23,
		orderDate: new Date('2026-05-10'),
		dueDate: new Date('2026-06-10'),
		notes: 'Bulk order for retail store',
	},
	{
		_id: 'order-002',
		orderNumber: 'ORD-002-2026',
		customerId: 'cust-002',
		customerName: 'Electronics Shop Munich',
		items: [
			{
				productId: '321654987352',
				productName: 'Wireless Mouse',
				quantity: 25,
				unitPrice: 19.99,
				totalPrice: 499.75,
			},
		],
		status: 'paid',
		totalAmount: 499.75,
		tax: 94.95,
		finalAmount: 594.7,
		orderDate: new Date('2026-05-01'),
		dueDate: new Date('2026-05-31'),
		notes: 'Payment received',
	},
	{
		_id: 'order-003',
		orderNumber: 'ORD-003-2026',
		customerId: 'cust-003',
		customerName: 'IT Solutions GmbH',
		items: [
			{
				productId: '321654987354',
				productName: 'Mechanical Keyboard',
				quantity: 30,
				unitPrice: 89.99,
				totalPrice: 2699.7,
			},
			{
				productId: '321654987355',
				productName: 'Monitor Stand',
				quantity: 15,
				unitPrice: 34.99,
				totalPrice: 524.85,
			},
		],
		status: 'draft',
		totalAmount: 3224.55,
		tax: 612.66,
		discount: 50.0,
		finalAmount: 3787.21,
		orderDate: new Date('2026-05-15'),
		notes: 'Draft - awaiting approval',
	},
]

export const getOrderById = (orderId: string): OrderMock | undefined => {
	return ORDERS_MOCK.find(o => o._id === orderId)
}

export const getOrderByOrderNumber = (
	orderNumber: string,
): OrderMock | undefined => {
	return ORDERS_MOCK.find(o => o.orderNumber === orderNumber)
}

export const getOrdersByStatus = (status: OrderMock['status']): OrderMock[] => {
	return ORDERS_MOCK.filter(o => o.status === status)
}
