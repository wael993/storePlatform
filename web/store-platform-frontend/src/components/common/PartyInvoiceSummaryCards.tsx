import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
	Box,
	Button,
	Flex,
	HStack,
	IconButton,
	Text,
	VStack,
} from '@chakra-ui/react'
import { AddIcon, MinusIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'

import { DollarSignIcon } from '../../icons/DollarSign'
import { WalletIcon } from '../../icons/Wallet'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import CurrencyAmountTooltip from '../SellingInvoice/CurrencyAmountTooltip'
import {
	buildDisplayCurrencyOptions,
	convertToPrimaryAmount,
	formatDisplayAmount,
	resolveAdditionalCurrencyRows,
} from '../SellingInvoice/currencyDisplay'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import { formatNumber } from '../../shared/utils'
import {
	useGetCurrencySettingsQuery,
	useUpdateCustomerOpeningBalanceMutation,
	useUpdateSupplierOpeningBalanceMutation,
} from '../../api/apiStore'
import useCustomToast from './CustomToast'

const styles = {
	container: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
		gap: '1rem',
		width: '100%',
		fontSize: '0.9rem',
		alignItems: 'start',
	},
	row: {
		width: '100%',
		display: 'grid',
		gridTemplateColumns: {
			base: 'auto 1fr auto',
			md: 'auto 1fr',
		},
		gridTemplateAreas: {
			base: '"icon label value"',
			md: '"icon label" "icon value"',
		},
		columnGap: '0.5rem',
		rowGap: { base: 0, md: '0.125rem' },
		alignItems: 'center',
		py: '0.25rem',
	},
	label: {
		gridArea: 'label',
		color: PAGE_COLORS.muted,
		fontSize: '0.75em',
		fontWeight: 800,
		lineHeight: 'normal',
		minW: 0,
	},
	value: {
		gridArea: 'value',
		fontSize: '1em',
		fontWeight: 700,
		color: 'gray.900',
		justifySelf: { base: 'end', md: 'start' },
	},
	iconCircle: {
		gridArea: 'icon',
		w: '1.75rem',
		h: '1.75rem',
		borderRadius: 'full',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: '0',
		alignSelf: 'center',
	},
} satisfies StylesObject

interface SummaryRowProps {
	label: string
	value: string
	icon: React.ReactNode
	iconBg: string
	iconColor: string
	valueColor?: string
}

const SummaryRow = ({
	label,
	value,
	icon,
	iconBg,
	iconColor,
	valueColor = 'gray.900',
}: SummaryRowProps) => (
	<Box sx={styles.row}>
		<Flex sx={{ ...styles.iconCircle, bg: iconBg, color: iconColor }}>
			{icon}
		</Flex>
		<Text sx={styles.label}>{label}</Text>
		<Text sx={{ ...styles.value, color: valueColor }}>{value}</Text>
	</Box>
)

type OpeningDirection = OpeningBalance['direction']

const defaultOpeningDirection = (
	party: 'customer' | 'supplier',
): OpeningDirection => (party === 'supplier' ? 'we_owe' : 'owed_to_us')

