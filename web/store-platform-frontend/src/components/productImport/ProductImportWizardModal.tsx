import {
	Badge,
	Box,
	Button,
	Checkbox,
	Flex,
	FormControl,
	FormLabel,
	Heading,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Progress,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	VStack,
} from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useCommitProductImportMutation,
	useConfirmProductImportMasterDataMutation,
	useGetCurrencySettingsQuery,
	useParseProductImportMutation,
	usePrepareProductImportMasterDataMutation,
	usePreviewProductImportMutation,
	useSkipProductImportMutation,
} from '../../api/apiStore'
import {
	MASTER_DATA_IMPORT_FIELDS,
	PRODUCT_IMPORT_COMMIT_BATCH_SIZE,
	PRODUCT_IMPORT_FIELD_KEYS,
	PRODUCT_IMPORT_FIELD_LABEL_KEYS,
	REQUIRED_PRODUCT_IMPORT_FIELDS,
	isExcelImportFileName,
	type MasterDataDecision,
	type MasterDataProposal,
	type ProductImportFieldKey,
	type ProductImportMapping,
	type ProductImportParseResponse,
	type ProductImportPreviewResponse,
	type ProductImportCommitResponse,
	type ProductImportStatusResponse,
} from '../../shared/productImport'
import { buildDisplayCurrencyOptions } from '../SellingInvoice/currencyDisplay'
import useCustomToast from '../common/CustomToast'

const COMMIT_RETRIES = 3

