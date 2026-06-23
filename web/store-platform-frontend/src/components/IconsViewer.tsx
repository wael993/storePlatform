import {
	Flex,
	Grid,
	Heading,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Text,
	VStack,
} from '@chakra-ui/react'
import type { ComponentType } from 'react'
import type { IconProps } from '@chakra-ui/react'

import { ActiveFlagIcon } from '../shared/icons/ActiveFlag'
import { AddSquareIcon } from '../shared/icons/AddSquare'
import { AlertCircleIcon } from '../shared/icons/Alert'
import { AlertNoteIcon } from '../shared/icons/AlertNote'
import { AnnouncementIcon } from '../shared/icons/Announcement'
import { ArrowBackIcon } from '../shared/icons/ArrowBack'
import { ArrowBackCircleIcon } from '../shared/icons/ArrowBackCircle'
import { ArrowDownIcon } from '../shared/icons/ArrowDown'
import { ArrowForwardIcon } from '../shared/icons/ArrowForward'
import { BatteryIcon } from '../shared/icons/Battery'
import { BellIcon } from '../shared/icons/Bell'
import { BellSlashedIcon } from '../shared/icons/BellSlashed'
import { BugIcon } from '../shared/icons/Bug'
import { BulbIcon } from '../shared/icons/Bulb'
import { CalculatorIcon } from '../shared/icons/Calculator'
import { CalendarIcon } from '../shared/icons/Calendar'
import { CalendarCertificateIcon } from '../shared/icons/CalendarCertificate'
import { CashflowIcon } from '../shared/icons/Cashflow'
import { ChangeIcon } from '../shared/icons/Change'
import { CheckmarkIcon } from '../shared/icons/Checkmark'
import { CheckmarkCircleIcon } from '../shared/icons/CheckmarkCircle'
import { CheckmarkToDosIcon } from '../shared/icons/CheckmarkToDos'
import { ChevronDownIcon } from '../shared/icons/ChevronDown'
import { ChevronLeftIcon } from '../shared/icons/ChevronLeftIcon'
import { ChevronRightIcon } from '../shared/icons/ChevronRight'
import { CircleMinusFilledIcon } from '../shared/icons/CircleMinusFilled'
import { CirclePlusIcon } from '../shared/icons/CirclePlus'
import { ClockIcon } from '../shared/icons/Clock'
import { CloseIcon } from '../shared/icons/Close'
import { CloseCircleIcon } from '../shared/icons/CloseIconCircle'
import { CloudCheckIcon } from '../shared/icons/CloudCheck'
import { CloudUploadIcon } from '../shared/icons/CloudUpload'
import { CollapseIcon } from '../shared/icons/Collapse'
import { CommentIcon } from '../shared/icons/Comment'
import { CrossedFileIcon } from '../shared/icons/CrossedFile'
import { CubeIcon } from '../shared/icons/Cube'
import { DislikeIcon } from '../shared/icons/Dislike'
import { DocumentIcon } from '../shared/icons/Document'
import { DocumentUploadedIcon } from '../shared/icons/DocumentUploaded'
import { DocumentWithTextIcon } from '../shared/icons/DocumentWithText'
import { DownloadIcon } from '../shared/icons/Download'
import { DragGripIcon } from '../shared/icons/DragGrip'
import { EditIcon } from '../shared/icons/Edit'
import { EmptyCheckmarkCircleIcon } from '../shared/icons/EmptyCheckmarkCircle'
import { EndDateIcon } from '../shared/icons/EndDate'
import { ExpandIcon } from '../shared/icons/Expand'
import { FilterIcon } from '../shared/icons/Filter'
import { FolderUpload } from '../shared/icons/FolderUpload'
import { GridIcon } from '../shared/icons/Grid'
import { ImageUploadIcon } from '../shared/icons/ImageUpload'
import { LayerGroupIcon } from '../shared/icons/LayerGroup'
import { LikeIcon } from '../shared/icons/Like'
import { LinkIcon } from '../shared/icons/Link'
import { LocationIcon } from '../shared/icons/Location'
import Logo from '../shared/icons/Logo'
import { MailIcon } from '../shared/icons/Mail'
import { MailSend } from '../shared/icons/MailSend'
import { NoteIcon } from '../shared/icons/Note'
import { OfferSlideArrowIcon } from '../shared/icons/OfferSlideArrow'
import { PersonIcon } from '../shared/icons/Person'
import { PriceTagIcon } from '../shared/icons/PriceTag'
import { PromoterCalendarIcon } from '../shared/icons/PromoterCalendar'
import { QuestionIcon } from '../shared/icons/QuestionIcon'
import { RemoveArrowIcon } from '../shared/icons/RemoveArrow'
import { RentIcon } from '../shared/icons/Rent'
import { Rotated45RightArrow } from '../shared/icons/Rotated45RightArrow'
import { SaveIcon } from '../shared/icons/Save'
import { SearchIcon } from '../shared/icons/Search'
import { SendIcon } from '../shared/icons/Send'
import { SettingsIcon } from '../shared/icons/Settings'
import { ShareIcon } from '../shared/icons/Share'
import { SortIcon } from '../shared/icons/Sort'
import { StarIcon } from '../shared/icons/Star'
import { StartDateIcon } from '../shared/icons/StartDate'
import { StoreIcon } from '../shared/icons/Store'
import { TargetIcon } from '../shared/icons/Target'
import { ThreeDotsIcon } from '../shared/icons/ThreeDots'
import { TimeIcon } from '../shared/icons/Time'
import { TrashIcon } from '../shared/icons/Trash'
import { TruckIcon } from '../shared/icons/Truck'
import { VacantAddSitesIcon } from '../shared/icons/VacantAddSites'
import { VacantAdvertising } from '../shared/icons/VacantAdvertising'
import { WarningIcon } from '../shared/icons/Warning'
import { WatcherEyeIcon } from '../shared/icons/WatcherEye'
import { WatcherEyeSlashedIcon } from '../shared/icons/WatcherEyeSlashed'
import { ZoomInIcon } from '../shared/icons/ZoomIn'
import { ZoomOutIcon } from '../shared/icons/ZoomOut'
import { ContributionPerBundleIcon } from '../shared/icons/price/ContributionPerBundleIcon'
import { PriceActivityFeeIcon } from '../shared/icons/price/PriceActivityFeeIcon'