const OpeningBalanceRows = ({
	party,
	partyId,
	openingBalances,
	canEdit,
}: {
	party: 'customer' | 'supplier'
	partyId: string
	openingBalances?: OpeningBalance[]
	canEdit: boolean
}) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const { data: currencySettings } = useGetCurrencySettingsQuery()
	const [updateCustomer, { isLoading: isSavingCustomer }] =
		useUpdateCustomerOpeningBalanceMutation()
	const [updateSupplier, { isLoading: isSavingSupplier }] =
		useUpdateSupplierOpeningBalanceMutation()
	const options = useMemo(
		() => buildDisplayCurrencyOptions(currencySettings),
		[currencySettings],
	)
	const saved = openingBalances ?? []
	const savedKey = saved
		.map(row => `${row.currencyId}:${row.amount}:${row.direction}`)
		.join('|')
	const [addedIds, setAddedIds] = useState<string[]>([])
	const [hiddenIds, setHiddenIds] = useState<string[]>([])
	const [directionOverrides, setDirectionOverrides] = useState<
		Record<string, OpeningDirection>
	>({})
	const [amountOverrides, setAmountOverrides] = useState<
		Record<string, number>
	>({})
	const nativeRef = useRef<Record<string, number>>({})
	const savedRef = useRef(saved)
	savedRef.current = saved
	const isSaving = isSavingCustomer || isSavingSupplier

	useEffect(() => {
		setAddedIds([])
		setHiddenIds([])
		setDirectionOverrides({})
		setAmountOverrides({})
	}, [partyId])

	useEffect(() => {
		const savedIds = new Set(savedRef.current.map(row => row.currencyId))
		setAmountOverrides({})
		setDirectionOverrides({})
		setHiddenIds(current => current.filter(id => savedIds.has(id)))
		setAddedIds(current => current.filter(id => !savedIds.has(id)))
	}, [savedKey])

	const savedById = useMemo(
		() => new Map(saved.map(row => [row.currencyId, row])),
		[saved],
	)
	const primaryId = options[0]?.currencyId
	const hidden = new Set(hiddenIds)
	const seeded: string[] = []

	if (primaryId && !hidden.has(primaryId)) seeded.push(primaryId)

	for (const row of saved) {
		if (!hidden.has(row.currencyId) && !seeded.includes(row.currencyId)) {
			seeded.push(row.currencyId)
		}
	}

	for (const id of addedIds) {
		if (!hidden.has(id) && !seeded.includes(id)) seeded.push(id)
	}

	if (seeded.length === 0 && primaryId) seeded.push(primaryId)

	const { shownCurrencyIds, nextCurrencyId } = resolveAdditionalCurrencyRows(
		options,
		seeded,
	)
	const directionOf = (currencyId: string): OpeningDirection =>
		directionOverrides[currencyId] ??
		savedById.get(currencyId)?.direction ??
		defaultOpeningDirection(party)
	const amountOf = (currencyId: string) =>
		currencyId in amountOverrides
			? amountOverrides[currencyId]
			: (savedById.get(currencyId)?.amount ?? 0)

	const revert = () => {
		setAddedIds([])
		setHiddenIds([])
		setDirectionOverrides({})
		setAmountOverrides({})
	}

	const persist = async (
		shown: readonly string[],
		amounts: Record<string, number>,
		directions: Record<string, OpeningDirection>,
	) => {
		const next = shown.flatMap(currencyId => {
			const amount = amounts[currencyId] ?? 0

			if (!(amount > 0)) return []

			const option = options.find(item => item.currencyId === currencyId)

			return [
				{
					currencyId,
					currencyCode:
						option?.label ??
						savedById.get(currencyId)?.currencyCode ??
						currencyId,
					amount,
					direction: directions[currencyId] ?? defaultOpeningDirection(party),
				},
			]
		})

		try {
			if (party === 'supplier') {
				await updateSupplier({
					supplierId: partyId,
					openingBalances: next,
				}).unwrap()
			} else {
				await updateCustomer({
					customerId: partyId,
					openingBalances: next,
				}).unwrap()
			}
		} catch {
			revert()
			showToast({
				title: t('components.invoiceSummary.openingBalanceError'),
				status: 'error',
			})
		}
	}

	const amountsFor = (
		shown: readonly string[],
		currencyId?: string,
		native?: number,
	) =>
		Object.fromEntries(
			shown.map(id => [
				id,
				id === currencyId && native != null ? native : amountOf(id),
			]),
		)
	const directionsFor = (
		shown: readonly string[],
		currencyId?: string,
		direction?: OpeningDirection,
	) =>
		Object.fromEntries(
			shown.map(id => [
				id,
				id === currencyId && direction ? direction : directionOf(id),
			]),
		)

	const card = (lines: ReactNode) => (
		<Box sx={styles.row} minW={0} bg="transparent" alignItems="start">
			<Flex sx={{ ...styles.iconCircle, bg: '#FEF3C7', color: '#D97706' }}>
				<DollarSignIcon fill="none" />
			</Flex>
			<Text sx={styles.label}>
				{t('components.invoiceSummary.openingBalance')}
			</Text>
			<VStack
				sx={{
					...styles.value,
					alignItems: { base: 'flex-end', md: 'flex-start' },
					paddingRight: '0.5rem',
				}}
				spacing={1}
			>
				{lines}
			</VStack>
		</Box>
	)

	if (options.length === 0) {
		const rows = saved.length
			? saved
			: [
					{
						currencyId: 'primary',
						currencyCode: '',
						amount: 0,
						direction: defaultOpeningDirection(party),
					},
				]

		return card(
			rows.map(row => (
				<Text key={row.currencyId} fontSize="1em" fontWeight={700}>
					{`${formatNumber(row.amount) ?? '0.00'}${row.currencyCode ? ` ${row.currencyCode}` : ''}`}
				</Text>
			)),
		)
	}

	return card(
		<>
			{shownCurrencyIds.map((currencyId, index) => {
				const isLast = index === shownCurrencyIds.length - 1
				const showAdd = isLast && nextCurrencyId != null
				const showRemove = shownCurrencyIds.length > 1 && !showAdd
				const native = amountOf(currencyId)
				const primary = convertToPrimaryAmount(native, currencyId, options)
				const direction = directionOf(currencyId)

				return (
					<HStack key={currencyId} align="center" justify="space-between">
						<HStack spacing={3} minW={0}>
							<CurrencyAmountTooltip
								amount={primary}
								displayText={formatDisplayAmount(primary, currencyId, options)}
								options={options}
								displayCurrencyId={currencyId}
								fontSize="1em"
								fontWeight={700}
								onEditDisplayAmount={
									canEdit
										? value => {
												nativeRef.current = {
													...nativeRef.current,
													[currencyId]: value,
												}
											}
										: undefined
								}
								onEdit={
									canEdit
										? async () => {
												const typed = nativeRef.current[currencyId] ?? 0
												setAmountOverrides(current => ({
													...current,
													[currencyId]: typed,
												}))
												await persist(
													shownCurrencyIds,
													amountsFor(shownCurrencyIds, currencyId, typed),
													directionsFor(shownCurrencyIds),
												)
											}
										: undefined
								}
							/>
							{canEdit ? (
								<Button
									size="xs"
									variant="ghost"
									flexShrink={0}
									isDisabled={isSaving}
									onClick={() => {
										const nextDirection: OpeningDirection =
											direction === 'owed_to_us' ? 'we_owe' : 'owed_to_us'
										setDirectionOverrides(current => ({
											...current,
											[currencyId]: nextDirection,
										}))
										if (!(native > 0)) return

										void persist(
											shownCurrencyIds,
											amountsFor(shownCurrencyIds),
											directionsFor(
												shownCurrencyIds,
												currencyId,
												nextDirection,
											),
										)
									}}
								>
									{t(
										direction === 'owed_to_us'
											? 'components.invoiceSummary.forUs'
											: 'components.invoiceSummary.forThem',
									)}
								</Button>
							) : (
								<Text fontSize="xs" fontWeight={700} color={PAGE_COLORS.muted}>
									{t(
										direction === 'owed_to_us'
											? 'components.invoiceSummary.forUs'
											: 'components.invoiceSummary.forThem',
									)}
								</Text>
							)}
						</HStack>
						{canEdit && showAdd && (
							<IconButton
								aria-label={t('components.daily.addCurrency')}
								icon={<AddIcon boxSize={2.5} />}
								size="xs"
								variant="outline"
								borderRadius="md"
								borderColor={PAGE_COLORS.border}
								color={PAGE_COLORS.primary}
								flexShrink={0}
								isDisabled={isSaving}
								onClick={() => {
									if (!nextCurrencyId) return

									setHiddenIds(current =>
										current.filter(id => id !== nextCurrencyId),
									)
									setAddedIds(current =>
										current.includes(nextCurrencyId)
											? current
											: [...current, nextCurrencyId],
									)
								}}
							/>
						)}
						{canEdit && showRemove && (
							<IconButton
								aria-label={t('components.currenciesSettings.removeSecondary')}
								icon={<MinusIcon boxSize={2.5} />}
								size="xs"
								variant="outline"
								borderRadius="md"
								borderColor={PAGE_COLORS.border}
								color={PAGE_COLORS.primary}
								flexShrink={0}
								isDisabled={isSaving}
								onClick={() => {
									const nextShown = shownCurrencyIds.filter(
										id => id !== currencyId,
									)
									setAddedIds(current =>
										current.filter(id => id !== currencyId),
									)
									setHiddenIds(current =>
										current.includes(currencyId)
											? current
											: [...current, currencyId],
									)
									if (!(native > 0)) return

									void persist(
										nextShown,
										amountsFor(nextShown),
										directionsFor(nextShown),
									)
								}}
							/>
						)}
					</HStack>
				)
			})}
		</>,
	)
}

