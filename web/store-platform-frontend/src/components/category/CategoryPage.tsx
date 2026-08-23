import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Text,
	Textarea,
	useDisclosure,
	VStack,
} from '@chakra-ui/react'
import React, { useMemo, useState } from 'react'
import { AddSquareIcon } from '../icons/AddSquare'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { generateBreadcrumbs } from '../../shared/routes'
import { BreadCrumbItem, TargetType } from '../../shared/globalEnums'
import CustomBreadcrumb from '../CustomBreadcrumb'
import CategoryListWithActionBar from './list/CategoryListWithActionBar'
import {
	useCreateCategoryMutation,
	useGetCategoriesQuery,
} from '../../api/apiStore'
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
	addButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
} satisfies StylesObject

interface CategoryPageProps {
	targetType: TargetType
}

type FormData = {
	name: string
	description: string
}

const CategoryPage = (_props: CategoryPageProps) => {
	const [formData, setFormData] = useState<FormData>({
		name: '',
		description: '',
	})
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()

	const { data: categoriesResponse = [], isLoading: isCategoriesLoading } =
		useGetCategoriesQuery()
	const [createCategory, { isLoading: isCategoryLoading }] =
		useCreateCategoryMutation()
	const categories = useMemo(
		() => categoriesResponse ?? [],
		[categoriesResponse],
	)

	const handlePostNewCategory = async () => {
		await createCategory({
			name: formData.name.trim(),
			description: formData.description.trim() || undefined,
		}).unwrap()
		setFormData({ name: '', description: '' })
		onClose()
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.CATEGORIES]}
				/>
			</Flex>

			<HStack
				justify="space-between"
				mb={{ base: '1.5rem', md: '4rem' }}
				flexWrap={{ base: 'wrap', md: 'nowrap' }}
				gap={{ base: 3, md: 0 }}
			>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.categories')}
				</Heading>
				{canSee(SEE.categoriesAdd) && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={onOpen}
						sx={styles.addButton}
						variant="ghost"
					>
						<Text sx={styles.addButtonText}>{t('common.addCategory')}</Text>
					</Button>
				)}
			</HStack>

			{isCategoriesLoading && <Spinner />}
			<Box sx={styles.divider} />

			<CategoryListWithActionBar
				categories={categories as Category[]}
				isLoading={isCategoriesLoading}
			/>

			<Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('common.addCategory')}</ModalHeader>
					<ModalCloseButton />
					<ModalBody pb={6}>
						<VStack align="stretch" spacing={4}>
							<Input
								placeholder={t('category.list.name')}
								value={formData.name}
								onChange={event =>
									setFormData(prev => ({ ...prev, name: event.target.value }))
								}
							/>
							<Textarea
								placeholder={t('category.list.description')}
								value={formData.description}
								onChange={event =>
									setFormData(prev => ({
										...prev,
										description: event.target.value,
									}))
								}
							/>
							<Button
								colorScheme="blue"
								isLoading={isCategoryLoading}
								isDisabled={!formData.name.trim()}
								onClick={handlePostNewCategory}
							>
								{t('common.save')}
							</Button>
						</VStack>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Flex>
	)
}

export default CategoryPage
