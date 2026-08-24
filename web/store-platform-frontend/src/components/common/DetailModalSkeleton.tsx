import { Flex, Skeleton } from '@chakra-ui/react'
import { CloseButton } from './CloseButton'
import { compareBreakpoint, compareTargetType } from '../../shared/utils'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'
import { TargetType } from '../../shared/globalEnums'

const skeletonStyles = {
	wrapper: {
		gridColumn: '1 / span 12',
		marginTop: '2rem',
		width: '100%',
		flexDir: 'column',
		gap: '1rem',
	},
	titleRow: {
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		width: '100%',
		gap: '0.75rem',
	},
	titleBlock: {
		flexDir: 'column',
		gap: '0.5rem',
		flex: 1,
	},
	factsRow: {
		width: '100%',
		flexDir: { base: 'column', md: 'row' },
		gap: '1rem',
		pt: '0.5rem',
	},
} satisfies StylesObject

interface DetailModalSkeletonProps {
	onClose: () => void
	targetType: TargetType
}

const DetailModalSkeleton = ({
	onClose,
	targetType,
}: DetailModalSkeletonProps) => {
	const { isPartnerTarget } = compareTargetType(targetType)
	const { isMobile } = compareBreakpoint(useBreakpoints())

	return (
		<Flex sx={skeletonStyles.wrapper}>
			{!isMobile && <Skeleton width="15rem" height="1rem" />}
			<Flex sx={skeletonStyles.titleRow}>
				<Flex sx={skeletonStyles.titleBlock}>
					<Skeleton width={isMobile ? '70%' : '16rem'} height="1.5rem" />
					<Skeleton width={isMobile ? '50%' : '12rem'} height="0.875rem" />
				</Flex>
				<CloseButton onClose={onClose} />
			</Flex>
			{!isPartnerTarget && (
				<Flex sx={skeletonStyles.factsRow}>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton
							key={index}
							width={{ base: '100%', md: '10rem' }}
							height="2.5rem"
							flex="1"
						/>
					))}
				</Flex>
			)}
		</Flex>
	)
}

export default DetailModalSkeleton
