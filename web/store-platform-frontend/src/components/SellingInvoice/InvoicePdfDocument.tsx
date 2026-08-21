import {
	Document,
	Font,
	Image,
	Page,
	StyleSheet,
	Text,
	View,
} from '@react-pdf/renderer'

import type { InvoiceDocumentModel } from './invoiceDocumentModel'
import { compareLanguage } from '../../shared/utils'
import { InvoiceUiStatus } from '../../shared/globalEnums'
import i18n from '../../i18n'

const publicFontUrl = (fileName: string) =>
	new URL(`fonts/${fileName}`, `${window.location.origin}${import.meta.env.BASE_URL}`)
		.href

let fontsRegistered = false

export const ensureInvoicePdfFonts = () => {
	if (fontsRegistered) return

	Font.register({
		family: 'NotoNaskhArabic',
		fonts: [
			{
				src: publicFontUrl('NotoNaskhArabic-Regular.ttf'),
				fontWeight: 400,
			},
			{
				src: publicFontUrl('NotoNaskhArabic-Bold.ttf'),
				fontWeight: 700,
			},
		],
	})

	// Default hyphenation splits Arabic into broken isolated letters.
	Font.registerHyphenationCallback(word => [word])
	fontsRegistered = true
}

const colors = {
	ink: '#1c2430',
	muted: '#6b7280',
	body: '#374151',
	line: '#e5edf3',
	panel: '#f7fafc',
	brand: '#1f4b6e',
	brandSoft: '#e8f1f7',
	white: '#ffffff',
	dangerSoft: '#e8b4b4',
}

const createStyles = (rtl: boolean) =>
	StyleSheet.create({
		page: {
			fontFamily: 'NotoNaskhArabic',
			fontSize: 10,
			color: colors.ink,
			paddingTop: 28,
			paddingBottom: 32,
			paddingHorizontal: 28,
			direction: rtl ? 'rtl' : 'ltr',
		},
		accent: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			height: 6,
			backgroundColor: colors.brand,
		},
		watermark: {
			position: 'absolute',
			top: '40%',
			left: 40,
			right: 40,
			textAlign: 'center',
			fontSize: 48,
			fontWeight: 700,
			color: colors.dangerSoft,
			opacity: 0.35,
			transform: 'rotate(-28deg)',
		},
		header: {
			flexDirection: rtl ? 'row-reverse' : 'row',
			justifyContent: 'space-between',
			gap: 16,
			marginBottom: 18,
			paddingBottom: 14,
			borderBottomWidth: 1,
			borderBottomColor: colors.line,
		},
		brandRow: {
			flexDirection: rtl ? 'row-reverse' : 'row',
			gap: 12,
			flexGrow: 1,
			flexShrink: 1,
		},
		logo: {
			width: 56,
			height: 56,
			objectFit: 'contain',
		},
		brandName: {
			fontSize: 16,
			fontWeight: 700,
			color: colors.brand,
			marginBottom: 4,
			textAlign: rtl ? 'right' : 'left',
		},
		metaLine: {
			fontSize: 9,
			color: colors.body,
			marginTop: 2,
			textAlign: rtl ? 'right' : 'left',
		},
		docTitleWrap: {
			alignItems: rtl ? 'flex-start' : 'flex-end',
		},
		docTitle: {
			fontSize: 15,
			fontWeight: 700,
			color: colors.brand,
			marginBottom: 6,
			textAlign: rtl ? 'left' : 'right',
		},
		badge: {
			backgroundColor: colors.brandSoft,
			color: colors.brand,
			fontSize: 9,
			fontWeight: 700,
			paddingVertical: 3,
			paddingHorizontal: 8,
			borderRadius: 10,
		},
		grid: {
			flexDirection: rtl ? 'row-reverse' : 'row',
			gap: 10,
			marginBottom: 16,
		},
		card: {
			flex: 1,
			backgroundColor: colors.panel,
			borderWidth: 1,
			borderColor: colors.line,
			borderRadius: 8,
			padding: 10,
		},
		cardLabel: {
			fontSize: 8,
			fontWeight: 700,
			color: colors.muted,
			marginBottom: 4,
			textAlign: rtl ? 'right' : 'left',
		},
		cardValue: {
			fontSize: 11,
			fontWeight: 700,
			textAlign: rtl ? 'right' : 'left',
		},
		cardRow: {
			fontSize: 9,
			color: colors.body,
			marginTop: 3,
			textAlign: rtl ? 'right' : 'left',
		},
		table: {
			marginBottom: 14,
			borderWidth: 1,
			borderColor: colors.line,
			borderRadius: 8,
			overflow: 'hidden',
		},
		tableHeader: {
			flexDirection: rtl ? 'row-reverse' : 'row',
			backgroundColor: colors.brand,
			paddingVertical: 7,
			paddingHorizontal: 6,
		},
		tableRow: {
			flexDirection: rtl ? 'row-reverse' : 'row',
			paddingVertical: 7,
			paddingHorizontal: 6,
			borderTopWidth: 1,
			borderTopColor: colors.line,
		},
		tableRowAlt: {
			backgroundColor: '#f9fbfd',
		},
		th: {
			color: colors.white,
			fontSize: 8,
			fontWeight: 700,
			textAlign: rtl ? 'right' : 'left',
		},
		td: {
			fontSize: 9,
			color: colors.ink,
			textAlign: rtl ? 'right' : 'left',
		},
		colItem: { width: '28%' },
		colQty: { width: '10%' },
		colUnit: { width: '12%' },
		colPrice: { width: '16%' },
		colDiscount: { width: '14%' },
		colTotal: { width: '20%' },
		num: { textAlign: rtl ? 'left' : 'right' },
		totalsRow: {
			flexDirection: 'row',
			justifyContent: 'flex-end',
			alignItems: 'center',
			gap: 12,
			direction: 'ltr',
		},
		totals: {
			width: '42%',
			backgroundColor: colors.panel,
			borderWidth: 1,
			borderColor: colors.line,
			borderRadius: 8,
			paddingVertical: 8,
			paddingHorizontal: 10,
		},
		totalRow: {
			flexDirection: rtl ? 'row-reverse' : 'row',
			justifyContent: 'space-between',
			paddingVertical: 4,
			borderBottomWidth: 1,
			borderBottomColor: colors.line,
		},
		totalRowGrand: {
			borderBottomWidth: 0,
			borderTopWidth: 2,
			borderTopColor: colors.brand,
			marginTop: 4,
			paddingTop: 8,
		},
		totalLabel: {
			fontSize: 9,
			color: colors.body,
			textAlign: rtl ? 'right' : 'left',
		},
		totalValue: {
			fontSize: 9,
			fontWeight: 700,
			textAlign: rtl ? 'left' : 'right',
		},
		totalLabelGrand: {
			fontSize: 11,
			fontWeight: 700,
			color: colors.ink,
		},
		totalValueGrand: {
			fontSize: 11,
			fontWeight: 700,
		},
		qr: {
			width: 96,
			height: 96,
			objectFit: 'contain',
		},
		notes: {
			marginTop: 16,
			paddingTop: 10,
			borderTopWidth: 1,
			borderTopColor: colors.line,
		},
		notesTitle: {
			fontSize: 9,
			fontWeight: 700,
			color: colors.brand,
			marginBottom: 4,
			textAlign: rtl ? 'right' : 'left',
		},
		notesBody: {
			fontSize: 9,
			color: colors.body,
			textAlign: rtl ? 'right' : 'left',
		},
		footer: {
			marginTop: 14,
			paddingTop: 10,
			borderTopWidth: 1,
			borderTopColor: colors.line,
			fontSize: 8,
			color: colors.muted,
			textAlign: 'center',
		},
	})

