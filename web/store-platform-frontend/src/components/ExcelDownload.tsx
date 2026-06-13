import {
	Box,
	Flex,
	Icon,
	IconButton,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Text,
	useDisclosure,
	useToast,
} from '@chakra-ui/react'

import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import { ThreeDotsIcon } from '../icons/ThreeDots'
import { DownloadIcon } from '../icons/Download'
import { TargetType } from '../shared/globalEnums'
import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { config } from '../config'
import { RootState } from '../store/store'
import { ProductFilterValues } from './filters/FilterModal'
import { setAccessToken } from '../store/user/reducer'

const styles: StylesObject = {
	iconButton: {
		boxSize: 5,
		bg: 'transparent',
		fontSize: 'lg',
		color: '#353535',
		...hoverFocusActiveButtonStyles,
	},
	icon: {
		fontSize: '1.25rem',
		color: '#6C6C6C',
		cursor: 'pointer',
	},
	actionItem: {
		py: '0.2rem',
		alignItems: 'center',
		cursor: 'pointer',
	},
	actionItemText: {
		color: '#6B6B6B',
		pl: '1rem',
		fontSize: '0.875rem',
		fontWeight: '700',
		lineHeight: '1rem',
		whiteSpace: 'nowrap',
	},
	popoverWrapper: {
		marginLeft: 'auto',
	},
	popoverContent: {
		width: 'fit-content',
		minWidth: '12rem',
	},
}

interface ExcelDownloadProps {
	isDisabled?: boolean
	targetType: TargetType
	queryParams?: ProductFilterValues
}

const getExcelPath = (targetType: TargetType) => {
	switch (targetType) {
		case TargetType.DAILY_ACTION:
			return 'daily-actions/excel'
		default:
			return ''
	}
}

const getFileNameFromContentDisposition = (contentDisposition: string | null) => {
	const fileNameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)

	return fileNameMatch?.[1] ?? 'daily_actions.xlsx'
}

const getDownloadHeaders = (accessToken: string | null) =>
	accessToken
		? {
				Authorization: `Bearer ${accessToken}`,
			}
		: undefined

export const ExcelDownload = ({
	isDisabled = false,
	targetType,
	queryParams,
}: ExcelDownloadProps) => {
	const { t } = useTranslation()
	const toast = useToast()
	const dispatch = useDispatch()
	const accessToken = useSelector((state: RootState) => state.user.accessToken)
	const [isDownloading, setIsDownloading] = useState(false)

	const excelUrl = useMemo(() => {
		const excelPath = getExcelPath(targetType)
		if (!excelPath) return ''

		const searchParams = new URLSearchParams()
		Object.entries(queryParams ?? {}).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				const filteredValue = value.map(item => item.trim()).filter(Boolean)
				if (filteredValue.length > 0) {
					searchParams.set(key, filteredValue.join(','))
				}
				return
			}

			const trimmedValue = value?.trim()
			if (trimmedValue) {
				searchParams.set(key, trimmedValue)
			}
		})

		const baseUrl = config.endpoints.storePlatformEndpoint.replace(/\/$/, '')
		const queryString = searchParams.toString()

		return `${baseUrl}/${excelPath}${queryString ? `?${queryString}` : ''}`
	}, [queryParams, targetType])

	const {
		isOpen: isPopoverOpen,
		onOpen: onPopoverOpen,
		onClose: onPopoverClose,
	} = useDisclosure()

	const handleDownload = async () => {
		if (!excelUrl || isDownloading) return

		onPopoverClose()
		setIsDownloading(true)

		try {
			let response = await fetch(excelUrl, {
				method: 'GET',
				credentials: 'include',
				headers: getDownloadHeaders(accessToken),
			})

			if (response.status === 401) {
				const baseUrl = config.endpoints.storePlatformEndpoint.replace(/\/$/, '')
				const refreshResponse = await fetch(`${baseUrl}/refresh`, {
					method: 'POST',
					credentials: 'include',
				})
				const refreshData = (await refreshResponse.json()) as {
					accessToken?: string
				}

				if (refreshResponse.ok && refreshData.accessToken) {
					dispatch(setAccessToken(refreshData.accessToken))
					response = await fetch(excelUrl, {
						method: 'GET',
						credentials: 'include',
						headers: getDownloadHeaders(refreshData.accessToken),
					})
				}
			}

			if (!response.ok) {
				throw new Error(`Excel download failed with status ${response.status}`)
			}

			const blob = await response.blob()
			const objectUrl = window.URL.createObjectURL(blob)
			const link = document.createElement('a')

			link.href = objectUrl
			link.download = getFileNameFromContentDisposition(
				response.headers.get('Content-Disposition'),
			)
			document.body.appendChild(link)
			link.click()
			link.remove()
			window.URL.revokeObjectURL(objectUrl)
		} catch (error) {
			toast({
				status: 'error',
				description: t('common.downloadExcelError'),
			})
		} finally {
			setIsDownloading(false)
		}
	}

	return (
		<Box sx={styles.popoverWrapper}>
			<Popover
				placement={'bottom-start'}
				returnFocusOnClose={false}
				isOpen={isPopoverOpen}
				onOpen={onPopoverOpen}
				onClose={onPopoverClose}
			>
				<PopoverTrigger>
					<IconButton
						sx={styles.iconButton}
						aria-label={t('common.fileOptions')}
						icon={<ThreeDotsIcon boxSize={6} />}
						isDisabled={isDisabled || !excelUrl || isDownloading}
						isLoading={isDownloading}
					/>
				</PopoverTrigger>
				<PopoverContent sx={styles.popoverContent}>
					<PopoverBody>
						<Flex
							sx={styles.actionItem}
							onClick={handleDownload}
						>
							<Icon sx={styles.icon} as={DownloadIcon} />
							<Text variant="baseStyle" sx={styles.actionItemText}>
								{t('common.downloadExcel')}
							</Text>
						</Flex>
					</PopoverBody>
				</PopoverContent>
			</Popover>
		</Box>
	)
}
