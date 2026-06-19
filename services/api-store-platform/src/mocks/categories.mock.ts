export interface CategoryMock {
	_id: string
	name: string
	description?: string
	parentCategoryId?: string
}

export const CATEGORIES_MOCK: CategoryMock[] = [
	{
		_id: 'cat-001',
		name: 'Electronics',
		description: 'Electronic devices and accessories',
	},
	{
		_id: 'cat-002',
		name: 'Computers',
		description: 'Computers and computer accessories',
		parentCategoryId: 'cat-001',
	},
	{
		_id: 'cat-003',
		name: 'Peripherals',
		description: 'Computer peripherals and input devices',
		parentCategoryId: 'cat-002',
	},
	{
		_id: 'cat-004',
		name: 'Mobile Devices',
		description: 'Mobile phones and tablets',
		parentCategoryId: 'cat-001',
	},
	{
		_id: 'cat-005',
		name: 'Networking',
		description: 'Network devices and equipment',
		parentCategoryId: 'cat-001',
	},
]

export const getCategoryById = (
	categoryId: string | undefined,
): CategoryMock | undefined => {
	if (!categoryId) return undefined

	return CATEGORIES_MOCK.find(c => c._id === categoryId)
}

export const getCategoryName = (
	categoryId: string | undefined,
): string | undefined => {
	return getCategoryById(categoryId)?.name
}
