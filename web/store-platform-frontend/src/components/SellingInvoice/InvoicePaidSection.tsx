import { Box, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { AddIcon, MinusIcon } from '@chakra-ui/icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CashTenderInput } from 'store-domain'

import { PAGE_COLORS } from './constants'
import CurrencyAmountTooltip from './CurrencyAmountTooltip'
import {
	formatDisplayAmount,
	resolveAdditionalCurrencyRows,
	type DisplayCurrencyOption,
} from './currencyDisplay'
import { convertPrimaryAmount } from './currencyDisplay'
import { settleTenderedPayment } from './invoiceCalculations'

interface InvoicePaidSectionProps {
	paidLabel: string
	changeLabel: string
	options: DisplayCurrencyOption[]
	displayCurrencyId: string | null
	grandTotal: number
	paidAmount: number
	cashTendered: number | null
	isEditable: boolean
	onSettlement: (
		paidAmount: number,
		cashTendered: number | null,
		tenders: CashTenderInput[],
	) => void
}

const InvoicePaidSection = ({
	paidLabel,
	changeLabel,
	options,
	displayCurrencyId,
	grandTotal,
	paidAmount,
	cashTendered,
	isEditable,
	onSettlement,
}: InvoicePaidSectionProps) => {
	const { t } = useTranslation()
	const [rowCurrencyIds, setRowCurrencyIds] = useState<string[] | null>(null)
	const [extraPrimaryById, setExtraPrimaryById] = useState<
		Record<string, number>
	>({})
	const [invoiceTender, setInvoiceTender] = useState<number | null>(null)
	const published = useRef<{ paid: number; cash: number | null } | null>(null)
	const displayTenderRef = useRef<Record<string, number>>({})

	const seeded =
		rowCurrencyIds ?? (displayCurrencyId ? [displayCurrencyId] : [])
	const { shownCurrencyIds, nextCurrencyId } = resolveAdditionalCurrencyRows(
		options,
		seeded,
	)

	useEffect(() => {
		const echo = published.current
		if (echo && echo.paid === paidAmount && echo.cash === cashTendered) return

		setInvoiceTender(null)
		setRowCurrencyIds(null)
		setExtraPrimaryById({})
		displayTenderRef.current = {}
		published.current = null
	}, [paidAmount, cashTendered])

	const firstTender = invoiceTender ?? cashTendered ?? paidAmount
	const usesBaseTender = (currencyId: string, extras: Record<string, number>) =>
		currencyId === displayCurrencyId && !(currencyId in extras)

	const rowPrimary = (
		currencyId: string,
		extras: Record<string, number>,
		baseTender: number,
	) =>
		usesBaseTender(currencyId, extras) ? baseTender : (extras[currencyId] ?? 0)

	const changePrimary =
		shownCurrencyIds.reduce(
			(sum, currencyId) =>
				sum + rowPrimary(currencyId, extraPrimaryById, firstTender),
			0,
		) - grandTotal
	const changeCurrencyId =
		shownCurrencyIds[shownCurrencyIds.length - 1] ?? displayCurrencyId

	const publish = (
		nextFirstTender: number,
		nextExtras: Record<string, number>,
		shown: readonly string[],
	) => {
		const tendered = shown.reduce(
			(sum, currencyId) =>
				sum + rowPrimary(currencyId, nextExtras, nextFirstTender),
			0,
		)
		const { paidAmount: nextPaid } = settleTenderedPayment(tendered, grandTotal)
		const nextCash = tendered > grandTotal ? tendered : null
		const tenders = shown.flatMap(currencyId => {
			const typed = displayTenderRef.current[currencyId]
			const tenderedAmount =
				typeof typed === 'number'
					? typed
					: convertPrimaryAmount(
							rowPrimary(currencyId, nextExtras, nextFirstTender),
							currencyId,
							options,
						)

			if (!(tenderedAmount > 0)) return []

			return [{ currencyId, tenderedAmount }]
		})

		setInvoiceTender(nextFirstTender)
		published.current = { paid: nextPaid, cash: nextCash }
		onSettlement(nextPaid, nextCash, tenders)
	}

	const addNextCurrency = () => {
		if (!nextCurrencyId) return

		setRowCurrencyIds([...shownCurrencyIds, nextCurrencyId])
		setExtraPrimaryById(current =>
			nextCurrencyId in current ? current : { ...current, [nextCurrencyId]: 0 },
		)
	}

	const removeCurrency = (currencyId: string) => {
		if (shownCurrencyIds.length < 2) return

		const nextRows = shownCurrencyIds.filter(id => id !== currencyId)
		const nextExtras = { ...extraPrimaryById }
		delete nextExtras[currencyId]

		setRowCurrencyIds(nextRows)
		setExtraPrimaryById(nextExtras)
		publish(firstTender, nextExtras, nextRows)
	}

	return (
		<Box
			bg="gray.50"
			borderRadius="lg"
			p={4}
			border="1px solid"
			borderColor={PAGE_COLORS.border}
		>
			<VStack align="stretch" spacing={3}>
				<Box>
					<Text fontSize="xs" fontWeight={600} color={PAGE_COLORS.muted} mb={1}>
						{paidLabel}
					</Text>
					<VStack align="stretch" spacing={1}>
						{shownCurrencyIds.map((currencyId, index) => {
							const isLast = index === shownCurrencyIds.length - 1
							const showAdd = isLast && nextCurrencyId != null
							const showRemove = shownCurrencyIds.length > 1 && !showAdd
							const amount = usesBaseTender(currencyId, extraPrimaryById)
								? settleTenderedPayment(firstTender, grandTotal).paidAmount
								: (extraPrimaryById[currencyId] ?? 0)

							return (
								<HStack key={currencyId} align="center" justify="space-between">
									<CurrencyAmountTooltip
										amount={amount}
										displayText={formatDisplayAmount(
											amount,
											currencyId,
											options,
										)}
										options={options}
										displayCurrencyId={currencyId}
										fontSize="xl"
										fontWeight={700}
										onEditDisplayAmount={
											isEditable
												? tendered => {
														displayTenderRef.current = {
															...displayTenderRef.current,
															[currencyId]: tendered,
														}
													}
												: undefined
										}
										onEdit={
											isEditable
												? tendered => {
														if (usesBaseTender(currencyId, extraPrimaryById)) {
															publish(
																tendered,
																extraPrimaryById,
																shownCurrencyIds,
															)
															return
														}

														const nextExtras = {
															...extraPrimaryById,
															[currencyId]: tendered,
														}
														setExtraPrimaryById(nextExtras)
														publish(firstTender, nextExtras, shownCurrencyIds)
													}
												: undefined
										}
									/>
									{isEditable && showAdd && (
										<IconButton
											aria-label={t('components.daily.addCurrency')}
											icon={<AddIcon boxSize={2.5} />}
											size="xs"
											variant="outline"
											borderRadius="md"
											borderColor={PAGE_COLORS.border}
											color={PAGE_COLORS.primary}
											flexShrink={0}
											onClick={addNextCurrency}
										/>
									)}
									{isEditable && showRemove && (
										<IconButton
											aria-label={t(
												'components.currenciesSettings.removeSecondary',
											)}
											icon={<MinusIcon boxSize={2.5} />}
											size="xs"
											variant="outline"
											borderRadius="md"
											borderColor={PAGE_COLORS.border}
											color={PAGE_COLORS.primary}
											flexShrink={0}
											onClick={() => removeCurrency(currencyId)}
										/>
									)}
								</HStack>
							)
						})}
					</VStack>
				</Box>
				<Box>
					<Text fontSize="xs" fontWeight={600} color={PAGE_COLORS.muted} mb={1}>
						{changeLabel}
					</Text>
					<CurrencyAmountTooltip
						amount={changePrimary}
						displayText={formatDisplayAmount(
							changePrimary,
							changeCurrencyId,
							options,
						)}
						options={options}
						displayCurrencyId={changeCurrencyId}
						fontSize="xl"
						fontWeight={700}
						color={PAGE_COLORS.success}
					/>
				</Box>
			</VStack>
		</Box>
	)
}

export default InvoicePaidSection