interface PartyInvoiceSummaryCardsProps {
	party: 'customer' | 'supplier' | 'partner' | 'project'
	partyId?: string
	openingBalances?: OpeningBalance[]
	totals?: {
		totalInvoiced: number
		totalPaid: number
		outstanding: number
		employeeCosts?: number
		otherCosts?: number
		receiptEntries?: number
		profit?: number | null
	}
}

const PartyInvoiceSummaryCards = ({
	party,
	partyId,
	openingBalances,
	totals,
}: PartyInvoiceSummaryCardsProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const { canSee } = useSee()
	const canSeeOutstanding =
		party === 'partner' ||
		party === 'project' ||
		(party === 'supplier'
			? canSee(SEE.suppliersTotalPayable)
			: canSee(SEE.customersTotalReceivable))
	const canEditOpening =
		party === 'supplier'
			? canSee(SEE.suppliersAdd)
			: party === 'customer' && canSee(SEE.customersAdd)

	if (!totals) return null

	const owedToUs =
		(party === 'supplier' ? -totals.outstanding : totals.outstanding) >= 0
	const outstandingLabel = t(
		owedToUs
			? 'components.invoiceSummary.forUs'
			: 'components.invoiceSummary.forThem',
	)
	const invoiceTotalLabel = t(
		party === 'supplier'
			? 'components.invoiceSummary.buyingInvoices'
			: 'components.invoiceSummary.sellingInvoices',
	)

	return (
		<Box width="100%">
			<Box sx={styles.container}>
				<SummaryRow
					label={invoiceTotalLabel}
					value={formatAmount(totals.totalInvoiced)}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DBEAFE"
					iconColor="#2563EB"
				/>
				{canSeeOutstanding && (
					<SummaryRow
						label={outstandingLabel}
						value={formatAmount(Math.abs(totals.outstanding))}
						icon={<WalletIcon fill="none" />}
						iconBg="#FEE2E2"
						iconColor="#DC2626"
						valueColor={
							totals.outstanding > 0 ? PAGE_COLORS.danger : 'gray.900'
						}
					/>
				)}
				{party === 'project' && (
					<>
						<SummaryRow
							label={t('components.invoiceSummary.employeeCosts')}
							value={formatAmount(totals.employeeCosts ?? 0)}
							icon={<DollarSignIcon fill="none" />}
							iconBg="#E0E7FF"
							iconColor="#3730A3"
						/>
						<SummaryRow
							label={t('components.invoiceSummary.otherCosts')}
							value={formatAmount(totals.otherCosts ?? 0)}
							icon={<DollarSignIcon fill="none" />}
							iconBg="#FFEDD5"
							iconColor="#C2410C"
						/>
						<SummaryRow
							label={t('components.invoiceSummary.receiptEntries')}
							value={formatAmount(totals.receiptEntries ?? 0)}
							icon={<WalletIcon fill="none" />}
							iconBg="#DCFCE7"
							iconColor="#15803D"
						/>
						<SummaryRow
							label={t('components.invoiceSummary.projectProfit')}
							value="—"
							icon={<DollarSignIcon fill="none" />}
							iconBg="#F3F4F6"
							iconColor="#6B7280"
						/>
					</>
				)}
				{party !== 'partner' &&
					party !== 'project' &&
					canSeeOutstanding &&
					partyId && (
						<OpeningBalanceRows
							party={party}
							partyId={partyId}
							openingBalances={openingBalances}
							canEdit={canEditOpening}
						/>
					)}
			</Box>
		</Box>
	)
}

export default PartyInvoiceSummaryCards
