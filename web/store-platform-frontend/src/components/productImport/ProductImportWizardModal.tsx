import {
	Button,
	Flex,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Progress,
	Select,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	VStack,
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useCommitProductImportMutation,
	useParseProductImportMutation,
	usePreviewProductImportMutation,
	useSkipProductImportMutation,
} from '../../api/apiStore'
import {
	PRODUCT_IMPORT_COMMIT_BATCH_SIZE,
	PRODUCT_IMPORT_FIELD_LABEL_KEYS,
	isExcelImportFileName,
	type ProductImportFieldKey,
	type ProductImportMapping,
	type ProductImportParseResponse,
	type ProductImportPreviewResponse,
	type ProductImportCommitResponse,
	type ProductImportStatusResponse,
} from '../../shared/productImport'
import useCustomToast from '../common/CustomToast'

const COMMIT_RETRIES = 3

const fileToBase64 = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = String(reader.result ?? '')
			const comma = result.indexOf(',')
			resolve(comma >= 0 ? result.slice(comma + 1) : result)
		}
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isRetryableCommitError = (error: unknown) => {
	const status = (error as { status?: number | string }).status

	return (
		status === 'FETCH_ERROR' ||
		status === 'TIMEOUT_ERROR' ||
		(typeof status === 'number' && status >= 500)
	)
}

