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
import {
	BreadCrumbItem,
	TargetType,
	AddQuickStateEnum,
} from '../../shared/globalEnums'
import CustomBreadcrumb from '../CustomBreadcrumb'
import PartnerListWithActionBar from './list/PartnerListWithActionBar'
import {
	useCreatePartnerMutation,
	useGetPartnersQuery,
} from '../../api/apiStore'
import AddQuickModal from '../modals/AddQuickModal'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'

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
interface PartnerPageProps {
	targetType: TargetType
}
type FormData = {
	code: string
	value: string
}

const PartnerPage = (_targetType: PartnerPageProps) => {
	const [formData, setFormData] = useState<FormData>({
		code: '',
		value: '',
	})
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()

	const { data: partnersResponse = [], isLoading: isPartnersLoading } =
		useGetPartnersQuery({})
	const [createPartner, { isLoading: isPartnerLoading }] =
		useCreatePartnerMutation()
	const partners = useMemo(() => partnersResponse ?? [], [partnersResponse])

	const handleInputChange = (field: 'value' | 'code', value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}
	const handlePostNewPartner = async (data: FormData) => {
		await createPartner({
			name: data.value,
			internalCode: data.code,
		}).unwrap()
		setFormData({ code: '', value: '' })
		onClose()
	}
	const nextInternalCode =
		'CZ' +
		String(
			Math.max(
				...partners.map(p => parseInt(p.internalCode?.slice(2) ?? '0', 10), 10),
			) + 1,
		).padStart(3, '0')

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.PARTNERS]}
				/>
			</Flex>

			<HStack
				justify="space-between"
				mb={{ base: '1.5rem', md: '4rem' }}
				flexWrap={{ base: 'wrap', md: 'nowrap' }}
				gap={{ base: 3, md: 0 }}
			>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.partners')}
				</Heading>
				{canSee(SEE.partnersAdd) && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={onOpen}
						sx={styles.addProductButton}
						variant="ghost"
					>
						<Text sx={styles.addProductButtonText}>
							{t('common.addPartner')}
						</Text>
					</Button>
				)}
			</HStack>

			{isPartnersLoading && <Spinner />}
			<Box sx={styles.divider} />

			<PartnerListWithActionBar
				partners={partners as Partner[]}
				isLoading={isPartnersLoading}
			/>

			<AddQuickModal
				nextInternalCode={nextInternalCode}
				handleInputChange={handleInputChange}
				isOpen={isOpen}
				modalType={AddQuickStateEnum.PARTNER}
				onClose={onClose}
				isLoading={isPartnerLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handlePostNewPartner}
				userHasAdminRole={canSee(SEE.partnersAdd)}
			/>
		</Flex>
	)
}

export default PartnerPage
