import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Spinner,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import React, { useState } from 'react'
import CustomBreadcrumb from '../CustomBreadcrumb'
import {
	AddQuickStateEnum,
	BreadCrumbItem,
	TargetType,
} from '../../shared/globalEnums'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { generateBreadcrumbs } from '../../shared/routes'
import { AddSquareIcon } from '../icons/AddSquare'
import { useTranslation } from 'react-i18next'
import useAllowedActions from '../../shared/hooks/useAllowedActions'
import SupplierListWithActionBar from './list/SupplierListWithActionBar'
import {
	useCreateSupplierMutation,
	useGetSuppliersQuery,
} from '../../api/apiStore'
import AddQuickModal from '../modals/AddQuickModal'
import useCustomToast from '../common/CustomToast'

const fullWidth = '100%'

const styles = {
	wrapper: {
		width: fullWidth,
		flexDir: 'column',
		paddingBottom: '1rem',
	},
	header: {
		flexDir: 'column',
		width: fullWidth,
		paddingX: '1rem',
	},
	title: {
		fontSize: '1.5rem',
		fontWeight: 700,
		marginTop: '0.4rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		display: 'block',
		whiteSpace: 'nowrap',
		paddingX: '1rem',
	},
	divider: {
		borderBottom: '1px solid #EAEAEA}',
		marginTop: '1px',
		marginRight: {
			base: '0',
			md: '0.5rem',
			xl: '0.5rem',
		},
	},
	addProductButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addProductButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
} satisfies StylesObject

interface SupplierPageProps {
	targetType: TargetType
}
type FormData = {
	code: string
	value: string
}
const SupplierPage = ({ targetType }: SupplierPageProps) => {
	const [formData, setFormData] = useState<FormData>({
		code: '',
		value: '',
	})
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { canAddSupplier } = useAllowedActions()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({})
	const [createSupplier, { isLoading: isSupplierLoading }] =
		useCreateSupplierMutation()
	const showToast = useCustomToast()

	const handleInputChange = (field: 'value' | 'code', value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const handlePostNewSupplier = async (data: FormData) => {
		try {
			await createSupplier({
				name: data.value,
				internalCode: data.code,
			}).unwrap()
			setFormData({ code: '', value: '' })
			onClose()
			showToast({
				title: t('components.daily.addSuccess'),
				status: 'success',
			})
		} catch {
			showToast({
				title: t('components.daily.errors.addSupplierFailed'),
				status: 'error',
			})
		}
	}
	const nextInternalCode =
		'CZ' +
		String(
			Math.max(
				...suppliers.map(
					supplier => parseInt(supplier.internalCode?.slice(2) ?? '0', 10),
					10,
				),
			) + 1,
		).padStart(3, '0')
	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.SUPPLIERS]}
				/>
			</Flex>

			<HStack
				justify="space-between"
				mb={{ base: '1.5rem', md: '4rem' }}
				flexWrap={{ base: 'wrap', md: 'nowrap' }}
				gap={{ base: 3, md: 0 }}
			>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.suppliers')}
				</Heading>
				{canAddSupplier && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={onOpen}
						sx={styles.addProductButton}
						variant="ghost"
					>
						<Text sx={styles.addProductButtonText}>
							{t('common.addSupplier')}
						</Text>
					</Button>
				)}
			</HStack>

			{isSuppliersLoading && <Spinner />}
			<Box sx={styles.divider} />

			<SupplierListWithActionBar
				suppliers={suppliers as Supplier[]}
				isLoading={isSuppliersLoading}
				targetType={targetType}
			/>

			<AddQuickModal
				handleInputChange={handleInputChange}
				isOpen={isOpen}
				modalType={AddQuickStateEnum.SUPPLIER}
				onClose={onClose}
				isLoading={isSupplierLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handlePostNewSupplier}
				userHasAdminRole={canAddSupplier}
				nextInternalCode={nextInternalCode}
			/>
		</Flex>
	)
}

export default SupplierPage
