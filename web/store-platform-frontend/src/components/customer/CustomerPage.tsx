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
import React, { useMemo, useState } from 'react'

import { AddSquareIcon } from '../icons/AddSquare'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { generateBreadcrumbs } from '../../shared/routes'
import { BreadCrumbItem, TargetType, AddQuickStateEnum } from '../../shared/globalEnums'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import CustomBreadcrumb from '../CustomBreadcrumb'
import CustomerListWithActionBar from './list/CustomerListWithActionBar'
import {
	useCreateCustomerMutation,
	useGetCustomersQuery,
} from '../../api/apiStore'
import AddQuickModal from '../modals/AddQuickModal'

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
interface CustomerPageProps {
	targetType: TargetType
}
type FormData = {
	code: string
	value: string
}
const CustomerPage = (_targetType: CustomerPageProps) => {
	const [formData, setFormData] = useState<FormData>({
		code: '',
		value: '',
	})
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()

	const { data: customersResponse = [], isLoading: isCustomersLoading } =
		useGetCustomersQuery()
	const [createCustomer, { isLoading: isCustomerLoading }] =
		useCreateCustomerMutation()
	const customers = useMemo(() => customersResponse ?? [], [customersResponse])

	const handleInputChange = (field: 'value' | 'code', value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const handlePostNewCustomer = async (data: FormData) => {
		await createCustomer({
			name: data.value,
			internalCode: data.code,
		}).unwrap()
		setFormData({ code: '', value: '' })
		onClose()
	}

	// const nextInternalCode = customers
	// 	.map(c => c.internalCode)
	// 	.sort(
	// 		(a, b) =>
	// 			parseInt(b?.slice(2) ?? '0', 10) - parseInt(a?.slice(2) ?? '0', 10),
	// 	)[0]

	const nextInternalCode =
		'CZ' +
		String(
			Math.max(
				...customers.map(
					c => parseInt(c.internalCode?.slice(2) ?? '0', 10),
					10,
				),
			) + 1,
		).padStart(3, '0')

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.CUSTOMERS]}
				/>
			</Flex>

			<HStack
				justify="space-between"
				mb={{ base: '1.5rem', md: '4rem' }}
				flexWrap={{ base: 'wrap', md: 'nowrap' }}
				gap={{ base: 3, md: 0 }}
			>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.customers')}
				</Heading>
				{canSee(SEE.customersAdd) && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={onOpen}
						sx={styles.addProductButton}
						variant="ghost"
					>
						<Text sx={styles.addProductButtonText}>
							{t('common.addCustomer')}
						</Text>
					</Button>
				)}
			</HStack>

			{isCustomersLoading && <Spinner />}
			<Box sx={styles.divider} />

			<CustomerListWithActionBar
				customers={customers as Customer[]}
				isLoading={isCustomersLoading}
			/>
			<AddQuickModal
				handleInputChange={handleInputChange}
				isOpen={isOpen}
				modalType={AddQuickStateEnum.CUSTOMER}
				onClose={onClose}
				isLoading={isCustomerLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handlePostNewCustomer}
				userHasAdminRole={canSee(SEE.customersAdd)}
				nextInternalCode={nextInternalCode}
			/>
		</Flex>
	)
}

export default CustomerPage
