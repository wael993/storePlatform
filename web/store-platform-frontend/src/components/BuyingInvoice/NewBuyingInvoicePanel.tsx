import {
	Box,
	Button,
	Flex,
	Grid,
	HStack,
	Icon,
	IconButton,
	Input,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Text,
	Textarea,
	VStack,
} from '@chakra-ui/react'
import { AddIcon, ChevronDownIcon, CloseIcon } from '@chakra-ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetBuyingInvoiceQuery,
	useGetInvoiceSettingsQuery,
	useGetSuppliersQuery,
	usePostBuyingInvoiceMutation,
	useUpdateBuyingInvoiceMutation,
	useExtractBuyingInvoiceMutation,
	useGetInvoiceAiUsageQuery,
	useConfirmBuyingInvoiceMatchMutation,
	useCreateSupplierMutation,
} from '../../api/apiStore'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import { calculateInvoiceTotals } from '../SellingInvoice/invoiceCalculations'
import {
	applyInvoiceLevelDiscount,
	clearInvoiceDiscountFields,
	getInvoiceDiscountSettings,
} from '../SellingInvoice/invoiceDiscountDraft'
import EditableDiscountField from '../SellingInvoice/EditableDiscountField'
import InvoiceLineItemsTable from '../SellingInvoice/InvoiceLineItemsTable'
import InvoiceProductSearch from '../SellingInvoice/InvoiceProductSearch'
import {
	addProductToLineItems,
	createLineItemFromProduct,
} from '../SellingInvoice/productLineItem'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'
import { useProductCatalog } from '../SellingInvoice/useProductCatalog'
import { getProductCatalogState } from '../../offline/productCatalogStore'
import AddProductModal from '../../pages/AddProductModal'
import CurrencyAmountTooltip from '../SellingInvoice/CurrencyAmountTooltip'
import DropdownLabel from '../DropdownLabel'
import { AsDollarSignIcon } from '../../icons/DollarSign'
import { AsPauseIcon } from '../../icons/Pause'
import { AsSaveIcon } from '../icons/Save'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import { AsDocumentIcon } from '../../shared/icons/Document'
import DatePickerLabel from '../common/DatePickerLabel'
import {
	formatDateInputValue,
	parseDateInputValue,
} from '../../shared/dateUtils'
import { useUser } from '../../shared/hooks/useUser'
import { getEnabledActions, getTenantActions } from '../../shared/utils'
import { InvoicePaymentType, InvoiceStatus } from '../../shared/globalEnums'
import {
	buildBuyingInvoiceRequestBody,
	mapApiBuyingInvoiceToDraft,
} from './buyingInvoiceApiMappers'
import { createBuyingInvoiceDraft } from './buyingInvoiceDraftSessions'
import useCustomToast from '../common/CustomToast'
import type {
	BuyingInvoiceDraft,
	BuyingInvoiceLineItem,
	BuyingInvoicePaymentType,
} from './types'
import ConfidenceMark from './ConfidenceMark'
import MatchBanner from './MatchBanner'
import InvoiceExtractPreview from './InvoiceExtractPreview'
import {
	applyScoredExtraction,
	draftHasUnresolvedExtraction,
	dropExtractedImport,
} from './applyInvoiceExtraction'
import {
	confirmReview,
	isPendingProductId,
	reviewAfterEdit,
	type InvoiceImportStatus,
} from '../../shared/invoiceExtraction'

export interface BuyingInvoiceDraftTab {
	id: string
	label: string
}

export type BuyingInvoicePanelMode = 'create' | 'view' | 'edit'

interface NewBuyingInvoicePanelProps {
	isActive: boolean
	onClose: () => void
	onSaved?: () => void
	mode?: BuyingInvoicePanelMode
	buyingInvoiceId?: string
	onRequestEdit?: () => void
	nextInvoiceNumber?: number
	initialProductSearch?: string
	initialPaymentType?: BuyingInvoicePaymentType
	draft?: BuyingInvoiceDraft
	onDraftChange?: (
		updater:
			| BuyingInvoiceDraft
			| ((current: BuyingInvoiceDraft) => BuyingInvoiceDraft),
	) => void
	showNote?: boolean
	onShowNoteChange?: (showNote: boolean) => void
	draftTabs?: BuyingInvoiceDraftTab[]
	activeDraftTabId?: string
	onSelectDraftTab?: (tabId: string) => void
	onCloseDraftTab?: (tabId: string) => void
	onAddDraftTab?: () => void
	suppliers?: Supplier[]
	salesPerson?: string
}

const PaymentTypeButton = ({
	type,
	label,
	icon,
	isActive,
	isDisabled = false,
	onClick,
}: {
	type: BuyingInvoicePaymentType
	label: string
	icon: React.ReactNode
	isActive: boolean
	isDisabled?: boolean
	onClick: (type: BuyingInvoicePaymentType) => void
}) => {
	const activeStyles = {
		[InvoicePaymentType.CASH]: {
			bg: '#DCFCE7',
			color: '#15803D',
			borderColor: '#86EFAC',
		},
		[InvoicePaymentType.CREDIT]: {
			bg: '#FFEDD5',
			color: '#C2410C',
			borderColor: '#FDBA74',
		},
	}[type]

	return (
		<Button
			flex={1}
			variant="outline"
			leftIcon={icon as React.ReactElement}
			size="sm"
			fontWeight={600}
			borderRadius="lg"
			bg={isActive ? activeStyles.bg : 'white'}
			color={isActive ? activeStyles.color : PAGE_COLORS.muted}
			borderColor={isActive ? activeStyles.borderColor : PAGE_COLORS.border}
			isDisabled={isDisabled}
			onClick={() => onClick(type)}
		>
			{label}
		</Button>
	)
}

const panelStyles = {
	root: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		minH: '0',
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: PAGE_COLORS.border,
		boxShadow: PAGE_COLORS.cardShadow,
		overflow: 'hidden',
	},
	header: {
		alignItems: 'center',
		justifyContent: 'space-between',
		px: { base: '4', md: '5' },
		py: '4',
		borderBottom: '1px solid',
		borderColor: PAGE_COLORS.border,
		flexShrink: '0',
		bg: 'white',
	},
	body: {
		flex: '1',
		minH: '0',
		overflowY: 'auto',
		px: { base: '4', md: '5' },
		py: '5',
		display: 'flex',
		flexDirection: 'column',
		gap: '5',
	},
} satisfies StylesObject

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

