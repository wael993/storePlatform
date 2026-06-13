import { Workbook, type Column } from 'exceljs'
import { DailyAction } from '../types/api'

type ExcelHeader = Partial<Column>

const parseNumber = (value?: string) => {
	if (!value) return ''
	const numberValue = Number(value)

	return Number.isNaN(numberValue) ? value : numberValue
}

export const generateDailyActionsExcel = (dailyActions: DailyAction[]) => {
	const workbook = new Workbook()
	const worksheet = workbook.addWorksheet('Daily Actions')
	const feeNumberFormat = '#,##0.00 "SYP"'

	const formatExcelRow = (row: Record<string, unknown>) => {
		const formattedObject: Record<string, unknown> = {}

		Object.keys(row).forEach(key => {
			formattedObject[key] = row[key] ?? ''
		})

		return formattedObject
	}

	const headers: ExcelHeader[] = [
		{ header: 'Entry Type', key: 'entryType', width: 20 },
		{ header: 'Product Name', key: 'productName', width: 20 },
		{ header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
		{ header: 'Invoice Date', key: 'invoiceDate', width: 20 },
		{ header: 'Supplier Name', key: 'supplierName', width: 20 },
		{ header: 'Customer Name', key: 'customerName', width: 20 },
		{ header: 'Currency Name', key: 'currencyName', width: 20 },
		{ header: 'Unit Name', key: 'unitName', width: 20 },
		{ header: 'Weight', key: 'weight', width: 20 },
		{
			header: 'Single Unit Price',
			key: 'singleUnitPrice',
			width: 20,
			style: {
				numFmt: feeNumberFormat,
			},
		},
		{
			header: 'Total Price',
			key: 'totalPrice',
			width: 20,
			style: {
				numFmt: feeNumberFormat,
			},
		},
	]
	worksheet.columns = headers

	const rows: Record<string, unknown>[] = []
	dailyActions.forEach(dailyAction => {
		const row = {
			entryType: dailyAction.entryType,
			productName: dailyAction.productName,
			invoiceNumber: dailyAction.invoiceNumber,
			invoiceDate: dailyAction.invoiceDate
				? new Date(dailyAction.invoiceDate)
				: undefined,
			supplierName: dailyAction.supplierName,
			customerName: dailyAction.customerName,
			currencyName: dailyAction.currencyName,
			unitName: dailyAction.unitName,
			weight: dailyAction.weight,
			singleUnitPrice: parseNumber(dailyAction.singleUnitPrice),
			totalPrice: parseNumber(dailyAction.totalPrice),
		}
		rows.push(formatExcelRow(row))
	})
	rows.forEach(row => {
		const excelRow = worksheet.addRow(row)

		excelRow.alignment = {
			wrapText: true,
			vertical: 'middle',
			horizontal: 'left',
		}
	})

	return workbook
}
