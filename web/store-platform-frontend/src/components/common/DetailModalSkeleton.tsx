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
	},
	columnsFlexWrapper: {
		flexDir: 'column',
		width: '100%',
		gap: '2.5rem',
	},
	topSectionWrapper: {
		justifyContent: { base: 'flex-start', md: 'space-between' },
		width: '100%',
		alignItems: { base: 'flex-start', md: 'center' },
		flexDir: { base: 'column', md: 'row' },
		gap: '1.5rem',
	},
	bottomSectionWrapper: {
		width: '100%',
		flexDir: { base: 'column', md: 'row' },
		gap: '2.5rem',
		marginTop: '4rem',
	},
	leftSideSectionWrapper: {
		flexDir: 'column',
		gap: '1.5rem',
		width: { base: '100%', md: '50%' },
	},
	rightSideSectionWrapper: {
		flexDir: 'column',
		gap: '1.5rem',
		width: { base: '100%', md: '50%' },
		alignItems: { base: 'flex-start', md: 'center' },
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
	const { isCustomerTarget, isSupplierTarget, isPartnerTarget } =
		compareTargetType(targetType)
	const { isMobile } = compareBreakpoint(useBreakpoints())

	return (
		<Flex sx={skeletonStyles.wrapper}>
			<Flex sx={skeletonStyles.columnsFlexWrapper}>
				<Flex sx={skeletonStyles.topSectionWrapper}>
					<Flex flexDir="column" gap="1.5rem">
						{!isMobile && (
							<Skeleton width={'15rem'} height="1rem" color={'red'} />
						)}
						<Skeleton width={isMobile ? '100vw' : '10rem'} height="1rem" />
						<Skeleton width={isMobile ? '80vw' : '15rem'} height="1rem" />
					</Flex>
					<Flex gap="1rem" alignItems="center">
						<Skeleton width={isMobile ? '25vw' : '5rem'} height="2rem" />
						<Skeleton width={isMobile ? '25vw' : '5rem'} height="2rem" />
						<Skeleton width={isMobile ? '10vw' : '2rem'} height="1rem" />
						<Skeleton width={isMobile ? '10vw' : '2rem'} height="1rem" />
						<CloseButton onClose={onClose} />
					</Flex>
				</Flex>
				<Flex gap="2rem" flexDir={{ base: 'column', md: 'row' }}>
					{Array.from({ length: 5 }).map((_, index) => (
						<Skeleton
							key={index}
							width={{ base: '100%', md: '20%' }}
							height="3rem"
						/>
					))}
				</Flex>
				{isCustomerTarget && (
					<Flex gap="2rem" flexDir={{ base: 'column', md: 'row' }}>
						{Array.from({ length: 5 }).map((_, index) => (
							<Skeleton
								key={index}
								width={{ base: '100%', md: '20%' }}
								height="3rem"
							/>
						))}
					</Flex>
				)}
				{(isSupplierTarget || isPartnerTarget) && (
					<Skeleton width="30%" height="10rem" />
				)}

				<Flex sx={skeletonStyles.bottomSectionWrapper}>
					<Flex sx={skeletonStyles.leftSideSectionWrapper}>
						{Array.from({ length: 5 }).map((_, index) => (
							<Skeleton
								key={index}
								width={isMobile ? '100%' : '80%'}
								height="1.5rem"
							/>
						))}
					</Flex>
					<Flex sx={skeletonStyles.rightSideSectionWrapper}>
						{Array.from({ length: 5 }).map((_, index) => (
							<Skeleton
								key={index}
								width={isMobile ? '100%' : '80%'}
								height="1.5rem"
							/>
						))}
					</Flex>
				</Flex>
			</Flex>
		</Flex>
	)
}

export default DetailModalSkeleton