interface IconsViewerProps {
	isOpen: boolean
	onClose: () => void
}

type IconItem = {
	name: string
	group: string
	Component: ComponentType<IconProps>
}

const generalIcons: IconItem[] = [
	{ name: 'ActiveFlagIcon', group: 'general', Component: ActiveFlagIcon },
	{ name: 'AddSquareIcon', group: 'general', Component: AddSquareIcon },
	{ name: 'AlertCircleIcon', group: 'general', Component: AlertCircleIcon },
	{ name: 'AlertNoteIcon', group: 'general', Component: AlertNoteIcon },
	{ name: 'AnnouncementIcon', group: 'general', Component: AnnouncementIcon },
	{ name: 'ArrowBackIcon', group: 'general', Component: ArrowBackIcon },
	{
		name: 'ArrowBackCircleIcon',
		group: 'general',
		Component: ArrowBackCircleIcon,
	},
	{ name: 'ArrowDownIcon', group: 'general', Component: ArrowDownIcon },
	{ name: 'ArrowForwardIcon', group: 'general', Component: ArrowForwardIcon },
	{ name: 'BatteryIcon', group: 'general', Component: BatteryIcon },
	{ name: 'BellIcon', group: 'general', Component: BellIcon },
	{ name: 'BellSlashedIcon', group: 'general', Component: BellSlashedIcon },
	{ name: 'BugIcon', group: 'general', Component: BugIcon },
	{ name: 'BulbIcon', group: 'general', Component: BulbIcon },
	{ name: 'CalculatorIcon', group: 'general', Component: CalculatorIcon },
	{ name: 'CalendarIcon', group: 'general', Component: CalendarIcon },
	{
		name: 'CalendarCertificateIcon',
		group: 'general',
		Component: CalendarCertificateIcon,
	},
	{ name: 'CashflowIcon', group: 'general', Component: CashflowIcon },
	{ name: 'ChangeIcon', group: 'general', Component: ChangeIcon },
	{ name: 'CheckmarkIcon', group: 'general', Component: CheckmarkIcon },
	{
		name: 'CheckmarkCircleIcon',
		group: 'general',
		Component: CheckmarkCircleIcon,
	},
	{
		name: 'CheckmarkToDosIcon',
		group: 'general',
		Component: CheckmarkToDosIcon,
	},
	{ name: 'ChevronDownIcon', group: 'general', Component: ChevronDownIcon },
	{ name: 'ChevronLeftIcon', group: 'general', Component: ChevronLeftIcon },
	{ name: 'ChevronRightIcon', group: 'general', Component: ChevronRightIcon },
	{
		name: 'CircleMinusFilledIcon',
		group: 'general',
		Component: CircleMinusFilledIcon,
	},
	{ name: 'CirclePlusIcon', group: 'general', Component: CirclePlusIcon },
	{ name: 'ClockIcon', group: 'general', Component: ClockIcon },
	{ name: 'CloseIcon', group: 'general', Component: CloseIcon },
	{ name: 'CloseCircleIcon', group: 'general', Component: CloseCircleIcon },
	{ name: 'CloudCheckIcon', group: 'general', Component: CloudCheckIcon },
	{ name: 'CloudUploadIcon', group: 'general', Component: CloudUploadIcon },
	{ name: 'CollapseIcon', group: 'general', Component: CollapseIcon },
	{ name: 'CommentIcon', group: 'general', Component: CommentIcon },
	{ name: 'CrossedFileIcon', group: 'general', Component: CrossedFileIcon },
	{ name: 'CubeIcon', group: 'general', Component: CubeIcon },
	{ name: 'DislikeIcon', group: 'general', Component: DislikeIcon },
	{ name: 'DocumentIcon', group: 'general', Component: DocumentIcon },
	{
		name: 'DocumentUploadedIcon',
		group: 'general',
		Component: DocumentUploadedIcon,
	},
	{
		name: 'DocumentWithTextIcon',
		group: 'general',
		Component: DocumentWithTextIcon,
	},
	{ name: 'DownloadIcon', group: 'general', Component: DownloadIcon },
	{ name: 'DragGripIcon', group: 'general', Component: DragGripIcon },
	{ name: 'EditIcon', group: 'general', Component: EditIcon },
	{
		name: 'EmptyCheckmarkCircleIcon',
		group: 'general',
		Component: EmptyCheckmarkCircleIcon,
	},
	{ name: 'EndDateIcon', group: 'general', Component: EndDateIcon },
	{ name: 'ExpandIcon', group: 'general', Component: ExpandIcon },
	{ name: 'FilterIcon', group: 'general', Component: FilterIcon },
	{ name: 'FolderUpload', group: 'general', Component: FolderUpload },
	{ name: 'GridIcon', group: 'general', Component: GridIcon },
	{ name: 'ImageUploadIcon', group: 'general', Component: ImageUploadIcon },
	{ name: 'LayerGroupIcon', group: 'general', Component: LayerGroupIcon },
	{ name: 'LikeIcon', group: 'general', Component: LikeIcon },
	{ name: 'LinkIcon', group: 'general', Component: LinkIcon },
	{ name: 'LocationIcon', group: 'general', Component: LocationIcon },
	{ name: 'Logo', group: 'general', Component: Logo },
	{ name: 'MailIcon', group: 'general', Component: MailIcon },
	{ name: 'MailSend', group: 'general', Component: MailSend },
	{ name: 'NoteIcon', group: 'general', Component: NoteIcon },
	{
		name: 'OfferSlideArrowIcon',
		group: 'general',
		Component: OfferSlideArrowIcon,
	},
	{ name: 'PersonIcon', group: 'general', Component: PersonIcon },
	{ name: 'PriceTagIcon', group: 'general', Component: PriceTagIcon },
	{
		name: 'PromoterCalendarIcon',
		group: 'general',
		Component: PromoterCalendarIcon,
	},
	{ name: 'QuestionIcon', group: 'general', Component: QuestionIcon },
	{ name: 'RemoveArrowIcon', group: 'general', Component: RemoveArrowIcon },
	{ name: 'RentIcon', group: 'general', Component: RentIcon },
	{
		name: 'Rotated45RightArrow',
		group: 'general',
		Component: Rotated45RightArrow,
	},
	{ name: 'SaveIcon', group: 'general', Component: SaveIcon },
	{ name: 'SearchIcon', group: 'general', Component: SearchIcon },
	{ name: 'SendIcon', group: 'general', Component: SendIcon },
	{ name: 'SettingsIcon', group: 'general', Component: SettingsIcon },
	{ name: 'ShareIcon', group: 'general', Component: ShareIcon },
	{ name: 'SortIcon', group: 'general', Component: SortIcon },
	{ name: 'StarIcon', group: 'general', Component: StarIcon },
	{ name: 'StartDateIcon', group: 'general', Component: StartDateIcon },
	{ name: 'StoreIcon', group: 'general', Component: StoreIcon },
	{ name: 'TargetIcon', group: 'general', Component: TargetIcon },
	{ name: 'ThreeDotsIcon', group: 'general', Component: ThreeDotsIcon },
	{ name: 'TimeIcon', group: 'general', Component: TimeIcon },
	{ name: 'TrashIcon', group: 'general', Component: TrashIcon },
	{ name: 'TruckIcon', group: 'general', Component: TruckIcon },
	{
		name: 'VacantAddSitesIcon',
		group: 'general',
		Component: VacantAddSitesIcon,
	},
	{
		name: 'VacantAdvertising',
		group: 'general',
		Component: VacantAdvertising,
	},
	{ name: 'WarningIcon', group: 'general', Component: WarningIcon },
	{ name: 'WatcherEyeIcon', group: 'general', Component: WatcherEyeIcon },
	{
		name: 'WatcherEyeSlashedIcon',
		group: 'general',
		Component: WatcherEyeSlashedIcon,
	},
	{ name: 'ZoomInIcon', group: 'general', Component: ZoomInIcon },
	{ name: 'ZoomOutIcon', group: 'general', Component: ZoomOutIcon },
]