const UPLOAD_CHECKLIST_ITEMS = [
	{ key: 'productImport.uploadHeadersNote', tone: 'ok' },
	{ key: 'productImport.uploadBarcodesNote', tone: 'ok' },
	{ key: 'productImport.uploadFeesNote', tone: 'ok' },
	{ key: 'productImport.uploadMultipleBarcodesNote', tone: 'ok' },
	{ key: 'productImport.uploadCurrencyNote', tone: 'ok' },
	{ key: 'productImport.uploadSellingPriceNote', tone: 'warning' },
] as const

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
	| 'fields'
	| 'upload'
	| 'mapping'
	| 'master'
	| 'confirm'
	| 'preview'
	| 'committing'
	| 'result'

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
	const [step, setStep] = useState<WizardStep>('fields')
	const [selectedFields, setSelectedFields] = useState<ProductImportFieldKey[]>(
		[...PRODUCT_IMPORT_FIELD_KEYS],
	)
	const [files, setFiles] = useState<File[]>([])
	const [currency, setCurrency] = useState('')
	const [parsed, setParsed] = useState<ProductImportParseResponse | null>(null)
	const [mapping, setMapping] = useState<ProductImportMapping>({})
	const [proposals, setProposals] = useState<MasterDataProposal[]>([])
	const [decisions, setDecisions] = useState<MasterDataDecision[]>([])
	const [preview, setPreview] = useState<ProductImportPreviewResponse | null>(
		null,
	)
	const [result, setResult] = useState<ProductImportCommitResponse | null>(null)
	const [commitProgress, setCommitProgress] = useState<CommitProgress | null>(
		null,
	)
	const [now, setNow] = useState(() => Date.now())
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !isOpen,
	})
	const currencyOptions = useMemo(() => {
		return buildDisplayCurrencyOptions(currencySettings).map(option => ({
			value: option.label,
			label: option.name,
		}))
	}, [currencySettings])
	const primaryCurrencyLabel = currencyOptions[0]?.value ?? ''
	const [parseImport, { isLoading: isParsing }] =
		useParseProductImportMutation()
	const [prepareMaster, { isLoading: isPreparingMaster }] =
		usePrepareProductImportMasterDataMutation()
	const [confirmMaster, { isLoading: isConfirmingMaster }] =
		useConfirmProductImportMasterDataMutation()
	const [previewImport, { isLoading: isPreviewing }] =
		usePreviewProductImportMutation()
	const [commitImport] = useCommitProductImportMutation()
	const [skipImport, { isLoading: isSkipping }] = useSkipProductImportMutation()

	const isCommitting = step === 'committing'
	const mappingFields = (status?.fields ?? []).filter(field =>
		selectedFields.includes(field.key as ProductImportFieldKey),
	)

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
		setCurrency(current => resume.currency || current || primaryCurrencyLabel)
		setStep('mapping')
	}, [isOpen, primaryCurrencyLabel, status?.resume?.sessionId])

	useEffect(() => {
		if (!isOpen || status?.resume || currency || !primaryCurrencyLabel) return

		setCurrency(primaryCurrencyLabel)
	}, [currency, isOpen, primaryCurrencyLabel, status?.resume])

	const reset = () => {
		setStep('fields')
		setSelectedFields([...PRODUCT_IMPORT_FIELD_KEYS])
		setFiles([])
		setCurrency(primaryCurrencyLabel)
		setParsed(null)
		setMapping({})
		setProposals([])
		setDecisions([])
		setPreview(null)
		setResult(null)
		setCommitProgress(null)
	}

	const handleClose = () => {
		if (isCommitting) return

		reset()
		onClose()
	}

	const requiredMapped = REQUIRED_PRODUCT_IMPORT_FIELDS.every(field =>
		Boolean(mapping[field]?.trim()),
	)
	const currencyReady = Boolean(currency.trim()) && currencyOptions.length > 0
	const needsMasterStep = MASTER_DATA_IMPORT_FIELDS.some(
		field => selectedFields.includes(field) && Boolean(mapping[field]?.trim()),
	)
	const masterReady =
		decisions.length === 0 ||
		decisions.every(
			decision =>
				decision.action === 'skip' ||
				(decision.action === 'create' &&
					Boolean((decision.createName ?? decision.excelValue).trim())) ||
				(decision.action === 'match' && Boolean(decision.matchedId)),
		)

	const toggleField = (key: ProductImportFieldKey, checked: boolean) => {
		if (REQUIRED_PRODUCT_IMPORT_FIELDS.includes(key)) return

		setSelectedFields(current =>
			checked
				? PRODUCT_IMPORT_FIELD_KEYS.filter(
						field => current.includes(field) || field === key,
					)
				: current.filter(field => field !== key),
		)
	}

	const rejectNonExcel = () => {
		showToast({
			status: 'error',
			description: t('productImport.excelOnly'),
		})
	}

	const handleParse = async () => {
		if (!currencyReady) {
			showToast({
				status: 'error',
				description: t('productImport.currencyRequired'),
			})
			return
		}

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
			const response = await parseImport({
				files: payload,
				currency,
				selectedFields,
			}).unwrap()

			setParsed(response)
			if (response.currency) setCurrency(response.currency)
			if (response.selectedFields?.length) {
				setSelectedFields(response.selectedFields)
			}
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

	const handlePrepareMaster = async () => {
		if (!parsed) return

		if (!needsMasterStep) {
			setProposals([])
			setDecisions([])
			setStep('confirm')
			return
		}

		try {
			const response = await prepareMaster({
				sessionId: parsed.sessionId,
				mapping,
			}).unwrap()

			setProposals(response.proposals)
			setDecisions(
				response.proposals.map(proposal => ({
					kind: proposal.kind,
					excelValue: proposal.excelValue,
					action:
						proposal.status === 'match'
							? 'match'
							: proposal.status === 'create'
								? 'create'
								: 'match',
					matchedId: proposal.matchedId,
					createName: proposal.excelValue,
				})),
			)
			setStep(response.proposals.length ? 'master' : 'confirm')
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description:
					err.data?.message || t('productImport.masterPrepareFailed'),
			})
		}
	}

	const handleConfirmMaster = async () => {
		if (!parsed) return

		if (!needsMasterStep || proposals.length === 0) {
			setStep('confirm')
			return
		}

		try {
			await confirmMaster({
				sessionId: parsed.sessionId,
				decisions,
			}).unwrap()
			setStep('confirm')
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description:
					err.data?.message || t('productImport.masterConfirmFailed'),
			})
		}
	}

	const handlePreview = async () => {
		if (!parsed || !currencyReady) return

		try {
			const response = await previewImport({
				sessionId: parsed.sessionId,
				mapping,
				currency,
			}).unwrap()

			setPreview(response)
			if (response.currency) setCurrency(response.currency)
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
		if (!parsed || !currencyReady) return

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
							currency,
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
					) : step === 'fields' ? (
						<VStack align="stretch" gap={4}>
							<FormControl isRequired isInvalid={!currencyReady}>
								<FormLabel>{t('productImport.currency')}</FormLabel>
								<Select
									value={currency}
									placeholder={t('productImport.selectCurrency')}
									sx={{
										'& + div': {
											left: '0.75rem',
											right: 'auto',
										},
									}}
									onChange={event => setCurrency(event.target.value)}
								>
									{currencyOptions.map(option => (
										<option key={option.value} value={option.value}>
											{option.label} ({option.value})
										</option>
									))}
								</Select>
							</FormControl>
							<Text color="gray.600">
								{t('productImport.selectFieldsHint')}
							</Text>
							{PRODUCT_IMPORT_FIELD_KEYS.map(key => (
								<Checkbox
									key={key}
									isChecked={selectedFields.includes(key)}
									isDisabled={REQUIRED_PRODUCT_IMPORT_FIELDS.includes(key)}
									onChange={event => toggleField(key, event.target.checked)}
								>
									{t(PRODUCT_IMPORT_FIELD_LABEL_KEYS[key])}
									{REQUIRED_PRODUCT_IMPORT_FIELDS.includes(key) ? ' *' : ''}
								</Checkbox>
							))}
						</VStack>
					) : step === 'upload' ? (
						<VStack align="stretch" gap={5}>
							<Text color="gray.700" fontWeight={500}>
								{t('productImport.uploadHint')}
							</Text>
							<Box
								border="1px solid"
								borderColor="orange.200"
								bg="orange.50"
								borderRadius="lg"
								p={4}
							>
								<Text fontWeight={700} color="orange.800" mb={2}>
									{t('productImport.uploadPrerequisitesTitle')}
								</Text>
								<Text fontSize="sm" color="orange.900">
									{t('productImport.uploadPrerequisites')}
								</Text>
							</Box>
							<Box
								border="1px solid"
								borderColor="gray.200"
								borderRadius="lg"
								p={4}
							>
								<Text fontWeight={700} color="gray.800" mb={3}>
									{t('productImport.uploadChecklistTitle')}
								</Text>
								<VStack align="stretch" gap={3}>
									{UPLOAD_CHECKLIST_ITEMS.map(item => (
										<Flex key={item.key} gap={3} align="flex-start">
											<Text
												flexShrink={0}
												fontSize="sm"
												fontWeight={700}
												color={
													item.tone === 'warning' ? 'red.500' : 'green.600'
												}
											>
												{item.tone === 'warning' ? '!' : '✓'}
											</Text>
											<Text
												fontSize="sm"
												color="gray.700"
												fontWeight={item.tone === 'warning' ? 600 : undefined}
											>
												{t(item.key)}
											</Text>
										</Flex>
									))}
								</VStack>
							</Box>
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
							<Button
								onClick={() => fileInputRef.current?.click()}
								alignSelf="flex-start"
							>
								{t('productImport.chooseFiles')}
							</Button>
							{files.length > 0 ? (
								<Box
									border="1px solid"
									borderColor="gray.200"
									borderRadius="md"
									p={3}
								>
									<VStack align="stretch" gap={2}>
										{files.map(file => (
											<Flex key={file.name} align="center" gap={2}>
												<Text color="green.600" fontWeight={700}>
													✓
												</Text>
												<Text fontSize="sm" color="gray.700">
													{file.name}
												</Text>
											</Flex>
										))}
									</VStack>
								</Box>
							) : null}
						</VStack>
					) : null}

					{!hasExistingProducts && step === 'mapping' && parsed ? (
						<VStack align="stretch" gap={3}>
							<Text color="gray.600">{t('productImport.mappingHint')}</Text>
							{mappingFields.map(field => (
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
								</Flex>
							))}
						</VStack>
					) : null}

					{!hasExistingProducts && step === 'master' ? (
						<Stack spacing={6}>
							{/* Header */}
							<Box>
								<Heading size="md" color="gray.800">
									{t('productImport.masterReviewTitle')}
								</Heading>
								<Text mt={1} color="gray.600" fontSize="sm">
									{t('productImport.masterReviewHint')}
								</Text>
							</Box>

							{/* Empty state */}
							{proposals.length === 0 ? (
								<Box
									py={10}
									px={6}
									textAlign="center"
									borderWidth="1px"
									borderStyle="dashed"
									borderColor="gray.300"
									borderRadius="lg"
									bg="gray.50"
								>
									<Text color="gray.500" fontSize="sm">
										{t('productImport.noProposals')}
									</Text>
								</Box>
							) : (
								<Stack spacing={4}>
									{proposals.map((proposal, index) => {
										const decision = decisions[index]
										const action = decision?.action ?? 'skip'
										const hasCandidates = proposal.candidates.length > 0
										const isMatching = action === 'match'
										const isCreating = action === 'create'
										const fieldLabel = t(
											PRODUCT_IMPORT_FIELD_LABEL_KEYS[proposal.kind],
										)
										const actionId = `action-${index}`
										const matchId = `match-${index}`
										const createNameId = `create-name-${index}`

										return (
											<Box
												key={`${proposal.kind}-${proposal.excelValue}`}
												borderWidth="1px"
												borderColor="gray.200"
												borderRadius="lg"
												bg="white"
												p={5}
											>
												<Stack spacing={4}>
													{/* Field + value + status badge */}
													<Flex justify="space-between" align="start" gap={3}>
														<Box minW={0}>
															<Text
																fontSize="xs"
																fontWeight={700}
																color="gray.500"
																textTransform="uppercase"
																letterSpacing="0.04em"
															>
																{fieldLabel}
															</Text>
															<Text
																mt={1}
																fontSize="md"
																fontWeight={600}
																color="gray.800"
																isTruncated
																title={proposal.excelValue}
															>
																{proposal.excelValue}
															</Text>
														</Box>

														<Badge
															flexShrink={0}
															colorScheme={
																action === 'match'
																	? 'blue'
																	: action === 'create'
																		? 'green'
																		: 'gray'
															}
															variant="subtle"
															borderRadius="md"
															px={2}
															py={1}
															fontSize="xs"
															textTransform="none"
														>
															{action === 'match'
																? t('productImport.masterMatch')
																: action === 'create'
																	? t('productImport.masterCreate')
																	: t('productImport.masterSkip')}
														</Badge>
													</Flex>

													{/* Decision controls */}
													<Flex
														direction={{ base: 'column', md: 'row' }}
														align={{ base: 'stretch', md: 'flex-end' }}
														gap={4}
													>
														<FormControl flex="1">
															<FormLabel
																htmlFor={actionId}
																fontSize="sm"
																fontWeight={600}
																color="gray.700"
																mb={2}
															>
																{t('productImport.masterAction')}
															</FormLabel>
															<Select
																sx={{
																	'& + div': {
																		left: '0.75rem',
																		right: 'auto',
																	},
																}}
																id={actionId}
																value={action}
																onChange={event => {
																	const nextAction = event.target.value as
																		'match' | 'create' | 'skip'

																	setDecisions(current =>
																		current.map((item, i) =>
																			i === index
																				? {
																						...item,
																						action: nextAction,
																						matchedId:
																							nextAction === 'match'
																								? item.matchedId ||
																									proposal.candidates[0]?.id
																								: undefined,
																						createName:
																							nextAction === 'create'
																								? item.createName ||
																									proposal.excelValue
																								: item.createName,
																					}
																				: item,
																		),
																	)
																}}
															>
																{hasCandidates ? (
																	<option value="match">
																		{t('productImport.masterMatch')}
																	</option>
																) : null}
																<option value="create">
																	{t('productImport.masterCreate')}
																</option>
																<option value="skip">
																	{t('productImport.masterSkip')}
																</option>
															</Select>
														</FormControl>

														{isMatching ? (
															<FormControl flex="1">
																<FormLabel
																	htmlFor={matchId}
																	fontSize="sm"
																	fontWeight={600}
																	color="gray.700"
																	mb={2}
																>
																	{t('productImport.masterMatchWith')}
																</FormLabel>
																<Select
																	sx={{
																		'& + div': {
																			left: '0.75rem',
																			right: 'auto',
																		},
																	}}
																	id={matchId}
																	value={decision.matchedId ?? ''}
																	onChange={event =>
																		setDecisions(current =>
																			current.map((item, i) =>
																				i === index
																					? {
																							...item,
																							matchedId: event.target.value,
																						}
																					: item,
																			),
																		)
																	}
																>
																	{proposal.candidates.map(candidate => (
																		<option
																			key={candidate.id}
																			value={candidate.id}
																		>
																			{candidate.name}
																		</option>
																	))}
																</Select>
															</FormControl>
														) : null}

														{isCreating ? (
															<FormControl flex="1">
																<FormLabel
																	htmlFor={createNameId}
																	fontSize="sm"
																	fontWeight={600}
																	color="gray.700"
																	mb={2}
																>
																	{t('productImport.masterCreateName')}
																</FormLabel>
																<Input
																	id={createNameId}
																	value={
																		decision?.createName ?? proposal.excelValue
																	}
																	onChange={event =>
																		setDecisions(current =>
																			current.map((item, i) =>
																				i === index
																					? {
																							...item,
																							createName: event.target.value,
																						}
																					: item,
																			),
																		)
																	}
																/>
															</FormControl>
														) : null}
													</Flex>

													{/* Candidate hint (only when not already matching) */}
													{hasCandidates && !isMatching ? (
														<Box
															px={3}
															py={2}
															borderRadius="md"
															bg="gray.50"
															borderWidth="1px"
															borderColor="gray.100"
														>
															<Text fontSize="xs" color="gray.600">
																{t('productImport.candidateHint', {
																	count: proposal.candidates.length,
																})}
															</Text>
														</Box>
													) : null}
												</Stack>
											</Box>
										)
									})}
								</Stack>
							)}
						</Stack>
					) : null}

					{!hasExistingProducts && step === 'confirm' && (
						<VStack align="stretch" gap={2}>
							<Text>
								{t('productImport.currency')}
								{' ← '}
								{currency}
							</Text>
							{mappingFields
								.filter(field => mapping[field.key])
								.map(field => (
									<Text key={field.key}>
										{t(
											PRODUCT_IMPORT_FIELD_LABEL_KEYS[
												field.key as ProductImportFieldKey
											],
										)}
										{' ← '}
										{mapping[field.key]}
									</Text>
								))}
						</VStack>
					)}

					{!hasExistingProducts && step === 'preview' && preview ? (
						<VStack align="stretch" gap={6}>
							{/* Header */}
							<Box>
								<Text fontSize="xl" fontWeight={700} color="gray.800">
									{t('productImport.previewTitle')}
								</Text>

								<Text mt={1} fontSize="sm" color="gray.600">
									{t('productImport.previewDescription')}
								</Text>
							</Box>

							{/* Summary */}
							<SimpleGrid columns={{ base: 2, md: 5 }} gap={3}>
								<Box
									border="1px solid"
									borderColor="gray.200"
									borderRadius="lg"
									p={4}
									bg="white"
								>
									<Text fontSize="xs" fontWeight={600} color="gray.500">
										{t('productImport.previewFiles')}
									</Text>

									<Text mt={1} fontSize="2xl" fontWeight={700} color="gray.800">
										{preview.fileCount}
									</Text>
								</Box>

								<Box
									border="1px solid"
									borderColor="gray.200"
									borderRadius="lg"
									p={4}
									bg="white"
								>
									<Text fontSize="xs" fontWeight={600} color="gray.500">
										{t('productImport.previewDetected')}
									</Text>

									<Text mt={1} fontSize="2xl" fontWeight={700} color="gray.800">
										{preview.detected}
									</Text>
								</Box>

								<Box
									border="1px solid"
									borderColor="green.200"
									borderRadius="lg"
									p={4}
									bg="green.50"
								>
									<Text fontSize="xs" fontWeight={600} color="green.700">
										{t('productImport.previewValid')}
									</Text>

									<Text
										mt={1}
										fontSize="2xl"
										fontWeight={700}
										color="green.700"
									>
										{preview.valid}
									</Text>
								</Box>

								<Box
									border="1px solid"
									borderColor="orange.200"
									borderRadius="lg"
									p={4}
									bg="orange.50"
								>
									<Text fontSize="xs" fontWeight={600} color="orange.700">
										{t('productImport.previewDuplicates')}
									</Text>

									<Text
										mt={1}
										fontSize="2xl"
										fontWeight={700}
										color="orange.700"
									>
										{preview.duplicates}
									</Text>
								</Box>

								<Box
									border="1px solid"
									borderColor={preview.invalid > 0 ? 'red.200' : 'gray.200'}
									borderRadius="lg"
									p={4}
									bg={preview.invalid > 0 ? 'red.50' : 'white'}
								>
									<Text
										fontSize="xs"
										fontWeight={600}
										color={preview.invalid > 0 ? 'red.700' : 'gray.500'}
									>
										{t('productImport.previewInvalid')}
									</Text>

									<Text
										mt={1}
										fontSize="2xl"
										fontWeight={700}
										color={preview.invalid > 0 ? 'red.700' : 'gray.800'}
									>
										{preview.invalid}
									</Text>
								</Box>
							</SimpleGrid>

							{/* Errors - intentionally prominent */}
							{preview.errors.length > 0 ? (
								<Box
									border="1px solid"
									borderColor="red.200"
									borderRadius="lg"
									bg="red.50"
									overflow="hidden"
								>
									<Box
										px={5}
										py={4}
										borderBottom="1px solid"
										borderColor="red.200"
									>
										<Flex align="center" gap={3}>
											<Box
												w="32px"
												h="32px"
												borderRadius="full"
												bg="red.100"
												display="flex"
												alignItems="center"
												justifyContent="center"
												flexShrink={0}
											>
												<Text fontWeight={800} color="red.600">
													!
												</Text>
											</Box>

											<Box>
												<Text fontWeight={700} color="red.800">
													{t('productImport.viewErrors')}
												</Text>

												<Text mt={0.5} fontSize="sm" color="red.700">
													{t('productImport.previewErrorsDescription')}
												</Text>
											</Box>
										</Flex>
									</Box>

									<VStack align="stretch" gap={0} maxH="320px" overflowY="auto">
										{preview.errors.map((error, index) => (
											<Box
												key={`${error.fileName}-${error.rowNumber}`}
												px={5}
												py={3}
												borderBottom={
													index < preview.errors.length - 1
														? '1px solid'
														: undefined
												}
												borderColor="red.100"
											>
												<Flex align="flex-start" gap={3}>
													<Box
														flexShrink={0}
														mt={0.5}
														px={2}
														py={0.5}
														borderRadius="md"
														bg="red.100"
													>
														<Text
															fontSize="xs"
															fontWeight={700}
															color="red.700"
														>
															{t('productImport.rowLabel', {
																row: error.rowNumber,
															})}
														</Text>
													</Box>

													<Box flex="1" minW={0}>
														<Text
															fontSize="sm"
															fontWeight={600}
															color="gray.800"
														>
															{error.fileName}
														</Text>

														<Text mt={1} fontSize="sm" color="red.700">
															{error.errors.join(' ')}
														</Text>
													</Box>
												</Flex>
											</Box>
										))}
									</VStack>
								</Box>
							) : (
								<Box
									border="1px solid"
									borderColor="green.200"
									borderRadius="lg"
									bg="green.50"
									p={4}
								>
									<Flex align="center" gap={3}>
										<Box
											w="32px"
											h="32px"
											borderRadius="full"
											bg="green.100"
											display="flex"
											alignItems="center"
											justifyContent="center"
										>
											<Text fontWeight={800} color="green.600">
												✓
											</Text>
										</Box>

										<Box>
											<Text fontWeight={700} color="green.800">
												{t('productImport.noPreviewErrors')}
											</Text>

											<Text fontSize="sm" color="green.700">
												{t('productImport.noPreviewErrorsDescription')}
											</Text>
										</Box>
									</Flex>
								</Box>
							)}

							{/* Preview table */}
							<Box
								border="1px solid"
								borderColor="gray.200"
								borderRadius="lg"
								bg="white"
								overflow="hidden"
							>
								<Box
									px={5}
									py={4}
									borderBottom="1px solid"
									borderColor="gray.200"
								>
									<Text fontWeight={700} color="gray.800">
										{t('productImport.previewDataTitle')}
									</Text>

									<Text mt={1} fontSize="sm" color="gray.500">
										{t('productImport.previewDataDescription')}
									</Text>
								</Box>

								<Box overflowX="auto">
									<Table size="sm">
										<Thead bg="gray.50">
											<Tr>
												<Th whiteSpace="nowrap">{t('common.productName')}</Th>
												<Th whiteSpace="nowrap">{t('common.barcode')}</Th>
												<Th whiteSpace="nowrap">{t('common.category')}</Th>
												<Th whiteSpace="nowrap">{t('common.supplier')}</Th>
												<Th whiteSpace="nowrap">{t('productModal.unitId')}</Th>
												<Th whiteSpace="nowrap">{t('common.stockQuantity')}</Th>
												<Th whiteSpace="nowrap">
													{t('productModal.purchasePrice')}
												</Th>
												<Th whiteSpace="nowrap">
													{t('productModal.retailPrice')}
												</Th>
												<Th whiteSpace="nowrap">
													{t('productModal.wholesalePrice')}
												</Th>
											</Tr>
										</Thead>

										<Tbody>
											{preview.preview.map((row, index) => (
												<Tr
													key={`${row.name}-${index}`}
													_hover={{ bg: 'gray.50' }}
												>
													<Td fontWeight={600} whiteSpace="nowrap">
														{row.name}
													</Td>

													<Td whiteSpace="nowrap">{row.barcode}</Td>

													<Td whiteSpace="nowrap">{row.category}</Td>

													<Td whiteSpace="nowrap">{row.supplier}</Td>

													<Td whiteSpace="nowrap">{row.unit}</Td>

													<Td whiteSpace="nowrap">{row.quantity}</Td>

													<Td whiteSpace="nowrap">{row.purchasePrice}</Td>

													<Td whiteSpace="nowrap" fontWeight={600}>
														{row.retailPrice}
													</Td>

													<Td whiteSpace="nowrap">{row.wholesalePrice}</Td>
												</Tr>
											))}
										</Tbody>
									</Table>
								</Box>
							</Box>
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
							{step === 'fields' ? (
								<Button
									onClick={() => setStep('upload')}
									isDisabled={!currencyReady}
								>
									{t('productImport.continue')}
								</Button>
							) : null}
							{step === 'upload' ? (
								<>
									<Button onClick={() => setStep('fields')}>
										{t('common.back')}
									</Button>
									<Button
										onClick={() => void handleParse()}
										isDisabled={files.length === 0 || !currencyReady}
										isLoading={isParsing}
									>
										{t('productImport.continue')}
									</Button>
								</>
							) : null}
							{step === 'mapping' ? (
								<>
									<Button onClick={() => setStep('upload')}>
										{t('common.back')}
									</Button>
									<Button
										onClick={() => void handlePrepareMaster()}
										isDisabled={!requiredMapped || !currencyReady}
										isLoading={isPreparingMaster}
									>
										{t('productImport.continue')}
									</Button>
								</>
							) : null}
							{step === 'master' ? (
								<>
									<Button onClick={() => setStep('mapping')}>
										{t('common.back')}
									</Button>
									<Button
										onClick={() => void handleConfirmMaster()}
										isDisabled={!masterReady}
										isLoading={isConfirmingMaster}
									>
										{t('productImport.continue')}
									</Button>
								</>
							) : null}
							{step === 'confirm' ? (
								<>
									<Button
										onClick={() =>
											setStep(
												needsMasterStep && proposals.length
													? 'master'
													: 'mapping',
											)
										}
									>
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
