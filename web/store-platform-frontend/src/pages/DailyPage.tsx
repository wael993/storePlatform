import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Text,
	useDisclosure,
} from '@chakra-ui/icons'
import React from 'react'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { AllowedActions, BreadCrumbItem } from '../shared/globalEnums'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import { generateBreadcrumbs } from '../shared/routes'
import { AddSquareIcon } from '../icons/AddSquare'
import { useTranslation } from 'react-i18next'
import { useResources } from '../shared/hooks/useResources'
import { useUser } from '../shared/hooks/useUser'
import ListWithActionBar from '../components/list/ListWithActionBar'
import { useGetDailyActionsQuery } from '../api/apiStore'
import AddDailyActionModal from '../components/modals/DailyAction/AddDailyActionModal'

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
const DailyPage = () => {
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { isActionAllowed } = useResources()
	const { isOwnerOrAdmin } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()

	const {
		data: dailyActionsResponse,
		isLoading: isDailyActionsLoading,
		isFetching: isDailyActionsFetching,
	} = useGetDailyActionsQuery()
	console.log('🚀 ~ DailyPage ~ dailyActionsResponse:', dailyActionsResponse)

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.DAILY]}
				/>
			</Flex>

			<HStack justify="space-between" mb={'4rem'}>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.daily')}
				</Heading>
				{isActionAllowed(AllowedActions.SEE_DAILY_ACTION) && isOwnerOrAdmin && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={onOpen}
						sx={styles.addProductButton}
						variant="ghost"
					>
						<Text sx={styles.addProductButtonText}>
							{t('common.addDailyAction')}
						</Text>
					</Button>
				)}
			</HStack>
			<Box sx={styles.divider} />
			{/* <ListWithActionBar
				products={dailyActionsResponse as DailyActionsAPIResponse[]}
				isLoading={isDailyActionsLoading || isDailyActionsFetching}
			/> */}
			<AddDailyActionModal isOpen={isOpen} onClose={onClose} />
		</Flex>
	)
}

export default DailyPage
