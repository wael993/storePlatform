export interface BrandMock {
	_id: string
	name: string
	description?: string
}

export const BRANDS_MOCK: BrandMock[] = [
	{
		_id: 'brand-001',
		name: 'TechPro',
		description: 'Premium technology products',
	},
	{
		_id: 'brand-002',
		name: 'EliteElectronics',
		description: 'High-end electronics',
	},
	{
		_id: 'brand-003',
		name: 'SmartHome',
		description: 'Smart home devices',
	},
	{
		_id: 'brand-004',
		name: 'PowerMax',
		description: 'Power and energy products',
	},
	{
		_id: 'brand-005',
		name: 'VisionTech',
		description: 'Visual technology and displays',
	},
]

export const getBrandById = (
	brandId: string | undefined,
): BrandMock | undefined => {
	if (!brandId) return undefined

	return BRANDS_MOCK.find(b => b._id === brandId)
}

export const getBrandName = (
	brandId: string | undefined,
): string | undefined => {
	return getBrandById(brandId)?.name
}
