import {
	Box,
	Button,
	Flex,
	HStack,
	Input,
	Text,
	Tooltip,
	VStack,
} from '@chakra-ui/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import type {
	InvoiceExtractFieldPath,
	InvoiceImportStatus,
} from '../../shared/invoiceExtraction'

export interface ExtractRereadTarget {
	field: InvoiceExtractFieldPath
	lineId?: string
}

interface InvoiceExtractPreviewProps {
	isReadOnly?: boolean
	isExtracting?: boolean
	isRereading?: boolean
	previewUrl?: string
	previewMimeType?: string
	rereadTarget?: ExtractRereadTarget | null
	onCancelReread?: () => void
	onFileChosen: (file: File) => void
	onExtract: () => void
	onCroppedRegion: (file: File) => void
	importStatus?: InvoiceImportStatus | null
	onReject?: () => void
	availableCount?: number
	nextPeriodStartsAt?: string
	isUsageLoading?: boolean
	isUsageError?: boolean
}

const cropFromImage = (
	image: HTMLImageElement,
	box: { x: number; y: number; w: number; h: number },
): Promise<File> =>
	new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(box.w))
		canvas.height = Math.max(1, Math.round(box.h))
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			reject(new Error('canvas'))
			return
		}
		ctx.drawImage(
			image,
			box.x,
			box.y,
			box.w,
			box.h,
			0,
			0,
			canvas.width,
			canvas.height,
		)
		canvas.toBlob(blob => {
			if (!blob) {
				reject(new Error('blob'))
				return
			}
			resolve(new File([blob], 'invoice-region.png', { type: 'image/png' }))
		}, 'image/png')
	})

const InvoiceExtractPreview = ({
	isReadOnly,
	isExtracting,
	isRereading,
	previewUrl,
	previewMimeType,
	rereadTarget,
	onCancelReread,
	onFileChosen,
	onExtract,
	onCroppedRegion,
	importStatus,
	onReject,
	availableCount,
	nextPeriodStartsAt,
	isUsageLoading,
	isUsageError,
}: InvoiceExtractPreviewProps) => {
	const { t, i18n } = useTranslation()
	const inputRef = useRef<HTMLInputElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)
	const originRef = useRef<{ x: number; y: number } | null>(null)
	const boxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
		null,
	)
	const isPdf = previewMimeType === 'application/pdf'
	const canCrop = Boolean(previewUrl && !isPdf && rereadTarget)
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

	useEffect(() => {
		originRef.current = null
		boxRef.current = null
	}, [rereadTarget, previewUrl])

	const localBox = (
		event: React.MouseEvent<HTMLImageElement>,
	): { x: number; y: number } => {
		const rect = event.currentTarget.getBoundingClientRect()
		const image = event.currentTarget
		const scaleX = image.naturalWidth / rect.width
		const scaleY = image.naturalHeight / rect.height
		return {
			x: (event.clientX - rect.left) * scaleX,
			y: (event.clientY - rect.top) * scaleY,
		}
	}

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
			{rereadTarget && (
				<Flex
					justify="space-between"
					align="center"
					gap={2}
					p={2}
					borderRadius="md"
					bg="orange.50"
					border="1px solid"
					borderColor="orange.200"
				>
					<Text fontSize="xs" color="orange.800">
						{isPdf
							? t('components.buyingInvoices.extract.cropPdfHint')
							: t('components.buyingInvoices.extract.cropHint')}
					</Text>
					<Button size="xs" variant="ghost" onClick={onCancelReread}>
						{t('components.buyingInvoices.extract.cancelReread')}
					</Button>
				</Flex>
			)}
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
					borderColor={canCrop ? PAGE_COLORS.warning : PAGE_COLORS.border}
					borderRadius="md"
					overflow="hidden"
					maxH="16rem"
				>
					<img
						ref={imageRef}
						src={previewUrl}
						alt={t('components.buyingInvoices.extract.preview')}
						style={{
							width: '100%',
							maxHeight: '16rem',
							objectFit: 'contain',
							cursor: canCrop ? 'crosshair' : 'default',
							userSelect: 'none',
							display: 'block',
						}}
						draggable={false}
						onMouseDown={event => {
							if (!canCrop) return
							event.preventDefault()
							originRef.current = localBox(event)
							boxRef.current = { ...originRef.current, w: 1, h: 1 }
						}}
						onMouseMove={event => {
							if (!originRef.current) return
							const point = localBox(event)
							boxRef.current = {
								x: Math.min(originRef.current.x, point.x),
								y: Math.min(originRef.current.y, point.y),
								w: Math.abs(point.x - originRef.current.x),
								h: Math.abs(point.y - originRef.current.y),
							}
						}}
						onMouseUp={async () => {
							const box = boxRef.current
							originRef.current = null
							boxRef.current = null
							const image = imageRef.current
							if (!box || !image || box.w < 8 || box.h < 8) return
							const file = await cropFromImage(image, box)
							onCroppedRegion(file)
						}}
					/>
				</Box>
			)}
			{isRereading && (
				<Text fontSize="xs" color={PAGE_COLORS.muted}>
					{t('components.buyingInvoices.extract.rereading')}
				</Text>
			)}
		</VStack>
	)
}

export default InvoiceExtractPreview
