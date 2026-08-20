import {
	Box,
	Button,
	HStack,
	Input,
	Text,
	Tooltip,
	VStack,
} from '@chakra-ui/react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import type { InvoiceImportStatus } from '../../shared/invoiceExtraction'

interface InvoiceExtractPreviewProps {
	isReadOnly?: boolean
	isExtracting?: boolean
	previewUrl?: string
	previewMimeType?: string
	onFileChosen: (file: File) => void
	onExtract: () => void
	importStatus?: InvoiceImportStatus | null
	onReject?: () => void
	availableCount?: number
	nextPeriodStartsAt?: string
	isUsageLoading?: boolean
	isUsageError?: boolean
}

const InvoiceExtractPreview = ({
	isReadOnly,
	isExtracting,
	previewUrl,
	previewMimeType,
	onFileChosen,
	onExtract,
	importStatus,
	onReject,
	availableCount,
	nextPeriodStartsAt,
	isUsageLoading,
	isUsageError,
}: InvoiceExtractPreviewProps) => {
	const { t, i18n } = useTranslation()
	const inputRef = useRef<HTMLInputElement>(null)
	const isPdf = previewMimeType === 'application/pdf'
	const atLimit = availableCount === 0
	const uploadDisabled =
		isReadOnly ||
		atLimit ||
		isUsageError ||
		(isUsageLoading && availableCount == null)
	const nextAllowanceDate = nextPeriodStartsAt
		? new Date(nextPeriodStartsAt).toLocaleDateString(i18n.language, {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				timeZone: 'UTC',
			})
		: ''

	return (
		<VStack align="stretch" spacing={2}>
			<HStack spacing={2} flexWrap="wrap">
				<Input
					ref={inputRef}
					type="file"
					display="none"
					accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff,image/bmp"
					onChange={event => {
						const file = event.target.files?.[0]
						if (file) onFileChosen(file)
						event.target.value = ''
					}}
				/>
				<Tooltip
					label={t('components.buyingInvoices.extract.limitReached', {
						date: nextAllowanceDate,
					})}
					isDisabled={!atLimit || isUsageError}
					hasArrow
				>
					<Box>
						<Button
							size="sm"
							variant="outline"
							isDisabled={uploadDisabled}
							onClick={() => inputRef.current?.click()}
						>
							{t('components.buyingInvoices.extract.upload')}
						</Button>
					</Box>
				</Tooltip>
				<Button
					size="sm"
					bg={PAGE_COLORS.primary}
					color="white"
					isDisabled={isReadOnly || !previewUrl || atLimit || isUsageError}
					isLoading={isExtracting}
					onClick={onExtract}
				>
					{t('components.buyingInvoices.extract.readInvoice')}
				</Button>
				{availableCount != null ? (
					<Text fontSize="sm" color={atLimit ? 'gray.500' : 'gray.600'}>
						{t('components.buyingInvoices.extract.available', {
							count: availableCount,
						})}
					</Text>
				) : null}
				{importStatus && (
					<Text
						fontSize="xs"
						fontWeight={700}
						color={
							importStatus === 'failed' || importStatus === 'rejected'
								? PAGE_COLORS.danger
								: importStatus === 'review_required'
									? PAGE_COLORS.warning
									: importStatus === 'ready_for_approval'
										? PAGE_COLORS.success
										: PAGE_COLORS.primary
						}
					>
						{t(
							`components.buyingInvoices.extract.importStatus.${importStatus}`,
						)}
					</Text>
				)}
				{onReject && importStatus && importStatus !== 'processing' && (
					<Button size="sm" variant="ghost" onClick={onReject}>
						{t('components.buyingInvoices.extract.reject')}
					</Button>
				)}
			</HStack>
			{previewUrl && isPdf && (
				<Box
					as="iframe"
					title={t('components.buyingInvoices.extract.preview')}
					src={previewUrl}
					w="100%"
					h="16rem"
					border="1px solid"
					borderColor={PAGE_COLORS.border}
					borderRadius="md"
				/>
			)}
			{previewUrl && !isPdf && (
				<Box
					border="1px solid"
					borderColor={PAGE_COLORS.border}
					borderRadius="md"
					overflow="hidden"
					maxH="16rem"
				>
					<img
						src={previewUrl}
						alt={t('components.buyingInvoices.extract.preview')}
						style={{
							width: '100%',
							maxHeight: '16rem',
							objectFit: 'contain',
							userSelect: 'none',
							display: 'block',
						}}
						draggable={false}
					/>
				</Box>
			)}
		</VStack>
	)
}

export default InvoiceExtractPreview