const priceIcons: IconItem[] = [
	{
		name: 'ContributionPerBundleIcon',
		group: 'price',
		Component: ContributionPerBundleIcon,
	},
	{
		name: 'PriceActivityFeeIcon',
		group: 'price',
		Component: PriceActivityFeeIcon,
	},
]

const iconGroups = [
	{ label: 'General', icons: generalIcons },
	{ label: 'Price', icons: priceIcons },
]

const styles = {
	header: {
		borderBottom: '1px solid #EAEAEA',
	},
	title: {
		fontWeight: 700,
		fontSize: '1.25rem',
		color: '#1E1E1E',
	},
	subtitle: {
		fontSize: '0.875rem',
		color: '#929494',
		mt: 1,
	},
	groupHeading: {
		fontSize: '0.75rem',
		fontWeight: 700,
		textTransform: 'uppercase' as const,
		letterSpacing: '0.08em',
		color: '#376288',
		mb: 3,
	},
	iconCard: {
		bg: '#FFFFFF',
		border: '1px solid #EAEAEA',
		borderRadius: 0,
		p: 4,
		minH: '7.5rem',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 3,
	},
	iconName: {
		fontSize: '0.75rem',
		fontWeight: 600,
		color: '#1E1E1E',
		textAlign: 'center' as const,
		noOfLines: 2,
	},
} satisfies StylesObject

