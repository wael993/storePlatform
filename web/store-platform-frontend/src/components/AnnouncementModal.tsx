import {
	Box,
	Flex,
	Image,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Text,
} from '@chakra-ui/react'

export const ANNOUNCEMENT_KEYS = [
	'priceUpdate',
	'dashboard',
	'multipleBarcodes',
	'productImport',
] as const

export type AnnouncementKey = (typeof ANNOUNCEMENT_KEYS)[number]

/** Public assets under /public — one modal payload per list item. */
export const ANNOUNCEMENT_IMAGES: Record<AnnouncementKey, string[]> = {
	priceUpdate: ['/editInvoicePen.png'],
	multipleBarcodes: ['/barcode.png'],
	dashboard: ['/dashboard.png', '/dashboardTag1.png', '/dashboardTag2.png'],
	productImport: ['/importProducts.png', '/import1.png'],
}

export interface AnnouncementImage {
	src: string
	description?: string
}

interface AnnouncementModalProps {
	isOpen: boolean
	onClose: () => void
	title: string
	shortDescription: string
	images?: AnnouncementImage[]
}

export const AnnouncementModal = ({
	isOpen,
	onClose,
	title,
	shortDescription,
	images = [],
}: AnnouncementModalProps) => (
	<Modal
		isOpen={isOpen}
		onClose={onClose}
		size="5xl"
		isCentered
		scrollBehavior="inside"
	>
		<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
		<ModalContent borderRadius="2xl" overflow="hidden">
			<ModalHeader fontSize="lg" fontWeight={800} color="gray.800" pr={12}>
				{title}
			</ModalHeader>
			<ModalCloseButton top={4} right={4} borderRadius="full" />
			<ModalBody pb={6}>
				{shortDescription && (
					<Text
						fontSize="sm"
						lineHeight="1.8"
						color="gray.600"
						mb={images.length ? 6 : 0}
					>
						{shortDescription}
					</Text>
				)}
				{images.length > 0 && (
					<Flex direction="column" gap={6}>
						{images.map((image, index) => (
							<Box key={`${image.src}-${index}`}>
								<Box
									overflow="hidden"
									borderRadius="xl"
									border="1px solid"
									borderColor="gray.200"
									bg="gray.50"
								>
									<Image
										src={image.src}
										alt={`${title} - ${index + 1}`}
										width="100%"
										display="block"
										objectFit="contain"
									/>
								</Box>
								{image.description && (
									<Text mt={2} fontSize="sm" lineHeight="1.7" color="gray.600">
										{image.description}
									</Text>
								)}
							</Box>
						))}
					</Flex>
				)}
			</ModalBody>
		</ModalContent>
	</Modal>
)
