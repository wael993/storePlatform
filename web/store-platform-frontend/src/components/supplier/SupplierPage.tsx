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
import React from 'react'
import CustomBreadcrumb from '../CustomBreadcrumb'
import {
	AllowedActions,
	BreadCrumbItem,
	TargetType,
} from '../../shared/globalEnums'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { generateBreadcrumbs } from '../../shared/routes'
import { AddSquareIcon } from '../icons/AddSquare'
import { useTranslation } from 'react-i18next'
import { useResources } from '../../shared/hooks/useResources'
import { useUser } from '../../shared/hooks/useUser'
import AddDailyActionModal from '../modals/DailyAction/AddDailyActionModal'
import SupplierListWithActionBar from './list/SupplierListWithActionBar'
import { useGetSuppliersQuery } from '../../api/apiStore'

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
		borderBottom: `1px solid #EAEAEA}`,
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

const SupplierPage = ({ targetType }: SupplierPageProps) => {
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { isActionAllowed } = useResources()
	const { isOwnerOrAdmin } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({})

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.SUPPLIERS]}
				/>
			</Flex>

			<HStack justify="space-between" mb={'4rem'}>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.suppliers')}
				</Heading>
				{isActionAllowed(AllowedActions.CAN_ADD_SUPPLIER) && isOwnerOrAdmin && (
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

			<AddDailyActionModal
				isOpen={isOpen}
				onClose={onClose}
				targetType={targetType}
			/>
		</Flex>
	)
}

export default SupplierPage