const formatDuration = (ms: number) => {
	const totalSeconds = Math.max(0, Math.round(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60

	if (minutes === 0) return `${seconds} sec`
	if (seconds === 0) return `${minutes} min`

	return `${minutes} min ${seconds} sec`
}

type WizardStep =
	'upload' | 'mapping' | 'confirm' | 'preview' | 'committing' | 'result'

type CommitProgress = {
	processed: number
	total: number
	waiting: boolean
	startedAt: number
}

interface ProductImportWizardModalProps {
	isOpen: boolean
	onClose: () => void
	status: ProductImportStatusResponse | undefined
}

const ProductImportWizardModal = ({
	isOpen,
	onClose,
	status,
}: ProductImportWizardModalProps) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [step, setStep] = useState<WizardStep>('upload')
	const [files, setFiles] = useState<File[]>([])
	const [parsed, setParsed] = useState<ProductImportParseResponse | null>(null)
	const [mapping, setMapping] = useState<ProductImportMapping>({})
	const [preview, setPreview] = useState<ProductImportPreviewResponse | null>(
		null,
	)
	const [result, setResult] = useState<ProductImportCommitResponse | null>(null)
	const [commitProgress, setCommitProgress] = useState<CommitProgress | null>(
		null,
	)
	const [now, setNow] = useState(() => Date.now())
	const [parseImport, { isLoading: isParsing }] =
		useParseProductImportMutation()
	const [previewImport, { isLoading: isPreviewing }] =
		usePreviewProductImportMutation()
	const [commitImport] = useCommitProductImportMutation()
	const [skipImport, { isLoading: isSkipping }] = useSkipProductImportMutation()

	const isCommitting = step === 'committing'

	useEffect(() => {
		if (!isCommitting) return

		const timer = window.setInterval(() => setNow(Date.now()), 1000)

		return () => window.clearInterval(timer)
	}, [isCommitting])

	useEffect(() => {
		if (!isOpen) return

		const resume = status?.resume

		if (!resume) return

		setParsed(resume)
		setMapping(resume.suggestedMapping)
		setStep('mapping')
	}, [isOpen, status?.resume?.sessionId])

	const reset = () => {
		setStep('upload')
		setFiles([])
		setParsed(null)
		setMapping({})
		setPreview(null)
		setResult(null)
		setCommitProgress(null)
	}

	const handleClose = () => {
		if (isCommitting) return

		reset()
		onClose()
	}

	const requiredMapped = (status?.fields ?? [])
		.filter(field => field.required)
		.every(field => Boolean(mapping[field.key]?.trim()))

	const rejectNonExcel = () => {
		showToast({
			status: 'error',
			description: t('productImport.excelOnly'),
		})
	}

	const handleParse = async () => {
		if (files.some(file => !isExcelImportFileName(file.name))) {
			rejectNonExcel()
			return
		}

		try {
			const payload = await Promise.all(
				files.map(async file => ({
					fileBase64: await fileToBase64(file),
					mimeType: file.type || 'application/octet-stream',
					fileName: file.name,
				})),
			)
			const response = await parseImport({ files: payload }).unwrap()

			setParsed(response)
			setMapping(response.suggestedMapping)
			setStep('mapping')
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description: err.data?.message || t('productImport.parseFailed'),
			})
		}
	}

	const handlePreview = async () => {
		if (!parsed) return

		try {
			const response = await previewImport({
				sessionId: parsed.sessionId,
				mapping,
			}).unwrap()

			setPreview(response)
			setStep('preview')
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description: err.data?.message || t('productImport.previewFailed'),
			})
		}
	}

	const handleCommit = async () => {
		if (!parsed) return

		let total = preview?.valid ?? 0

		if (total === 0) return

		const startedAt = Date.now()
		let offset = 0
		let imported = 0
		let last: ProductImportCommitResponse | null = null

		setNow(startedAt)
		setCommitProgress({ processed: 0, total, waiting: true, startedAt })
		setStep('committing')

		try {
			while (offset < total) {
				setCommitProgress({
					processed: offset,
					total,
					waiting: true,
					startedAt,
				})

				let batchResult: ProductImportCommitResponse | undefined
				let lastError: unknown

				for (let attempt = 0; attempt < COMMIT_RETRIES; attempt += 1) {
					try {
						batchResult = await commitImport({
							sessionId: parsed.sessionId,
							mapping,
							offset,
							limit: PRODUCT_IMPORT_COMMIT_BATCH_SIZE,
						}).unwrap()
						break
					} catch (error) {
						lastError = error
						if (attempt < COMMIT_RETRIES - 1 && isRetryableCommitError(error)) {
							await wait(400 * (attempt + 1))
							continue
						}
						break
					}
				}

				if (!batchResult) throw lastError

				if (batchResult.processed <= offset && !batchResult.done) {
					throw new Error('Import did not advance.')
				}

				imported += batchResult.imported
				offset = batchResult.processed
				total = batchResult.total
				last = batchResult
				setCommitProgress({
					processed: batchResult.processed,
					total: batchResult.total,
					waiting: false,
					startedAt,
				})

				if (batchResult.done) break
			}

			if (!last) return

			setResult({ ...last, imported })
			setCommitProgress(null)
			setStep('result')
		} catch (error) {
			const err = error as { data?: { message?: string } }

			setCommitProgress(null)
			setStep('preview')
			showToast({
				status: 'error',
				description: err.data?.message || t('productImport.commitFailed'),
			})
		}
	}

	const hasExistingProducts = (status?.productCount ?? 0) > 0 && !status?.resume
	const elapsedMs = commitProgress ? now - commitProgress.startedAt : 0
	const percent =
		commitProgress && commitProgress.total > 0
			? Math.min(
					100,
					Math.round((commitProgress.processed / commitProgress.total) * 100),
				)
			: 0
	const remainingMs =
		commitProgress && commitProgress.processed > 0 && elapsedMs > 0
			? (elapsedMs / commitProgress.processed) *
				(commitProgress.total - commitProgress.processed)
			: null

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			size="4xl"
			scrollBehavior="inside"
			closeOnOverlayClick={!isCommitting}
			closeOnEsc={!isCommitting}
		>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>{t('productImport.title')}</ModalHeader>
				<ModalBody>
					{hasExistingProducts ? (
						<Text>
							{t('productImport.existingProducts', {
								count: status?.productCount,
							})}
						</Text>
					) : step === 'upload' ? (
						<VStack align="stretch" gap={4}>
							<Text color="gray.600">{t('productImport.uploadHint')}</Text>
							<input
								ref={fileInputRef}
								type="file"
								multiple
								hidden
								accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
								onChange={event => {
									const selected = Array.from(event.target.files ?? [])

									if (
										selected.some(file => !isExcelImportFileName(file.name))
									) {
										rejectNonExcel()
										event.target.value = ''
										setFiles([])
										return
									}

									setFiles(selected)
								}}
							/>
							<Button onClick={() => fileInputRef.current?.click()}>
								{t('productImport.chooseFiles')}
							</Button>
							{files.map(file => (
								<Text key={file.name}>✓ {file.name}</Text>
							))}
						</VStack>
					) : null}

					{!hasExistingProducts && step === 'mapping' && parsed ? (
						<VStack align="stretch" gap={3}>
							<Text color="gray.600">{t('productImport.mappingHint')}</Text>
							{(status?.fields ?? []).map(field => (
								<Flex key={field.key} align="center" gap={4}>
									<Text minW="12rem" fontWeight={700}>
										{t(
											PRODUCT_IMPORT_FIELD_LABEL_KEYS[
												field.key as ProductImportFieldKey
											],
										)}
										{field.required ? ' *' : ''}
									</Text>
									<Select
										value={mapping[field.key] ?? ''}
										sx={{
											'& + div': {
												left: '0.75rem',
												right: 'auto',
											},
										}}
										onChange={event =>
											setMapping(current => ({
												...current,
												[field.key]: event.target.value || null,
											}))
										}
									>
										<option value="">{t('productImport.doNotImport')}</option>
										{parsed.headers.map(header => (
											<option key={header} value={header}>
												{header}
											</option>
										))}
									</Select>
									{parsed.aiSuggestedFields.includes(field.key) ? (
										<Text fontSize="sm" color="blue.500">
											{t('productImport.aiSuggestion')}
										</Text>
									) : null}
								</Flex>
							))}
						</VStack>
					) : null}

					{!hasExistingProducts && step === 'confirm' && (
						<VStack align="stretch" gap={2}>
							{(status?.fields ?? [])
								.filter(field => mapping[field.key])
								.map(field => (
									<Text key={field.key}>
										{t(
											PRODUCT_IMPORT_FIELD_LABEL_KEYS[
												field.key as ProductImportFieldKey
											],
										)}
										{' → '}
										{mapping[field.key]}
									</Text>
								))}
						</VStack>
					)}

					{!hasExistingProducts && step === 'preview' && preview ? (
						<VStack align="stretch" gap={4}>
							<Text>
								{t('productImport.previewSummary', {
									files: preview.fileCount,
									detected: preview.detected,
									valid: preview.valid,
									duplicates: preview.duplicates,
									invalid: preview.invalid,
								})}
							</Text>
							<Table size="sm">
								<Thead>
									<Tr>
										<Th>{t('common.productName')}</Th>
										<Th>{t('productModal.internalCode')}</Th>
										<Th>{t('productModal.purchasePrice')}</Th>
										<Th>{t('productModal.retailPrice')}</Th>
									</Tr>
								</Thead>
								<Tbody>
									{preview.preview.map((row, index) => (
										<Tr key={`${row.name}-${index}`}>
											<Td>{row.name}</Td>
											<Td>{row.internalCode}</Td>
											<Td>{row.purchasePrice}</Td>
											<Td>{row.retailPrice}</Td>
										</Tr>
									))}
								</Tbody>
							</Table>
							{preview.errors.length > 0 ? (
								<VStack align="stretch" gap={1}>
									<Text fontWeight={700}>{t('productImport.viewErrors')}</Text>
									{preview.errors.map(error => (
										<Text
											key={`${error.fileName}-${error.rowNumber}`}
											fontSize="sm"
										>
											{t('productImport.rowError', {
												row: error.rowNumber,
												message: error.errors.join(' '),
											})}
										</Text>
									))}
								</VStack>
							) : null}
						</VStack>
					) : null}

					{!hasExistingProducts && step === 'committing' && commitProgress ? (
						<VStack align="stretch" gap={3}>
							<Text fontWeight={700}>{t('productImport.importing')}</Text>
							<Progress
								value={percent}
								size="lg"
								hasStripe
								isAnimated={commitProgress.waiting}
								borderRadius="md"
							/>
							<Text fontWeight={700}>{percent}%</Text>
							<Text>
								{t('productImport.processedCount', {
									processed: commitProgress.processed,
									total: commitProgress.total,
								})}
							</Text>
							<Text color="gray.600">
								{commitProgress.waiting
									? t('productImport.waitingForServer')
									: t('productImport.importing')}
							</Text>
							{remainingMs != null ? (
								<Text>
									{t('productImport.estimatedRemaining', {
										time: formatDuration(remainingMs),
									})}
								</Text>
							) : null}
							<Text color="gray.500">
								{t('productImport.elapsed', {
									time: formatDuration(elapsedMs),
								})}
							</Text>
						</VStack>
					) : null}

					{!hasExistingProducts && step === 'result' && result ? (
						<VStack align="stretch" gap={2}>
							<Text>
								{t('productImport.resultImported', { count: result.imported })}
							</Text>
							<Text>
								{t('productImport.resultDuplicates', {
									count: result.duplicates,
								})}
							</Text>
							<Text>
								{t('productImport.resultInvalid', { count: result.invalid })}
							</Text>
						</VStack>
					) : null}
				</ModalBody>
				<ModalFooter gap={3}>
					{hasExistingProducts || step === 'result' ? (
						<Button onClick={handleClose}>{t('productImport.done')}</Button>
					) : isCommitting ? null : (
						<>
							<Button
								variant="ghost"
								onClick={async () => {
									await skipImport().unwrap()
									handleClose()
								}}
								isLoading={isSkipping}
							>
								{t('productImport.noProductList')}
							</Button>
							<Button onClick={handleClose}>{t('common.cancel')}</Button>
							{step === 'upload' ? (
								<Button
									onClick={() => void handleParse()}
									isDisabled={files.length === 0}
									isLoading={isParsing}
								>
									{t('productImport.continue')}
								</Button>
							) : null}
							{step === 'mapping' ? (
								<Button
									onClick={() => setStep('confirm')}
									isDisabled={!requiredMapped}
								>
									{t('productImport.continue')}
								</Button>
							) : null}
							{step === 'confirm' ? (
								<>
									<Button onClick={() => setStep('mapping')}>
										{t('productImport.editMapping')}
									</Button>
									<Button
										onClick={() => void handlePreview()}
										isLoading={isPreviewing}
									>
										{t('productImport.continue')}
									</Button>
								</>
							) : null}
							{step === 'preview' ? (
								<>
									<Button onClick={() => setStep('confirm')}>
										{t('common.back')}
									</Button>
									<Button
										onClick={() => void handleCommit()}
										isDisabled={(preview?.valid ?? 0) === 0}
									>
										{t('productImport.approveImport')}
									</Button>
								</>
							) : null}
						</>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default ProductImportWizardModal
