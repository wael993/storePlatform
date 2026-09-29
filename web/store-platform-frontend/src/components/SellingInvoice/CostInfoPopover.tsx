import {
	Icon,
	IconButton,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Portal,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { AsWarningIcon } from '../../icons/Warning'
import { PAGE_COLORS } from './constants'

interface CostInfoPopoverProps {
	averageBuying: string
	lastBuying: string
	lastSelling: string
}

const CostInfoPopover = ({
	averageBuying,
	lastBuying,
	lastSelling,
}: CostInfoPopoverProps) => {
	const { t } = useTranslation()

	return (
		<Popover placement="top" returnFocusOnClose={false}>
			<PopoverTrigger>
				<IconButton
					size="xs"
					variant="ghost"
					aria-label={t('components.sellingInvoices.drawer.productCostInfo')}
					icon={
						<Icon
							as={AsWarningIcon}
							color={PAGE_COLORS.cardShadow}
							boxSize={4}
						/>
					}
					onClick={e => e.stopPropagation()}
				/>
			</PopoverTrigger>
			<Portal>
				<PopoverContent w="auto" maxW="16rem">
					<PopoverBody>
						<VStack align="stretch" spacing={1}>
							<Text fontSize="xs" fontWeight={700} color={PAGE_COLORS.muted}>
								{t('components.sellingInvoices.drawer.productCostInfo')}
							</Text>
							<Text fontSize="sm" whiteSpace="nowrap">
								{t('components.sellingInvoices.drawer.lastBuying')}: {lastBuying}
							</Text>
							<Text fontSize="sm" whiteSpace="nowrap">
								{t('components.sellingInvoices.drawer.averageBuying')}:{' '}
								{averageBuying}
							</Text>
							<Text fontSize="sm" whiteSpace="nowrap">
								{t('components.sellingInvoices.drawer.lastSelling')}:{' '}
								{lastSelling}
							</Text>
						</VStack>
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	)
}

export default CostInfoPopover
