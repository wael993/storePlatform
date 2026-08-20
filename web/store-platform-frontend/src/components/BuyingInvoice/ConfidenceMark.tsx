import { Text, Tooltip } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import {
	formatConfidencePercent,
	type ExtractFieldReview,
} from '../../shared/invoiceExtraction'

interface ConfidenceMarkProps {
	review?: ExtractFieldReview
	onConfirm?: () => void
}

const ConfidenceMark = ({ review, onConfirm }: ConfidenceMarkProps) => {
	const { t } = useTranslation()
	if (!review) return null

	const percent = formatConfidencePercent(review.confidence)
	const label =
		review.band === 'missing'
			? t('components.buyingInvoices.extract.couldNotRead')
			: review.band === 'review'
				? t('components.buyingInvoices.extract.needsConfirmation', {
						percent: percent ?? '—',
					})
				: t('components.buyingInvoices.extract.highConfidence', {
						percent: percent ?? '—',
					})

	return (
		<Tooltip label={label} hasArrow>
			<Text
				as="button"
				type="button"
				aria-label={label}
				fontSize="sm"
				lineHeight={1}
				onClick={
					review.band === 'review' && !review.confirmed ? onConfirm : undefined
				}
				cursor={
					review.band === 'review' && !review.confirmed ? 'pointer' : 'help'
				}
			>
				{review.band === 'high' ? '🟢' : review.band === 'review' ? '🟡' : '🔴'}
			</Text>
		</Tooltip>
	)
}

export default ConfidenceMark
