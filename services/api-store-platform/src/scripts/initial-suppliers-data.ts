export type InitialSupplierData = {
	name: string
	internalCode: string
	amount: number
	direction: 'payable' | 'receivable'
	phone?: string
}

// Generated from موردون دفتر الأستاذ.xlsx.
export const INITIAL_SUPPLIERS_DATA: InitialSupplierData[] = [
	{
		name: 'حسين احمد المؤذن / شركة عالم الرولمان',
		internalCode: '22111',
		amount: 10222,
		direction: 'payable',
	},
	{
		name: 'ماهر مسلم اللحام',
		internalCode: '22118',
		amount: 995.3,
		direction: 'payable',
	},
	{
		name: 'عارف الحبش / حساب دولار',
		internalCode: '22119',
		amount: 49123.45,
		direction: 'payable',
	},
	{
		name: 'ماهر الزوباني / ابو رامي',
		internalCode: '22120',
		amount: 1505.68,
		direction: 'payable',
	},
	{
		name: 'شركة بيرودا',
		internalCode: '221217',
		amount: 7611.9,
		direction: 'payable',
	},
	{
		name: 'عبد الغني مؤذن / ابو عمار',
		internalCode: '22122',
		amount: 27.12,
		direction: 'payable',
	},
	{
		name: 'حوش بلاس',
		internalCode: '22123',
		amount: 95.1,
		direction: 'payable',
	},
	{
		name: 'عمر ..ابو تيم عيشات',
		internalCode: '221247',
		amount: 10700,
		direction: 'payable',
	},
	{
		name: 'شركة الشويش / ابو ناصر / الرقة',
		internalCode: '22125',
		amount: 5045,
		direction: 'payable',
	},
	{
		name: 'شركة شرق اسيا',
		internalCode: '22126',
		amount: 1167.02,
		direction: 'payable',
	},
	{
		name: 'السلامات للتجارة العامة / ابو قيصر',
		internalCode: '22127',
		amount: 1666.5,
		direction: 'payable',
		phone: '0954048570',
	},
	{
		name: 'يحيى محمد ايبش / دمش الزاهرة',
		internalCode: '22128',
		amount: 5243.82,
		direction: 'payable',
	},
	{
		name: 'ابو محمد الحلبي .. موزع فان قديم / جرمانا',
		internalCode: '22129',
		amount: 1555,
		direction: 'payable',
	},
	{
		name: 'بضاعة اول مدة',
		internalCode: '22130',
		amount: 8073.43,
		direction: 'payable',
	},
	{
		name: 'الفجر براغي حلب',
		internalCode: '22131',
		amount: 348,
		direction: 'payable',
		phone: '0968827940',
	},
	{
		name: 'بضاعة اول مدة / عمار الزوباني',
		internalCode: '22132',
		amount: 22520.82,
		direction: 'payable',
	},
	{
		name: 'قصار',
		internalCode: '22134',
		amount: 756.09,
		direction: 'payable',
	},
	{
		name: 'محمد النابلسي ابو وسيم',
		internalCode: '22136',
		amount: 104.96,
		direction: 'receivable',
	},
	{
		name: 'وليد الغانم',
		internalCode: '22137',
		amount: 477.78,
		direction: 'payable',
	},
	{
		name: 'موزع تسيل.. العامر',
		internalCode: '22138',
		amount: 135,
		direction: 'payable',
	},
	{
		name: 'خالد ايبش',
		internalCode: '22139',
		amount: 884,
		direction: 'payable',
	},
	{
		name: 'مستلم من الفرع الثاني',
		internalCode: '22140',
		amount: 11971.44,
		direction: 'payable',
	},
]
