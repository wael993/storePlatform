export interface SupplierMock {
	_id: string
	name: string
	email?: string
	phone?: string
	country?: string
}

export const SUPPLIERS_MOCK: SupplierMock[] = [
	{
		_id: 'sup-001',
		name: 'Global Tech Supplies',
		email: 'contact@globaltechsupplies.com',
		phone: '+49 123 456789',
		country: 'Germany',
	},
	{
		_id: 'sup-002',
		name: 'European Electronics Ltd',
		email: 'sales@euroelectronics.eu',
		phone: '+44 20 7946 0958',
		country: 'United Kingdom',
	},
	{
		_id: 'sup-003',
		name: 'Asia Tech Imports',
		email: 'import@asiatechimports.com',
		phone: '+852 3956 1234',
		country: 'Hong Kong',
	},
	{
		_id: 'sup-004',
		name: 'Direct Components Wholesale',
		email: 'wholesale@directcomponents.de',
		phone: '+49 30 12345678',
		country: 'Germany',
	},
	{
		_id: 'sup-005',
		name: 'Premium Distributors Inc',
		email: 'distribution@premiumdist.com',
		phone: '+33 1 42 68 53 00',
		country: 'France',
	},
]

export const getSupplierById = (
	supplierId: string | undefined,
): SupplierMock | undefined => {
	if (!supplierId) return undefined

	return SUPPLIERS_MOCK.find(s => s._id === supplierId)
}

export const getSupplierName = (
	supplierId: string | undefined,
): string | undefined => {
	return getSupplierById(supplierId)?.name
}