const IconsViewer = ({ isOpen, onClose }: IconsViewerProps) => {
	const totalCount = generalIcons.length + priceIcons.length

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			size="full"
			scrollBehavior="inside"
		>
			<ModalOverlay bg="blackAlpha.600" />
			<ModalContent borderRadius={0} m={0}>
				<ModalHeader sx={styles.header}>
					<Heading sx={styles.title}>Icon Library</Heading>
					<Text sx={styles.subtitle}>{totalCount} icons from shared/icons</Text>
					<ModalCloseButton top={4} />
				</ModalHeader>

				<ModalBody py={6} px={{ base: 4, md: 8 }} bg="#FAFAFA">
					<VStack spacing={8} align="stretch">
						{iconGroups.map(({ label, icons }) => (
							<Flex key={label} direction="column">
								<Text sx={styles.groupHeading}>{label}</Text>
								<Grid
									templateColumns={{
										base: 'repeat(2, 1fr)',
										sm: 'repeat(3, 1fr)',
										md: 'repeat(4, 1fr)',
										lg: 'repeat(6, 1fr)',
										xl: 'repeat(8, 1fr)',
									}}
									gap={3}
								>
									{icons.map(({ name, Component }) => (
										<Flex key={name} sx={styles.iconCard}>
											<Component boxSize={8} color="#376288" />
											<Text sx={styles.iconName}>{name}</Text>
										</Flex>
									))}
								</Grid>
							</Flex>
						))}
					</VStack>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default IconsViewer