const MetaLine = ({
	label,
	value,
	styles,
}: {
	label: string
	value: string
	styles: ReturnType<typeof createStyles>
}) => (
	<Text style={styles.metaLine}>
		{label}: {value}
	</Text>
)

export const InvoicePdfDocument = ({
	model,
}: {
	model: InvoiceDocumentModel
}) => {
	const { isArabic, isEnglish } = compareLanguage(i18n.language)
	const lang = isArabic ? 'ar' : isEnglish ? 'en' : 'de'
	const styles = createStyles(isArabic)
	const title =
		model.kind === 'buying'
			? model.labels.buyingInvoiceTitle
			: model.labels.invoiceTitle
	const partyLabel =
		model.kind === 'buying' ? model.labels.supplier : model.labels.billTo
	const showWatermark =
		model.status === InvoiceUiStatus.DRAFT ||
		model.status === InvoiceUiStatus.CANCELLED
	const money = (amount: number) =>
		`${model.formatAmount(amount)}${
			model.currencyLabel ? ` ${model.currencyLabel}` : ''
		}`

	return (
		<Document title={`${title} ${model.invoiceNumber}`} language={lang}>
			<Page size="A4" style={styles.page}>
				<View style={styles.accent} fixed />
				{showWatermark ? (
					<Text style={styles.watermark}>{model.statusLabel}</Text>
				) : null}

				<View style={styles.header}>
					<View style={styles.brandRow}>
						{model.brand.logoUrl ? (
							<Image src={model.brand.logoUrl} style={styles.logo} />
						) : null}
						<View>
							<Text style={styles.brandName}>{model.brand.displayName}</Text>
							{model.brand.address ? (
								<MetaLine
									label={model.labels.address}
									value={model.brand.address}
									styles={styles}
								/>
							) : null}
							{model.brand.phone ? (
								<MetaLine
									label={model.labels.phone}
									value={model.brand.phone}
									styles={styles}
								/>
							) : null}
							{model.brand.email ? (
								<MetaLine
									label={model.labels.email}
									value={model.brand.email}
									styles={styles}
								/>
							) : null}
							{model.brand.taxNumber ? (
								<MetaLine
									label={model.labels.taxNumber}
									value={model.brand.taxNumber}
									styles={styles}
								/>
							) : null}
						</View>
					</View>
					<View style={styles.docTitleWrap}>
						<Text style={styles.docTitle}>{title}</Text>
						<Text style={styles.badge}>{model.statusLabel}</Text>
					</View>
				</View>

				<View style={styles.grid}>
					<View style={styles.card}>
						<Text style={styles.cardLabel}>{partyLabel}</Text>
						<Text style={styles.cardValue}>{model.partyName}</Text>
					</View>
					<View style={styles.card}>
						<Text style={styles.cardLabel}>{model.labels.invoiceNumber}</Text>
						<Text style={styles.cardValue}>{model.invoiceNumber}</Text>
						<Text style={styles.cardRow}>
							{model.labels.date}: {model.invoiceDate}
						</Text>
						<Text style={styles.cardRow}>
							{model.labels.time}: {model.invoiceTime}
						</Text>
						<Text style={styles.cardRow}>
							{model.labels.paymentType}: {model.paymentTypeLabel}
						</Text>
						{model.salesPerson ? (
							<Text style={styles.cardRow}>
								{model.labels.salesPerson}: {model.salesPerson}
							</Text>
						) : null}
					</View>
				</View>

				<View style={styles.table}>
					<View style={styles.tableHeader}>
						<Text style={[styles.th, styles.colItem]}>{model.labels.item}</Text>
						<Text style={[styles.th, styles.colQty, styles.num]}>
							{model.labels.qty}
						</Text>
						<Text style={[styles.th, styles.colUnit]}>{model.labels.unit}</Text>
						<Text style={[styles.th, styles.colPrice, styles.num]}>
							{model.labels.unitPrice}
						</Text>
						<Text style={[styles.th, styles.colDiscount, styles.num]}>
							{model.labels.discount}
						</Text>
						<Text style={[styles.th, styles.colTotal, styles.num]}>
							{model.labels.lineTotal}
						</Text>
					</View>
					{model.lines.map((line, index) => (
						<View
							key={`${line.name}-${index}`}
							style={
								index % 2 === 1
									? [styles.tableRow, styles.tableRowAlt]
									: styles.tableRow
							}
							wrap={false}
						>
							<Text style={[styles.td, styles.colItem]}>{line.name}</Text>
							<Text style={[styles.td, styles.colQty, styles.num]}>
								{String(line.quantity)}
							</Text>
							<Text style={[styles.td, styles.colUnit]}>
								{line.unit || '—'}
							</Text>
							<Text style={[styles.td, styles.colPrice, styles.num]}>
								{model.formatAmount(line.unitPrice)}
							</Text>
							<Text style={[styles.td, styles.colDiscount, styles.num]}>
								{line.discountLabel}
							</Text>
							<Text style={[styles.td, styles.colTotal, styles.num]}>
								{model.formatAmount(line.lineTotal)}
							</Text>
						</View>
					))}
					{model.lines.length === 0 ? (
						<View style={styles.tableRow}>
							<Text style={styles.td}>—</Text>
						</View>
					) : null}
				</View>
				<View style={{ ...styles.totalsRow, justifyContent: 'space-between' }}>
					<View style={styles.totals}>
						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>{model.labels.subtotal}</Text>
							<Text style={styles.totalValue}>{money(model.subtotal)}</Text>
						</View>
						{model.discount > 0 ? (
							<View style={styles.totalRow}>
								<Text style={styles.totalLabel}>
									{model.labels.invoiceDiscount}
								</Text>
								<Text style={styles.totalValue}>{money(model.discount)}</Text>
							</View>
						) : null}
						{model.tax > 0 ? (
							<View style={styles.totalRow}>
								<Text style={styles.totalLabel}>{model.labels.tax}</Text>
								<Text style={styles.totalValue}>{money(model.tax)}</Text>
							</View>
						) : null}
						<View style={[styles.totalRow, styles.totalRowGrand]}>
							<Text style={[styles.totalLabel, styles.totalLabelGrand]}>
								{model.labels.grandTotal}
							</Text>
							<Text style={[styles.totalValue, styles.totalValueGrand]}>
								{money(model.grandTotal)}
							</Text>
						</View>
						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>{model.labels.paid}</Text>
							<Text style={styles.totalValue}>{money(model.paid)}</Text>
						</View>
						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>{model.labels.due}</Text>
							<Text style={styles.totalValue}>{money(model.due)}</Text>
						</View>
					</View>
					{model.brand.qrUrl ? (
						<Image src={model.brand.qrUrl} style={styles.qr} />
					) : null}
				</View>

				{model.notes ? (
					<View style={styles.notes}>
						<Text style={styles.notesTitle}>{model.labels.notes}</Text>
						<Text style={styles.notesBody}>{model.notes}</Text>
					</View>
				) : null}

				{model.brand.footerNote ? (
					<Text style={styles.footer}>{model.brand.footerNote}</Text>
				) : null}
			</Page>
		</Document>
	)
}
