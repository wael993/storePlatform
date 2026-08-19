import { useState } from 'react'
import {
	Button,
	Divider,
	Flex,
	FormControl,
	FormLabel,
	HStack,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import LabelTemplateEditor from './LabelTemplateEditor'
import useCustomToast from '../common/CustomToast'
import {
	useCreateLabelTemplateMutation,
	useDeleteLabelTemplateMutation,
	useDuplicateLabelTemplateMutation,
	useGetCurrencySettingsQuery,
	useGetInvoiceSettingsQuery,
	useGetLabelTemplatesQuery,
	useSetDefaultLabelTemplateMutation,
	useUpdateLabelTemplateMutation,
} from '../../api/apiStore'
import { formatLabelPrice, LabelTemplate } from '../../shared/labelTemplate'
import { RootState } from '../../store/store'
import { useUser } from '../../shared/hooks/useUser'

const LabelTemplatesSettings = () => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const { isOwnerOrAdmin } = useUser()
	const tenantName = useSelector(
		(state: RootState) => state.user.user?.tenantName ?? '',
	)
	const { data: invoiceSettings } = useGetInvoiceSettingsQuery()
	const { data: currencySettings } = useGetCurrencySettingsQuery()
	const { data } = useGetLabelTemplatesQuery()
	const [createTemplate, { isLoading: isCreating }] =
		useCreateLabelTemplateMutation()
	const [updateTemplate, { isLoading: isUpdating }] =
		useUpdateLabelTemplateMutation()
	const [deleteTemplate] = useDeleteLabelTemplateMutation()
	const [duplicateTemplate] = useDuplicateLabelTemplateMutation()
	const [setDefaultTemplate] = useSetDefaultLabelTemplateMutation()
	const [editor, setEditor] = useState<LabelTemplate | 'create' | null>(null)

	const templates = data?.templates ?? []
	const sampleCurrency =
		currencySettings?.primaryCurrency?.internalCode?.trim() ||
		currencySettings?.primaryCurrency?.name?.trim() ||
		''
	const sampleValues = {
		storeName: invoiceSettings?.displayName?.trim() || tenantName,
		storeLogo: invoiceSettings?.logoUrl ?? '',
		productName: 'Sample product',
		barcode: '001070002',
		barcodeValue: '001070002',
		price: formatLabelPrice(12, sampleCurrency),
		category: 'Sample category',
	}

	const fail = () =>
		showToast({
			status: 'error',
			description: t('settings.updateFailedMessage'),
		})

	return (
		<FormControl>
			<Divider
				sx={{
					my: 4,
					height: '0.2rem',
					border: 'none',
					backgroundColor: '#376288',
				}}
			/>
			<FormLabel fontWeight={600} mb={2}>
				{t('components.labelTemplates.title')}
			</FormLabel>
			<Text fontSize="sm" color="gray.600" mb={4}>
				{t('components.labelTemplates.description')}
			</Text>
			<VStack align="stretch" spacing={3}>
				{templates.map(template => (
					<Flex
						key={template.templateId}
						justify="space-between"
						align="center"
						gap={3}
						wrap="wrap"
						py={2}
					>
						<Text fontWeight={600}>
							{template.name}
							{template.isDefault
								? ` · ${t('components.labelTemplates.default')}`
								: ''}
						</Text>
						{isOwnerOrAdmin ? (
							<HStack spacing={2} wrap="wrap">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setEditor(template)}
									isDisabled={template.isProtected}
								>
									{t('components.labelTemplates.edit')}
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										void duplicateTemplate(template.templateId)
											.unwrap()
											.catch(fail)
									}
								>
									{t('components.labelTemplates.duplicate')}
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										void setDefaultTemplate(template.templateId)
											.unwrap()
											.catch(fail)
									}
									isDisabled={template.isDefault}
								>
									{t('components.labelTemplates.setDefault')}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										if (
											!window.confirm(
												t('components.labelTemplates.deleteConfirm'),
											)
										) {
											return
										}

										void deleteTemplate(template.templateId)
											.unwrap()
											.catch(fail)
									}}
									isDisabled={template.isProtected || template.isDefault}
								>
									{t('common.delete')}
								</Button>
							</HStack>
						) : null}
					</Flex>
				))}
				{isOwnerOrAdmin ? (
					<Button
						alignSelf="flex-start"
						onClick={() => setEditor('create')}
					>
						{t('components.labelTemplates.create')}
					</Button>
				) : null}
			</VStack>
			{editor ? (
				<LabelTemplateEditor
					template={editor === 'create' ? undefined : editor}
					values={sampleValues}
					isOpen
					isSaving={isCreating || isUpdating}
					onClose={() => setEditor(null)}
					onSave={async payload => {
						try {
							if (editor === 'create') {
								await createTemplate(payload).unwrap()
							} else {
								await updateTemplate({
									templateId: editor.templateId,
									...payload,
								}).unwrap()
							}

							setEditor(null)
						} catch {
							fail()
						}
					}}
				/>
			) : null}
		</FormControl>
	)
}

export default LabelTemplatesSettings