const NewBuyingInvoicePanel = ({
	isActive,
	onClose,
	onSaved,
	mode = 'create',
	buyingInvoiceId,
	onRequestEdit,
	nextInvoiceNumber = 1,
	initialProductSearch = '',
	initialPaymentType = InvoicePaymentType.CASH,
	draft: controlledDraft,
	onDraftChange,
	showNote: controlledShowNote,
	onShowNoteChange,
	draftTabs = [],
	activeDraftTabId,
	onSelectDraftTab,
	onCloseDraftTab,
	onAddDraftTab,
	suppliers: suppliersProp,
	salesPerson: salesPersonProp,
}: NewBuyingInvoicePanelProps) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const { user } = useUser()
	const canUseInvoiceAi =
		getEnabledActions().isInvoiceAiEnabled &&
		getTenantActions(user?.accessiblePages).isTenantInvoiceAiEnabled
	const isReadOnly = mode === 'view'
	const isExistingInvoice = mode === 'view' || mode === 'edit'
	const { data: fetchedSuppliers = [] } = useGetSuppliersQuery(
		{},
		{
			skip: suppliersProp !== undefined,
			refetchOnMountOrArgChange: false,
		},
	)
	const { data: invoiceSettings } = useGetInvoiceSettingsQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})
	const suppliers = suppliersProp ?? fetchedSuppliers
	const salesPerson =
		salesPersonProp ||
		[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
		user?.email ||
		'User'

	const [postBuyingInvoice, { isLoading: isCreating }] =
		usePostBuyingInvoiceMutation()
	const [updateBuyingInvoice, { isLoading: isUpdating }] =
		useUpdateBuyingInvoiceMutation()
	const [extractBuyingInvoice, { isLoading: isExtracting }] =
		useExtractBuyingInvoiceMutation()
	const {
		data: invoiceAiUsage,
		refetch: refetchInvoiceAiUsage,
		isLoading: isInvoiceAiUsageLoading,
		isError: isInvoiceAiUsageError,
	} = useGetInvoiceAiUsageQuery(undefined, {
		skip: !canUseInvoiceAi,
		refetchOnFocus: true,
	})
	const [confirmBuyingInvoiceMatch] = useConfirmBuyingInvoiceMatchMutation()
	const [createSupplier, { isLoading: isCreatingSupplier }] =
		useCreateSupplierMutation()
	const { products, refetch: refetchCatalog } = useProductCatalog()
	const {
		data: existingInvoice,
		isLoading: isLoadingInvoice,
		isError: isInvoiceError,
	} = useGetBuyingInvoiceQuery(buyingInvoiceId ?? '', {
		skip: !isActive || !buyingInvoiceId || !isExistingInvoice,
	})
	const isSaving = isCreating || isUpdating
	const [saveError, setSaveError] = useState<string | null>(null)
	const [extractFile, setExtractFile] = useState<File | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | undefined>()
	const [extractFailed, setExtractFailed] = useState(false)
	const [importRejected, setImportRejected] = useState(false)
	const [isRefreshingUsage, setIsRefreshingUsage] = useState(false)
	const supplierBeforeExtractRef = useRef<{
		supplierId: string
		supplierName: string
	} | null>(null)
	const [createProductLineId, setCreateProductLineId] = useState<string | null>(
		null,
	)
	const findProductLineIdRef = useRef<string | null>(null)
	const [searchFocusNonce, setSearchFocusNonce] = useState(0)
	const [createSupplierName, setCreateSupplierName] = useState<string | null>(
		null,
	)
	const isControlledCreate = Boolean(controlledDraft && onDraftChange)

	const [internalDraft, setInternalDraft] = useState<BuyingInvoiceDraft>(() =>
		createBuyingInvoiceDraft(salesPerson, { paymentType: initialPaymentType }),
	)
	const [internalShowNote, setInternalShowNote] = useState(false)

	const draft =
		isControlledCreate && controlledDraft ? controlledDraft : internalDraft
	const setDraft =
		isControlledCreate && onDraftChange ? onDraftChange : setInternalDraft
	const showNote = isControlledCreate
		? Boolean(controlledShowNote)
		: internalShowNote
	const setShowNote = isControlledCreate
		? (value: boolean) => onShowNoteChange?.(value)
		: setInternalShowNote

	useEffect(() => {
		if (!extractFile) {
			setPreviewUrl(undefined)
			return
		}
		const url = URL.createObjectURL(extractFile)
		setPreviewUrl(url)
		return () => URL.revokeObjectURL(url)
	}, [extractFile])

	useEffect(() => {
		if (!canUseInvoiceAi || !invoiceAiUsage?.nextPeriodStartsAt) return

		const delay =
			new Date(invoiceAiUsage.nextPeriodStartsAt).getTime() - Date.now()
		if (delay <= 0) return

		const timer = window.setTimeout(
			() => {
				void refetchInvoiceAiUsage()
			},
			Math.min(delay, 2_147_483_647),
		)

		return () => window.clearTimeout(timer)
	}, [
		canUseInvoiceAi,
		invoiceAiUsage?.nextPeriodStartsAt,
		refetchInvoiceAiUsage,
	])

	const {
		options: displayCurrencyOptions,
		displayCurrencyId,
		setDisplayCurrencyId,
		formatAmount,
		hasCurrencyOptions,
		currencySettings,
	} = useInvoiceDisplayCurrency()

	useEffect(() => {
		if (!isActive || isControlledCreate || isExistingInvoice) return

		setInternalDraft(
			createBuyingInvoiceDraft(salesPerson, {
				paymentType: initialPaymentType,
				invoiceNumber: nextInvoiceNumber,
			}),
		)
		setInternalShowNote(false)
		setSaveError(null)
	}, [
		isActive,
		isControlledCreate,
		isExistingInvoice,
		initialPaymentType,
		nextInvoiceNumber,
		salesPerson,
	])

	useEffect(() => {
		if (!isActive || !isExistingInvoice || !existingInvoice) return

		setInternalDraft(mapApiBuyingInvoiceToDraft(existingInvoice))
		setInternalShowNote(Boolean(existingInvoice.notes?.trim()))
		setSaveError(null)
	}, [existingInvoice, isActive, isExistingInvoice])

	useEffect(() => {
		if (!draft.salesPerson && salesPerson) {
			setDraft(current => ({ ...current, salesPerson }))
		}
	}, [draft.salesPerson, salesPerson, setDraft])

	useEffect(() => {
		if (!isControlledCreate) return
		setSaveError(null)
	}, [isControlledCreate, controlledDraft?.invoiceId])

	const totals = useMemo(
		() =>
			calculateInvoiceTotals(
				draft.lineItems,
				getInvoiceDiscountSettings(draft),
			),
		[
			draft.lineItems,
			draft.useInvoiceDiscount,
			draft.invoiceDiscount,
			draft.invoiceDiscountIsPercent,
		],
	)

	useEffect(() => {
		if (isReadOnly || draft.paymentType !== InvoicePaymentType.CASH) return

		setDraft(current => ({
			...current,
			paidAmount: calculateInvoiceTotals(
				current.lineItems,
				getInvoiceDiscountSettings(current),
			).grandTotal,
		}))
	}, [
		draft.lineItems,
		draft.paymentType,
		draft.useInvoiceDiscount,
		draft.invoiceDiscount,
		draft.invoiceDiscountIsPercent,
		isReadOnly,
		setDraft,
	])

	const changeAmount = Math.max(0, draft.paidAmount - totals.grandTotal)

	const supplierOptions = useMemo(
		(): Pick<Supplier, 'supplierId' | 'name'>[] => suppliers,
		[suppliers],
	)

	const hasSupplier = Boolean(draft.supplierId)
	const hasSalesPerson = Boolean((draft.salesPerson || salesPerson).trim())

	const handleAddProduct = (product: Product, targetLineId?: string) => {
		setDraft(current => {
			const pendingIndex = current.lineItems.findIndex(item =>
				targetLineId
					? item.id === targetLineId
					: isPendingProductId(item.productId),
			)
			if (pendingIndex === -1) {
				return {
					...current,
					lineItems: addProductToLineItems(
						current.lineItems,
						product,
						'buying',
						{
							noMergeInvoiceLines:
								invoiceSettings?.noMergeInvoiceLines ?? false,
							currencyOptions: displayCurrencyOptions,
						},
					),
				}
			}

			const linked = createLineItemFromProduct(
				product,
				'buying',
				displayCurrencyOptions,
			)
			const existing = current.lineItems[pendingIndex]
			const nextItems = current.lineItems.map((item, index) =>
				index === pendingIndex
					? {
							...linked,
							id: item.id,
							quantity: existing.quantity ?? linked.quantity,
							unit: existing.unit || linked.unit,
							unitPrice: existing.unitPrice ?? linked.unitPrice,
							sourceName: existing.sourceName,
						}
					: item,
			)
			const line = current.extraction?.lines[existing.id]
			const lineMatch = current.extraction?.lineMatches?.[existing.id]
			const invoiceName = lineMatch?.invoiceName ?? existing.name
			if (!current.extraction) {
				return { ...current, lineItems: nextItems }
			}

			return {
				...current,
				lineItems: nextItems,
				extraction: {
					...current.extraction,
					lines: line
						? {
								...current.extraction.lines,
								[existing.id]: {
									...line,
									name: reviewAfterEdit(line.name),
								},
							}
						: current.extraction.lines,
					lineMatches: {
						...current.extraction.lineMatches,
						[existing.id]: {
							id: product.productId,
							name: product.name,
							confidence: 1,
							band: 'high',
							reason: lineMatch?.reason ?? 'name',
							autoLink: true,
							invoiceName: invoiceName || null,
							confirmed: true,
						},
					},
				},
			}
		})
	}

	const confirmHeaderReview = (
		key: 'supplierName' | 'invoiceNumber' | 'invoiceDate' | 'vat' | 'total',
	) => {
		setDraft(current => {
			if (!current.extraction) return current
			return {
				...current,
				extraction: {
					...current.extraction,
					[key]: confirmReview(current.extraction[key]),
				},
			}
		})
	}

	const handleUpdateItem = (
		id: string,
		updates: Partial<BuyingInvoiceLineItem>,
	) => {
		setDraft(current => {
			const clearsInvoiceDiscount =
				'discount' in updates || 'discountIsPercent' in updates
			const line = current.extraction?.lines[id]
			const nextLine = line
				? {
						...line,
						...('quantity' in updates
							? { quantity: reviewAfterEdit(line.quantity) }
							: {}),
						...('unitPrice' in updates
							? { unitPrice: reviewAfterEdit(line.unitPrice) }
							: {}),
						...('name' in updates ? { name: reviewAfterEdit(line.name) } : {}),
					}
				: line

			return {
				...current,
				...(clearsInvoiceDiscount ? clearInvoiceDiscountFields() : {}),
				lineItems: current.lineItems.map(item =>
					item.id === id ? { ...item, ...updates } : item,
				),
				extraction:
					current.extraction && nextLine
						? {
								...current.extraction,
								lines: { ...current.extraction.lines, [id]: nextLine },
							}
						: current.extraction,
			}
		})
	}

	const handleInvoiceDiscountEdit = (
		discount: number,
		discountIsPercent: boolean,
	) => {
		const invoiceDiscountFields = applyInvoiceLevelDiscount(
			discount,
			discountIsPercent,
		)

		setDraft(current => ({
			...current,
			...invoiceDiscountFields,
			lineItems: invoiceDiscountFields.useInvoiceDiscount
				? current.lineItems.map(item => ({
						...item,
						discount: 0,
						discountIsPercent: true,
					}))
				: current.lineItems,
		}))
	}

	const handleRemoveItem = (id: string) => {
		setDraft(current => {
			if (!current.extraction) {
				return {
					...current,
					lineItems: current.lineItems.filter(item => item.id !== id),
				}
			}
			const { [id]: _removed, ...lines } = current.extraction.lines
			const { [id]: _match, ...lineMatches } =
				current.extraction.lineMatches ?? {}
			return {
				...current,
				lineItems: current.lineItems.filter(item => item.id !== id),
				extraction: { ...current.extraction, lines, lineMatches },
			}
		})
	}

	const handleSupplierChange = (supplierId: string, knownName?: string) => {
		const supplier = supplierOptions.find(
			option => option.supplierId === supplierId,
		)
		const supplierName = supplier?.name ?? knownName

		setDraft(current => ({
			...current,
			supplierId,
			supplierName: supplierName ?? current.supplierName,
			extraction: current.extraction
				? {
						...current.extraction,
						supplierName: reviewAfterEdit(current.extraction.supplierName),
						supplierMatch: current.extraction.supplierMatch
							? {
									...current.extraction.supplierMatch,
									confirmed: true,
								}
							: {
									id: supplierId,
									name: supplierName ?? current.supplierName,
									confidence: 1,
									band: 'high',
									reason: 'name',
									autoLink: true,
									invoiceName: current.supplierName,
									confirmed: true,
								},
					}
				: current.extraction,
		}))
	}

	const handlePaymentTypeChange = (paymentType: BuyingInvoicePaymentType) => {
		setDraft(current => ({
			...current,
			paymentType,
			paidAmount:
				paymentType === InvoicePaymentType.CASH ? totals.grandTotal : 0,
		}))
	}

	const canSave =
		draft.lineItems.length > 0 &&
		hasSupplier &&
		hasSalesPerson &&
		draft.lineItems.every(
			item => !isPendingProductId(item.productId) && item.quantity >= 1,
		) &&
		!draftHasUnresolvedExtraction(draft)

	const isAiImport = Boolean(draft.extraction)
	const importStatus: InvoiceImportStatus | null = isExtracting
		? 'processing'
		: extractFailed
			? 'failed'
			: importRejected && !draft.extraction
				? 'rejected'
				: !draft.extraction
					? null
					: canSave
						? 'ready_for_approval'
						: 'review_required'

	const handleExtractInvoice = async () => {
		if (!extractFile || invoiceAiUsage?.available === 0) return
		setSaveError(null)
		setExtractFailed(false)
		setImportRejected(false)
		setIsRefreshingUsage(true)
		try {
			const extraction = await extractBuyingInvoice({
				fileBase64: await fileToBase64(extractFile),
				mimeType: extractFile.type || 'application/pdf',
				fileName: extractFile.name,
			}).unwrap()
			if (!supplierBeforeExtractRef.current) {
				supplierBeforeExtractRef.current = {
					supplierId: draft.supplierId,
					supplierName: draft.supplierName,
				}
			}
			setDraft(current =>
				applyScoredExtraction(current, extraction, supplierOptions, products),
			)
			await refetchInvoiceAiUsage()
		} catch (error) {
			const apiError = error as { data?: { message?: string } }
			setExtractFailed(true)
			setDraft(current =>
				current.extraction
					? dropExtractedImport(current, supplierBeforeExtractRef.current)
					: current,
			)
			setSaveError(
				apiError.data?.message ?? t('components.buyingInvoices.extract.failed'),
			)
		} finally {
			setIsRefreshingUsage(false)
		}
	}

	const handleSaveInvoice = async (status: InvoiceStatus) => {
		if (!canSave) return

		setSaveError(null)

		try {
			const body = buildBuyingInvoiceRequestBody(
				draft,
				status,
				currencySettings,
			)
			if (isExistingInvoice) {
				await updateBuyingInvoice({
					buyingInvoiceId: draft.invoiceId,
					body,
				}).unwrap()
			} else {
				await postBuyingInvoice(body).unwrap()
			}
			const extraction = draft.extraction
			if (extraction) {
				const aliasWrites: Array<ReturnType<typeof confirmBuyingInvoiceMatch>> =
					[]
				const supplierInvoiceName = extraction.supplierMatch?.invoiceName
				if (
					draft.supplierId &&
					extraction.supplierMatch?.id === draft.supplierId &&
					supplierInvoiceName?.trim() &&
					supplierInvoiceName.trim() !== draft.supplierName.trim()
				) {
					aliasWrites.push(
						confirmBuyingInvoiceMatch({
							kind: 'supplier',
							id: draft.supplierId,
							alias: supplierInvoiceName.trim(),
						}),
					)
				}
				for (const line of draft.lineItems) {
					if (isPendingProductId(line.productId)) continue
					const suggestedId = extraction.lineMatches?.[line.id]?.id
					const invoiceName = extraction.lineMatches?.[line.id]?.invoiceName
					if (
						suggestedId === line.productId &&
						invoiceName?.trim() &&
						invoiceName.trim() !== line.name.trim()
					) {
						aliasWrites.push(
							confirmBuyingInvoiceMatch({
								kind: 'product',
								id: line.productId,
								alias: invoiceName.trim(),
							}),
						)
					}
				}
				const aliasResults = await Promise.allSettled(aliasWrites)
				if (aliasResults.some(result => result.status === 'rejected')) {
					showToast({
						title: t('components.buyingInvoices.extract.aliasFailed'),
						status: 'warning',
						duration: 4000,
					})
				}
			}
			showToast({
				title: t(
					isAiImport
						? 'components.buyingInvoices.extract.approveSuccess'
						: 'components.buyingInvoices.drawer.saveSuccess',
				),
				status: 'success',
				duration: 3000,
			})
			onSaved?.()
		} catch (error) {
			const apiError = error as {
				data?: { message?: string }
			}

			setSaveError(
				apiError.data?.message ??
					t('components.buyingInvoices.drawer.saveFailed'),
			)
		}
	}

	const panelTitleKey =
		mode === 'view'
			? 'components.sellingInvoices.drawer.viewTitle'
			: mode === 'edit'
				? 'components.sellingInvoices.drawer.editTitle'
				: 'components.buyingInvoices.drawer.title'

	if (!isActive) return null

	if (isExistingInvoice && isLoadingInvoice) {
		return (
			<Box sx={panelStyles.root}>
				<Flex justify="center" align="center" flex={1} py={16}>
					<Spinner color={PAGE_COLORS.primary} />
				</Flex>
			</Box>
		)
	}

	if (isExistingInvoice && (isInvoiceError || !existingInvoice)) {
		return (
			<Box sx={panelStyles.root}>
				<Flex sx={panelStyles.header}>
					<Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700}>
						{t(panelTitleKey)}
					</Text>
					<IconButton
						aria-label={t('components.buyingInvoices.drawer.close')}
						icon={<CloseIcon boxSize={3} />}
						variant="ghost"
						size="sm"
						onClick={onClose}
					/>
				</Flex>
				<Flex justify="center" align="center" flex={1} py={16}>
					<Text color={PAGE_COLORS.danger}>
						{t('components.sellingInvoices.drawer.loadFailed')}
					</Text>
				</Flex>
			</Box>
		)
	}

	return (
		<>
			<Box sx={panelStyles.root}>
				<Flex sx={panelStyles.header}>
					<HStack spacing={2} align="center" minW={0} flex={1}>
						<Text
							fontSize={{ base: 'lg', md: 'xl' }}
							fontWeight={700}
							noOfLines={1}
						>
							{t(panelTitleKey)}{' '}
							<Text as="span" color={PAGE_COLORS.primary}>
								#{draft.invoiceNumber}
							</Text>
						</Text>
						{onAddDraftTab && (
							<IconButton
								aria-label={t('components.buyingInvoices.drawer.newDraftTab')}
								icon={<AddIcon boxSize={2.5} />}
								size="xs"
								variant="outline"
								borderRadius="md"
								borderColor={PAGE_COLORS.border}
								color={PAGE_COLORS.primary}
								flexShrink={0}
								onClick={onAddDraftTab}
							/>
						)}
					</HStack>
					<HStack spacing={2}>
						{mode === 'view' && onRequestEdit && (
							<Button size="sm" onClick={onRequestEdit}>
								{t('components.sellingInvoices.actions.edit')}
							</Button>
						)}
						<IconButton
							aria-label={t('components.buyingInvoices.drawer.close')}
							icon={<CloseIcon boxSize={3} />}
							variant="ghost"
							size="sm"
							onClick={onClose}
						/>
					</HStack>
				</Flex>

				{draftTabs.length > 0 && (
					<HStack
						px={{ base: 4, md: 5 }}
						py={2}
						spacing={2}
						overflowX="auto"
						borderBottom="1px solid"
						borderColor={PAGE_COLORS.border}
						bg="gray.50"
					>
						{draftTabs.map(tab => {
							const isActiveTab = tab.id === activeDraftTabId
							return (
								<HStack
									key={tab.id}
									as="button"
									type="button"
									spacing={1}
									px={3}
									py={1.5}
									borderRadius="md"
									border="1px solid"
									borderColor={
										isActiveTab ? PAGE_COLORS.primary : PAGE_COLORS.border
									}
									bg={isActiveTab ? 'white' : 'transparent'}
									color={isActiveTab ? PAGE_COLORS.primary : PAGE_COLORS.muted}
									fontSize="sm"
									fontWeight={isActiveTab ? 600 : 500}
									flexShrink={0}
									onClick={() => onSelectDraftTab?.(tab.id)}
									_hover={{ bg: 'white', borderColor: PAGE_COLORS.primary }}
								>
									<Text as="span">{tab.label}</Text>
									{draftTabs.length > 1 && onCloseDraftTab && (
										<Box
											as="span"
											role="button"
											aria-label={t(
												'components.buyingInvoices.drawer.closeDraftTab',
											)}
											display="inline-flex"
											alignItems="center"
											justifyContent="center"
											boxSize={4}
											borderRadius="sm"
											onClick={(event: { stopPropagation: () => void }) => {
												event.stopPropagation()
												onCloseDraftTab(tab.id)
											}}
											_hover={{ bg: 'gray.200' }}
										>
											<CloseIcon boxSize={2} />
										</Box>
									)}
								</HStack>
							)
						})}
					</HStack>
				)}

				<Box sx={panelStyles.body}>
					{!isReadOnly && mode === 'create' && canUseInvoiceAi && (
						<InvoiceExtractPreview
							isExtracting={isExtracting || isRefreshingUsage}
							previewUrl={previewUrl}
							previewMimeType={extractFile?.type}
							onFileChosen={setExtractFile}
							onExtract={handleExtractInvoice}
							availableCount={invoiceAiUsage?.available}
							nextPeriodStartsAt={invoiceAiUsage?.nextPeriodStartsAt}
							isUsageLoading={isInvoiceAiUsageLoading}
							isUsageError={isInvoiceAiUsageError}
							importStatus={importStatus}
							onReject={() => {
								setDraft(current =>
									dropExtractedImport(
										current,
										supplierBeforeExtractRef.current,
									),
								)
								supplierBeforeExtractRef.current = null
								setExtractFile(null)
								setExtractFailed(false)
								setImportRejected(true)
								setSaveError(null)
							}}
						/>
					)}
					<Grid
						templateColumns={{
							base: '1fr',
							md: 'repeat(2, 1fr)',
							'2xl': 'repeat(3, 1fr)',
						}}
						gap={3}
					>
						<Box>
							<Flex align="center" gap={2} mb={1}>
								<Text fontSize="xs" fontWeight={600} color={PAGE_COLORS.muted}>
									{t('components.buyingInvoices.drawer.invoiceDate')}
								</Text>
								<ConfidenceMark
									review={draft.extraction?.invoiceDate}
									onConfirm={() => confirmHeaderReview('invoiceDate')}
								/>
							</Flex>
							<DatePickerLabel
								label=""
								onChange={date =>
									setDraft(current => ({
										...current,
										invoiceDate: date
											? formatDateInputValue(date)
											: current.invoiceDate,
										extraction: current.extraction
											? {
													...current.extraction,
													invoiceDate: reviewAfterEdit(
														current.extraction.invoiceDate,
													),
												}
											: current.extraction,
									}))
								}
								defaultDate={parseDateInputValue(draft.invoiceDate)}
							/>
						</Box>
						<Box>
							<Text
								fontSize="xs"
								fontWeight={600}
								color={PAGE_COLORS.muted}
								mb={3.5}
							>
								{t('components.buyingInvoices.drawer.invoiceTime')}
							</Text>
							<Input
								type="time"
								value={draft.invoiceTime}
								onChange={event =>
									setDraft(current => ({
										...current,
										invoiceTime: event.target.value,
									}))
								}
								backgroundColor={PAGE_COLORS.border}
								disabled
								borderRadius="none"
								borderColor={PAGE_COLORS.border}
							/>
						</Box>

						<DropdownLabel
							label={t('components.buyingInvoices.drawer.salesPerson')}
							options={[
								{
									label: draft.salesPerson || salesPerson,
									value: draft.salesPerson || salesPerson,
								},
							]}
							selectedOptions={[
								{
									label: draft.salesPerson || salesPerson,
									value: draft.salesPerson || salesPerson,
								},
							]}
							onSelect={values =>
								setDraft(current => ({
									...current,
									salesPerson: values[0] ?? current.salesPerson ?? salesPerson,
								}))
							}
							placeholder={t('components.buyingInvoices.drawer.salesPerson')}
							isSingle
							isSearchable
							isDisabled
							customStyles={{
								dropdownContainer: {
									width: '100%',
								},
								dropdownMenu: {
									mt: '0.4rem',
									borderRadius: 'none',
									width: '100%',
								},
								dropdownPlaceholder: {
									width: '100%',
								},
							}}
						/>

						<Box>
							<Flex align="center" gap={2} mb={1}>
								<Text fontSize="xs" fontWeight={600} color={PAGE_COLORS.muted}>
									{t('components.buyingInvoices.drawer.supplier')}
								</Text>
								<ConfidenceMark
									review={draft.extraction?.supplierName}
									onConfirm={() => confirmHeaderReview('supplierName')}
								/>
							</Flex>
							<DropdownLabel
								label=""
								options={supplierOptions.map(supplier => ({
									label: supplier.name,
									value: supplier.supplierId,
								}))}
								selectedOptions={
									draft.supplierId
										? [{ label: draft.supplierName, value: draft.supplierId }]
										: []
								}
								onSelect={values => handleSupplierChange(values[0] ?? '')}
								placeholder={
									!draft.supplierId && draft.supplierName
										? draft.supplierName
										: t('components.buyingInvoices.drawer.supplier')
								}
								isSingle
								isSearchable
								isDisabled={isReadOnly}
								customStyles={{
									dropdownContainer: {
										width: '100%',
									},
									dropdownMenu: {
										mt: '0.4rem',
										borderRadius: 'none',
										width: '100%',
									},
									dropdownPlaceholder: {
										width: '100%',
									},
								}}
							/>
							<MatchBanner
								kind="supplier"
								match={draft.extraction?.supplierMatch}
								isReadOnly={isReadOnly}
								onConfirm={() => {
									const match = draft.extraction?.supplierMatch
									if (match?.id) handleSupplierChange(match.id)
								}}
								onCreate={() =>
									setCreateSupplierName(
										draft.extraction?.supplierMatch?.invoiceName ??
											draft.supplierName,
									)
								}
							/>
							{draft.sourceSupplierName &&
								draft.sourceSupplierName !== draft.supplierName && (
									<Text fontSize="xs" color={PAGE_COLORS.muted} mt={1}>
										{t('components.buyingInvoices.extract.match.rawName', {
											name: draft.sourceSupplierName,
										})}
									</Text>
								)}
						</Box>
						<Box>
							<Flex align="center" gap={2} mb={1}>
								<Text fontSize="xs" fontWeight={600} color={PAGE_COLORS.muted}>
									{t('components.buyingInvoices.extract.supplierInvoiceNumber')}
								</Text>
								<ConfidenceMark
									review={draft.extraction?.invoiceNumber}
									onConfirm={() => confirmHeaderReview('invoiceNumber')}
								/>
							</Flex>
							<Input
								value={draft.supplierInvoiceNumber ?? ''}
								onChange={event =>
									setDraft(current => ({
										...current,
										supplierInvoiceNumber: event.target.value,
										extraction: current.extraction
											? {
													...current.extraction,
													invoiceNumber: reviewAfterEdit(
														current.extraction.invoiceNumber,
													),
												}
											: current.extraction,
									}))
								}
								placeholder={t(
									'components.buyingInvoices.extract.supplierInvoiceNumber',
								)}
								isDisabled={isReadOnly}
								borderRadius="none"
								borderColor={PAGE_COLORS.border}
							/>
						</Box>
					</Grid>

					<Box>
						<Text
							fontSize="xs"
							fontWeight={600}
							color={PAGE_COLORS.muted}
							mb={2}
						>
							{t('components.buyingInvoices.drawer.paymentType')}
						</Text>
						<HStack spacing={2}>
							<PaymentTypeButton
								type={InvoicePaymentType.CASH}
								label={t('components.buyingInvoices.paymentType.cash')}
								icon={<AsDollarSignIcon fill="none" />}
								isActive={draft.paymentType === InvoicePaymentType.CASH}
								isDisabled={isReadOnly}
								onClick={handlePaymentTypeChange}
							/>
							<PaymentTypeButton
								type={InvoicePaymentType.CREDIT}
								label={t('components.buyingInvoices.paymentType.credit')}
								icon={<AsPriceTagIcon fill="none" />}
								isActive={draft.paymentType === InvoicePaymentType.CREDIT}
								isDisabled={isReadOnly}
								onClick={handlePaymentTypeChange}
							/>
						</HStack>
					</Box>

					{!isReadOnly && (
						<Box>
							<InvoiceProductSearch
								onAddProduct={product => {
									handleAddProduct(
										product,
										findProductLineIdRef.current ?? undefined,
									)
									findProductLineIdRef.current = null
								}}
								initialSearch={initialProductSearch}
								autoFocus={isActive}
								focusNonce={searchFocusNonce}
							/>
						</Box>
					)}

					<InvoiceLineItemsTable
						lineItems={draft.lineItems}
						onUpdateItem={handleUpdateItem}
						onRemoveItem={handleRemoveItem}
						formatAmount={formatAmount}
						displayCurrencyId={displayCurrencyId}
						currencyOptions={displayCurrencyOptions}
						isReadOnly={isReadOnly}
						invoiceKind="buying"
						extractionLines={draft.extraction?.lines}
						onConfirmLineField={(lineId, field) =>
							setDraft(current => {
								const line = current.extraction?.lines[lineId]
								if (!current.extraction || !line) return current
								return {
									...current,
									extraction: {
										...current.extraction,
										lines: {
											...current.extraction.lines,
											[lineId]: {
												...line,
												[field]: confirmReview(line[field]),
											},
										},
									},
								}
							})
						}
						productCaption={item => {
							const match = draft.extraction?.lineMatches?.[item.id]
							if (!match) return null
							return (
								<MatchBanner
									kind="product"
									match={match}
									isReadOnly={isReadOnly}
									onConfirm={() => {
										if (!match.id) return
										const product =
											products.find(
												catalog => catalog.productId === match.id,
											) ??
											({
												productId: match.id,
												name: match.name ?? item.name,
												price: { retailPrice: 0, currency: '' },
												status: 'active',
											} as Product)
										handleAddProduct(product, item.id)
									}}
									onCreate={() => setCreateProductLineId(item.id)}
									onFind={() => {
										findProductLineIdRef.current = item.id
										setSearchFocusNonce(nonce => nonce + 1)
									}}
								/>
							)
						}}
					/>

					{hasCurrencyOptions && (
						<Box maxW={{ base: '100%', md: '20rem' }}>
							<DropdownLabel
								label={t('components.buyingInvoices.drawer.displayCurrency')}
								options={displayCurrencyOptions.map(option => ({
									label: `${option.name} (${option.label})`,
									value: option.currencyId,
								}))}
								selectedOptions={
									displayCurrencyId
										? displayCurrencyOptions
												.filter(
													option => option.currencyId === displayCurrencyId,
												)
												.map(option => ({
													label: `${option.name} (${option.label})`,
													value: option.currencyId,
												}))
										: []
								}
								onSelect={values => setDisplayCurrencyId(values[0] ?? null)}
								placeholder={t(
									'components.buyingInvoices.drawer.displayCurrency',
								)}
								isSingle
								isSearchable={false}
								customStyles={{
									dropdownContainer: { width: '100%' },
									dropdownMenu: {
										mt: '0.4rem',
										borderRadius: 'none',
										width: '100%',
									},
									dropdownPlaceholder: { width: '100%' },
								}}
							/>
						</Box>
					)}

					<Grid
						templateColumns={{ base: '1fr', lg: '1.2fr 1fr 1fr' }}
						gap={4}
						mt="auto"
						pt={2}
					>
						<Box>
							{showNote ? (
								<Button
									variant="link"
									color={PAGE_COLORS.primary}
									fontWeight={600}
									fontSize="sm"
									onClick={() => setShowNote(true)}
								>
									{t('components.buyingInvoices.drawer.addNote')}
								</Button>
							) : (
								<VStack align="stretch" spacing={2}>
									<Text fontSize="sm" fontWeight={600} color="gray.700">
										{t('components.buyingInvoices.drawer.additionalInfo')}
									</Text>
									<Textarea
										value={draft.note}
										onChange={event =>
											setDraft(current => ({
												...current,
												note: event.target.value,
											}))
										}
										placeholder={t(
											'components.buyingInvoices.drawer.notePlaceholder',
										)}
										borderRadius="lg"
										borderColor={PAGE_COLORS.border}
										rows={3}
									/>
								</VStack>
							)}
						</Box>

						<Box
							bg="gray.50"
							borderRadius="lg"
							p={4}
							border="1px solid"
							borderColor={PAGE_COLORS.border}
						>
							<VStack align="stretch" spacing={2}>
								<Flex justify="space-between">
									<Text fontSize="sm" color={PAGE_COLORS.muted}>
										{t('components.buyingInvoices.drawer.subtotal')}
									</Text>
									<CurrencyAmountTooltip
										amount={totals.subtotal}
										displayText={formatAmount(totals.subtotal)}
										options={displayCurrencyOptions}
										displayCurrencyId={displayCurrencyId}
										fontWeight={500}
									/>
								</Flex>
								<Flex justify="space-between">
									<Text fontSize="sm" color={PAGE_COLORS.muted}>
										{t('components.buyingInvoices.drawer.discount')}
									</Text>
									{isReadOnly ? (
										<CurrencyAmountTooltip
											amount={totals.discount}
											displayText={formatAmount(totals.discount)}
											options={displayCurrencyOptions}
											displayCurrencyId={displayCurrencyId}
											fontWeight={500}
										/>
									) : (
										<EditableDiscountField
											discount={
												draft.useInvoiceDiscount
													? draft.invoiceDiscount
													: totals.discount
											}
											discountIsPercent={
												draft.useInvoiceDiscount
													? draft.invoiceDiscountIsPercent
													: false
											}
											discountAmount={totals.discount}
											formatAmount={formatAmount}
											fontWeight={500}
											currencyOptions={displayCurrencyOptions}
											displayCurrencyId={displayCurrencyId}
											onSave={handleInvoiceDiscountEdit}
										/>
									)}
								</Flex>
								<Flex justify="space-between" align="center">
									<HStack spacing={1}>
										<Text fontSize="sm" color={PAGE_COLORS.muted}>
											{t('components.buyingInvoices.drawer.tax')}
										</Text>
										<ConfidenceMark
											review={draft.extraction?.vat}
											onConfirm={() => confirmHeaderReview('vat')}
										/>
									</HStack>
									<Text fontSize="sm" fontWeight={500}>
										{typeof draft.extraction?.vat.value === 'number'
											? formatAmount(draft.extraction.vat.value)
											: formatAmount(totals.tax)}
									</Text>
								</Flex>
								<Box
									borderTop="1px solid"
									borderColor={PAGE_COLORS.border}
									pt={2}
								>
									<Flex justify="space-between" align="center">
										<HStack spacing={1}>
											<Text fontWeight={700}>
												{t('components.buyingInvoices.drawer.grandTotal')}
											</Text>
											<ConfidenceMark
												review={draft.extraction?.total}
												onConfirm={() => confirmHeaderReview('total')}
											/>
										</HStack>
										<CurrencyAmountTooltip
											amount={totals.grandTotal}
											displayText={formatAmount(totals.grandTotal)}
											options={displayCurrencyOptions}
											displayCurrencyId={displayCurrencyId}
											fontSize="2xl"
											fontWeight={700}
											color={PAGE_COLORS.primary}
										/>
									</Flex>
								</Box>
							</VStack>
						</Box>

						<Box
							bg="gray.50"
							borderRadius="lg"
							p={4}
							border="1px solid"
							borderColor={PAGE_COLORS.border}
						>
							<VStack align="stretch" spacing={3}>
								<Box>
									<Text
										fontSize="xs"
										fontWeight={600}
										color={PAGE_COLORS.muted}
										mb={1}
									>
										{t('components.buyingInvoices.drawer.paidAmount')}
									</Text>
									<CurrencyAmountTooltip
										amount={draft.paidAmount}
										displayText={formatAmount(draft.paidAmount)}
										options={displayCurrencyOptions}
										displayCurrencyId={displayCurrencyId}
										fontSize="xl"
										fontWeight={700}
										onEdit={
											draft.paymentType === InvoicePaymentType.CREDIT
												? undefined
												: paidAmount =>
														setDraft(current => ({
															...current,
															paidAmount,
														}))
										}
									/>
								</Box>
								<Box>
									<Text
										fontSize="xs"
										fontWeight={600}
										color={PAGE_COLORS.muted}
										mb={1}
									>
										{t('components.buyingInvoices.drawer.change')}
									</Text>
									<CurrencyAmountTooltip
										amount={changeAmount}
										displayText={formatAmount(changeAmount)}
										options={displayCurrencyOptions}
										displayCurrencyId={displayCurrencyId}
										fontSize="xl"
										fontWeight={700}
										color={PAGE_COLORS.success}
									/>
								</Box>
							</VStack>
						</Box>
					</Grid>

					{draft.extraction && draftHasUnresolvedExtraction(draft) && (
						<Text fontSize="sm" color={PAGE_COLORS.warning}>
							{t('components.buyingInvoices.extract.unresolved')}
						</Text>
					)}
					{saveError && (
						<Text fontSize="sm" color={PAGE_COLORS.danger}>
							{saveError}
						</Text>
					)}

					{!isReadOnly && (
						<Flex
							gap={3}
							pt={2}
							pb={1}
							direction={{ base: 'column', sm: 'row' }}
							flexShrink={0}
						>
							{isAiImport ? (
								<Button
									rightIcon={
										<Icon
											as={AsSaveIcon}
											fill="none"
											color={PAGE_COLORS.cardShadow}
											boxSize={5}
										/>
									}
									bg={PAGE_COLORS.primary}
									color="white"
									borderRadius="lg"
									fontWeight={600}
									flex={1}
									_hover={{ bg: '#1D4ED8' }}
									isDisabled={!canSave}
									isLoading={isSaving}
									onClick={() => {
										if (draft.paymentType === InvoicePaymentType.CREDIT) {
											handleSaveInvoice(InvoiceStatus.CONFIRMED)
											return
										}
										handleSaveInvoice(
											draft.paidAmount + 0.009 >= totals.grandTotal
												? InvoiceStatus.PAID
												: InvoiceStatus.PARTIAL,
										)
									}}
								>
									{t('components.buyingInvoices.extract.approve')}
								</Button>
							) : (
								<>
									<Button
										variant="outline"
										leftIcon={
											<Icon
												as={AsDocumentIcon}
												color={PAGE_COLORS.primary}
												boxSize={5}
											/>
										}
										borderRadius="lg"
										borderColor={PAGE_COLORS.border}
										flex={{ base: 1, sm: 'none' }}
										onClick={() => handleSaveInvoice(InvoiceStatus.DRAFT)}
										isLoading={isSaving}
										isDisabled={!canSave}
									>
										{t('components.buyingInvoices.drawer.saveDraft')}
									</Button>
									<Button
										variant="outline"
										leftIcon={
											<Icon
												as={AsPauseIcon}
												color={PAGE_COLORS.primary}
												boxSize={5}
											/>
										}
										borderRadius="lg"
										borderColor={PAGE_COLORS.border}
										flex={{ base: 1, sm: 'none' }}
										onClick={() => handleSaveInvoice(InvoiceStatus.DRAFT)}
										isLoading={isSaving}
										isDisabled={!canSave}
									>
										{t('components.buyingInvoices.drawer.holdInvoice')}
									</Button>
									<HStack spacing={0} flex={1}>
										<Menu>
											<MenuButton
												as={Button}
												bg={PAGE_COLORS.primary}
												color="white"
												borderTopLeftRadius={0}
												borderBottomLeftRadius={0}
												borderTopRightRadius="lg"
												borderBottomRightRadius="lg"
												minW="auto"
												px={2}
												borderLeft="1px solid"
												borderColor="#1D4ED8"
												_hover={{ bg: '#1D4ED8' }}
												isDisabled={!canSave}
											>
												<ChevronDownIcon />
											</MenuButton>
											<MenuList>
												<MenuItem
													onClick={() => handleSaveInvoice(InvoiceStatus.DRAFT)}
												>
													{t('components.buyingInvoices.drawer.saveDraft')}
												</MenuItem>
												<MenuItem
													onClick={() => handleSaveInvoice(InvoiceStatus.DRAFT)}
												>
													{t('components.buyingInvoices.drawer.holdInvoice')}
												</MenuItem>
											</MenuList>
										</Menu>
										<Button
											rightIcon={
												<Icon
													as={AsSaveIcon}
													fill="none"
													color={PAGE_COLORS.cardShadow}
													boxSize={5}
												/>
											}
											bg={PAGE_COLORS.primary}
											color="white"
											borderTopLeftRadius="lg"
											borderBottomLeftRadius="lg"
											borderTopRightRadius={0}
											borderBottomRightRadius={0}
											fontWeight={600}
											flex={1}
											_hover={{ bg: '#1D4ED8' }}
											isDisabled={!canSave}
											isLoading={isSaving}
											onClick={() => {
												if (draft.paymentType === InvoicePaymentType.CREDIT) {
													handleSaveInvoice(InvoiceStatus.CONFIRMED)
													return
												}

												handleSaveInvoice(
													draft.paidAmount + 0.009 >= totals.grandTotal
														? InvoiceStatus.PAID
														: InvoiceStatus.PARTIAL,
												)
											}}
										>
											{draft.paymentType === InvoicePaymentType.CASH
												? t('components.buyingInvoices.drawer.payCashAndSave')
												: t(
														'components.buyingInvoices.drawer.saveCreditInvoice',
													)}
										</Button>
									</HStack>
								</>
							)}
						</Flex>
					)}
				</Box>
			</Box>
			<AddProductModal
				isOpen={createProductLineId != null}
				onClose={() => setCreateProductLineId(null)}
				barcode={
					draft.lineItems.find(item => item.id === createProductLineId)
						?.barcode ?? ''
				}
				initialName={
					draft.lineItems.find(item => item.id === createProductLineId)?.name
				}
				initialPurchasePrice={
					draft.lineItems.find(item => item.id === createProductLineId)
						?.unitPrice || undefined
				}
				onCreated={async productId => {
					const lineId = createProductLineId
					const line = draft.lineItems.find(item => item.id === lineId)
					setCreateProductLineId(null)
					await refetchCatalog()
					const product = getProductCatalogState().products.find(
						item => item.productId === productId,
					)
					if (!lineId) return
					handleAddProduct(
						product ??
							({
								productId,
								name: line?.name ?? '',
								barcode: line?.barcode,
								price: {
									retailPrice: 0,
									purchasePrice: line?.unitPrice,
									currency: '',
								},
								status: 'active',
							} as Product),
						lineId,
					)
				}}
			/>
			<Modal
				isOpen={createSupplierName != null}
				onClose={() => setCreateSupplierName(null)}
				isCentered
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						{t('components.buyingInvoices.extract.match.createSupplier')}
					</ModalHeader>
					<ModalBody>
						<Input
							value={createSupplierName ?? ''}
							onChange={event => setCreateSupplierName(event.target.value)}
							placeholder={t('components.buyingInvoices.drawer.supplier')}
						/>
					</ModalBody>
					<ModalFooter>
						<Button
							variant="ghost"
							mr={3}
							onClick={() => setCreateSupplierName(null)}
						>
							{t('common.cancel')}
						</Button>
						<Button
							colorScheme="blue"
							isLoading={isCreatingSupplier}
							isDisabled={!(createSupplierName ?? '').trim()}
							onClick={async () => {
								const name = (createSupplierName ?? '').trim()
								if (!name) return
								const created = await createSupplier({ name }).unwrap()
								setCreateSupplierName(null)
								const supplierId = created.supplierId ?? created._id
								if (supplierId) handleSupplierChange(supplierId, name)
							}}
						>
							{t('components.buyingInvoices.extract.match.createSupplier')}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	)
}

export default NewBuyingInvoicePanel
