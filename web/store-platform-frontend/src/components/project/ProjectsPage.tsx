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
import { useMemo, useState } from 'react'
import { AddSquareIcon } from '../icons/AddSquare'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { generateBreadcrumbs } from '../../shared/routes'
import { AddQuickStateEnum, BreadCrumbItem } from '../../shared/globalEnums'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import CustomBreadcrumb from '../CustomBreadcrumb'
import ProjectListWithActionBar from './list/ProjectListWithActionBar'
import {
	useCreateProjectMutation,
	useGetProjectsQuery,
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

type FormData = {
	code: string
	value: string
}

const ProjectsPage = () => {
	const [formData, setFormData] = useState<FormData>({
		code: '',
		value: '',
	})
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canSeeProjects = canSee(SEE.projectsAdd)
	const { isOpen, onOpen, onClose } = useDisclosure()

	const { data: projectsResponse = [], isLoading: isProjectsLoading } =
		useGetProjectsQuery()
	const [createProject, { isLoading: isProjectLoading }] =
		useCreateProjectMutation()
	const showToast = useCustomToast()
	const projects = useMemo(() => projectsResponse ?? [], [projectsResponse])

	const handleInputChange = (field: 'value' | 'code', value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const nextInternalCode =
		'PJ' +
		String(
			Math.max(
				0,
				...projects.map(
					project => parseInt(project.internalCode?.slice(2) ?? '0', 10) || 0,
				),
			) + 1,
		).padStart(3, '0')

	const handlePostNewProject = async (data: FormData) => {
		const internalCode = (data.code.trim() || nextInternalCode).toUpperCase()
		try {
			await createProject({
				name: data.value.trim(),
				internalCode,
			}).unwrap()
			setFormData({ code: '', value: '' })
			onClose()
			showToast({
				title: t('components.daily.addSuccess'),
				status: 'success',
			})
		} catch {
			showToast({
				title: t('components.daily.errors.addProjectFailed'),
				status: 'error',
			})
		}
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.PROJECTS]}
				/>
			</Flex>

			<HStack
				justify="space-between"
				mb={{ base: '1.5rem', md: '4rem' }}
				flexWrap={{ base: 'wrap', md: 'nowrap' }}
				gap={{ base: 3, md: 0 }}
			>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.projects')}
				</Heading>
				{canSeeProjects && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={onOpen}
						sx={styles.addProductButton}
						variant="ghost"
					>
						<Text sx={styles.addProductButtonText}>
							{t('common.addProject')}
						</Text>
					</Button>
				)}
			</HStack>

			{isProjectsLoading && <Spinner />}
			<Box sx={styles.divider} />

			<ProjectListWithActionBar
				projects={projects}
				isLoading={isProjectsLoading}
			/>
			<AddQuickModal
				handleInputChange={handleInputChange}
				isOpen={isOpen}
				modalType={AddQuickStateEnum.PROJECT}
				onClose={onClose}
				isLoading={isProjectLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handlePostNewProject}
				userHasAdminRole={canSeeProjects}
				nextInternalCode={nextInternalCode}
				showInternalCodeLabel={false}
			/>
		</Flex>
	)
}

export default ProjectsPage
