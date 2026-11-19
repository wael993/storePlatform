import { useEffect, useRef, useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	Flex,
	FormControl,
	FormLabel,
	Spinner,
	Switch,
	Table,
	TableContainer,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	VStack,
} from '@chakra-ui/react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
	BackupRecord,
	useConnectBackupProviderMutation,
	useDisconnectBackupProviderMutation,
	useGetBackupHistoryQuery,
	useGetBackupSettingsQuery,
	useRestoreBackupMutation,
	useRunBackupMutation,
	useUpdateBackupSettingsMutation,
} from '../../api/apiStore'
import { getApiErrorMessage } from '../../offline/getApiErrorMessage'
import { useWorkMode } from '../../shared/hooks/useWorkMode'
import { formatBackupSize, scheduleTime } from '../../shared/backup'
import useCustomToast from '../common/CustomToast'
import ConfirmationDialog from '../ConfirmationDialog'

// Brand names stay untranslated.
const PROVIDER_NAMES: Record<string, string> = {
	google_drive: 'Google Drive',
	dropbox: 'Dropbox',
	onedrive: 'Microsoft OneDrive',
}
const IN_FLIGHT = new Set(['PENDING', 'PROCESSING', 'UPLOADING'])
// ?backup=… values the OAuth callback redirects with → toast status
const CONNECT_RESULTS = new Map<string, 'success' | 'info' | 'error'>([
	['connected', 'success'],
	['cancelled', 'info'],
	['error', 'error'],
])
const POLL_MS = 4000

const providerName = (provider: string | null | undefined) =>
	provider ? (PROVIDER_NAMES[provider] ?? provider) : '-'

const formatDateTime = (value: string | null | undefined) =>
	value ? format(new Date(value), 'dd.MM.yyyy HH:mm') : '-'

const STATUS_COLORS: Record<string, string> = {
	COMPLETED: 'green',
	FAILED: 'red',
}

const BackupSettings = () => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const [searchParams, setSearchParams] = useSearchParams()
	const { workMode } = useWorkMode()
	const isOffline = workMode === 'offline'
	const [pollingInterval, setPollingInterval] = useState(0)
	const { data: settings, isLoading } = useGetBackupSettingsQuery(undefined, {
		pollingInterval,
	})
	const { data: history = [] } = useGetBackupHistoryQuery(undefined, {
		pollingInterval,
	})
	const [updateSettings, { isLoading: isUpdating }] =
		useUpdateBackupSettingsMutation()
	const [connectProvider, { isLoading: isConnecting }] =
		useConnectBackupProviderMutation()
	const [disconnectProvider, { isLoading: isDisconnecting }] =
		useDisconnectBackupProviderMutation()
	const [runBackup, { isLoading: isStartingBackup }] = useRunBackupMutation()
	const [restoreBackup, { isLoading: isStartingRestore }] =
		useRestoreBackupMutation()
	const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null)
	const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null)
	const previousRestoreStatus = useRef<string | undefined>(undefined)

	const errorText = (code: string | null | undefined) =>
		t(`components.backupSettings.errors.${code ?? 'UNKNOWN'}`, {
			defaultValue: t('components.backupSettings.errors.UNKNOWN'),
		})

	const backupInFlight = history.some(backup => IN_FLIGHT.has(backup.status))
	const restoreRunning = settings?.restore?.status === 'RUNNING'

	// poll only while something is running server-side
	useEffect(() => {
		setPollingInterval(backupInFlight || restoreRunning ? POLL_MS : 0)
	}, [backupInFlight, restoreRunning])

	// result of the provider consent redirect (?backup=connected|cancelled|error)
	useEffect(() => {
		const param = searchParams.get('backup')

		if (!param) return

		// only the API's own values; anything else (a hand-edited link) is ignored
		const result = CONNECT_RESULTS.get(param)

		if (result) {
			showToast({
				status: result,
				description: t(`components.backupSettings.connectResult.${param}`),
			})
		}
		searchParams.delete('backup')
		setSearchParams(searchParams, { replace: true })
	}, [searchParams, setSearchParams, showToast, t])

	// after a restore finishes, every cached screen is stale: offer a reload
	useEffect(() => {
		const status = settings?.restore?.status

		if (previousRestoreStatus.current === 'RUNNING' && status === 'COMPLETED') {
			showToast({
				status: 'success',
				description: t('components.backupSettings.restoreCompleted'),
			})
		}

		previousRestoreStatus.current = status
	}, [settings?.restore?.status, showToast, t])

	const handleError = (error: unknown, fallbackKey: string) =>
		showToast({
			status: 'error',
			description: getApiErrorMessage(error, t(fallbackKey)),
		})

	const handleConnect = async (provider: string) => {
		try {
			const { url } = await connectProvider(provider).unwrap()

			window.location.assign(url)
		} catch (error) {
			handleError(error, 'components.backupSettings.connectFailed')
		}
	}

	const handleUpdate = async (body: {
		enabled?: boolean
		provider?: string
	}) => {
		try {
			await updateSettings(body).unwrap()
		} catch (error) {
			handleError(error, 'settings.updateFailedMessage')
		}
	}

	const handleRunBackup = async () => {
		try {
			await runBackup().unwrap()
			showToast({
				status: 'info',
				description: t('components.backupSettings.backupStarted'),
			})
		} catch (error) {
			handleError(error, 'components.backupSettings.backupStartFailed')
		}
	}

	const handleRestore = async () => {
		if (!restoreTarget) return

		try {
			await restoreBackup(restoreTarget.backupId).unwrap()
			setRestoreTarget(null)
		} catch (error) {
			setRestoreTarget(null)
			handleError(error, 'components.backupSettings.restoreStartFailed')
		}
	}

	const handleDisconnect = async () => {
		if (!disconnectTarget) return

		try {
			await disconnectProvider(disconnectTarget).unwrap()
		} catch (error) {
			handleError(error, 'settings.updateFailedMessage')
		} finally {
			setDisconnectTarget(null)
		}
	}

	if (isLoading || !settings) {
		return <Spinner size="sm" />
	}

	const actionsDisabled = isOffline || restoreRunning
	const connections = new Map(
		settings.connections.map(connection => [connection.provider, connection]),
	)

	return (
		<VStack align="stretch" spacing={6} width="100%">
			{isOffline ? (
				<Alert status="info" borderRadius="md" variant="left-accent">
					<AlertIcon />
					<AlertDescription fontSize="sm">
						{t('components.backupSettings.onlineOnly')}
					</AlertDescription>
				</Alert>
			) : null}

			{settings.restore ? (
				<Alert
					status={
						settings.restore.status === 'RUNNING'
							? 'info'
							: settings.restore.status === 'COMPLETED'
								? 'success'
								: 'error'
					}
					borderRadius="md"
					variant="left-accent"
				>
					{restoreRunning ? <Spinner size="sm" mr={3} /> : <AlertIcon />}
					<AlertDescription fontSize="sm">
						{settings.restore.status === 'RUNNING'
							? t('components.backupSettings.restoreRunning')
							: settings.restore.status === 'COMPLETED'
								? t('components.backupSettings.restoreDone', {
										date: formatDateTime(settings.restore.finishedAt),
									})
								: t('components.backupSettings.restoreFailed', {
										reason: errorText(settings.restore.errorCode),
									})}
						{settings.restore.status === 'COMPLETED' ? (
							<Button size="xs" ml={3} onClick={() => window.location.reload()}>
								{t('components.backupSettings.reload')}
							</Button>
						) : null}
					</AlertDescription>
				</Alert>
			) : null}

			<Box>
				<Text fontSize="sm" color="gray.600" mb={4}>
					{t('components.backupSettings.description')}
				</Text>
				<FormControl display="flex" alignItems="center" gap={3}>
					<Switch
						id="backup-enabled"
						isChecked={settings.enabled}
						isDisabled={actionsDisabled || isUpdating || !settings.provider}
						onChange={event => handleUpdate({ enabled: event.target.checked })}
					/>
					<FormLabel htmlFor="backup-enabled" mb={0} fontWeight={600}>
						{t('components.backupSettings.enabled')}
					</FormLabel>
				</FormControl>
				{!settings.provider ? (
					<Text fontSize="sm" color="gray.500" mt={2}>
						{t('components.backupSettings.connectFirst')}
					</Text>
				) : null}
			</Box>

			<Flex gap={8} flexWrap="wrap" fontSize="sm">
				<Box>
					<Text color="gray.500">
						{t('components.backupSettings.lastBackup')}
					</Text>
					<Text fontWeight={600}>
						{formatDateTime(settings.lastBackupAt)}{' '}
						{settings.lastBackupStatus ? (
							<Badge
								colorScheme={STATUS_COLORS[settings.lastBackupStatus]}
								ml={1}
							>
								{t(
									`components.backupSettings.status.${settings.lastBackupStatus}`,
								)}
							</Badge>
						) : null}
					</Text>
				</Box>
				<Box>
					<Text color="gray.500">
						{t('components.backupSettings.schedule')}
					</Text>
					<Text fontWeight={600}>
						{t('components.backupSettings.scheduleDaily', {
							time: scheduleTime(settings.schedule),
							timezone: settings.timezone,
						})}
					</Text>
				</Box>
				<Box>
					<Text color="gray.500">
						{t('components.backupSettings.retention')}
					</Text>
					<Text fontWeight={600}>
						{t('components.backupSettings.retentionCount', {
							number: settings.retentionCount,
						})}
					</Text>
				</Box>
			</Flex>

			<Box>
				<Text fontWeight={600} mb={3}>
					{t('components.backupSettings.storage')}
				</Text>
				<VStack align="stretch" spacing={3}>
					{settings.providers.map(provider => {
						const connection = connections.get(provider)
						const isActive = settings.provider === provider

						return (
							<Flex
								key={provider}
								borderWidth="1px"
								borderRadius="md"
								p={3}
								align="center"
								justify="space-between"
								gap={3}
								flexWrap="wrap"
							>
								<Box>
									<Text fontWeight={600}>
										{providerName(provider)}{' '}
										{isActive ? (
											<Badge colorScheme="blue" ml={1}>
												{t('components.backupSettings.active')}
											</Badge>
										) : null}
									</Text>
									<Text fontSize="sm" color="gray.600">
										{connection
											? t('components.backupSettings.connectedAs', {
													account: connection.accountLabel,
												})
											: t('components.backupSettings.notConnected')}
									</Text>
								</Box>
								<Flex gap={2} flexWrap="wrap">
									{connection && !isActive ? (
										<Button
											size="sm"
											isDisabled={actionsDisabled}
											isLoading={isUpdating}
											onClick={() => handleUpdate({ provider })}
										>
											{t('components.backupSettings.useProvider')}
										</Button>
									) : null}
									<Button
										size="sm"
										variant={connection ? 'outline' : 'solid'}
										colorScheme={connection ? undefined : 'blue'}
										isDisabled={actionsDisabled}
										isLoading={isConnecting}
										onClick={() => handleConnect(provider)}
									>
										{connection
											? t('components.backupSettings.changeAccount')
											: t('components.backupSettings.connect')}
									</Button>
									{connection ? (
										<Button
											size="sm"
											variant="ghost"
											colorScheme="red"
											isDisabled={actionsDisabled}
											onClick={() => setDisconnectTarget(provider)}
										>
											{t('components.backupSettings.disconnect')}
										</Button>
									) : null}
								</Flex>
							</Flex>
						)
					})}
				</VStack>
			</Box>

			<Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
				<Text fontWeight={600}>{t('components.backupSettings.history')}</Text>
				<Button
					colorScheme="blue"
					size="sm"
					isDisabled={
						actionsDisabled ||
						!settings.enabled ||
						!settings.provider ||
						backupInFlight
					}
					isLoading={isStartingBackup || backupInFlight}
					loadingText={t('components.backupSettings.backupRunning')}
					onClick={handleRunBackup}
				>
					{t('components.backupSettings.backupNow')}
				</Button>
			</Flex>

			{history.length === 0 ? (
				<Text fontSize="sm" color="gray.500">
					{t('components.backupSettings.noBackups')}
				</Text>
			) : (
				<TableContainer>
					<Table size="sm">
						<Thead>
							<Tr>
								<Th>{t('components.backupSettings.columns.date')}</Th>
								<Th>{t('components.backupSettings.columns.type')}</Th>
								<Th>{t('components.backupSettings.columns.provider')}</Th>
								<Th>{t('components.backupSettings.columns.size')}</Th>
								<Th>{t('components.backupSettings.columns.status')}</Th>
								<Th />
							</Tr>
						</Thead>
						<Tbody>
							{history.map(backup => (
								<Tr key={backup.backupId}>
									<Td title={backup.name}>
										{formatDateTime(backup.completedAt ?? backup.createdAt)}
									</Td>
									<Td>{t(`components.backupSettings.kind.${backup.kind}`)}</Td>
									<Td>{providerName(backup.provider)}</Td>
									<Td>{formatBackupSize(backup.size)}</Td>
									<Td>
										<Badge colorScheme={STATUS_COLORS[backup.status] ?? 'gray'}>
											{t(`components.backupSettings.status.${backup.status}`)}
										</Badge>
										{backup.status === 'FAILED' ? (
											<Text fontSize="xs" color="red.600" whiteSpace="normal">
												{errorText(backup.errorCode)}
											</Text>
										) : null}
									</Td>
									<Td textAlign="end">
										{backup.status === 'COMPLETED' ? (
											<Button
												size="xs"
												variant="outline"
												colorScheme="red"
												isDisabled={
													actionsDisabled || !connections.has(backup.provider)
												}
												onClick={() => setRestoreTarget(backup)}
											>
												{t('components.backupSettings.restore')}
											</Button>
										) : null}
									</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				</TableContainer>
			)}

			<ConfirmationDialog
				header={t('components.backupSettings.restoreConfirmTitle')}
				body={t('components.backupSettings.restoreConfirmBody', {
					date: formatDateTime(restoreTarget?.completedAt),
				})}
				isOpen={Boolean(restoreTarget)}
				onClose={() => setRestoreTarget(null)}
				onConfirm={handleRestore}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('components.backupSettings.restore')}
				isConfirmationButtonLoading={isStartingRestore}
			/>
			<ConfirmationDialog
				header={t('components.backupSettings.disconnectConfirmTitle')}
				body={t('components.backupSettings.disconnectConfirmBody', {
					provider: providerName(disconnectTarget),
				})}
				isOpen={Boolean(disconnectTarget)}
				onClose={() => setDisconnectTarget(null)}
				onConfirm={handleDisconnect}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('components.backupSettings.disconnect')}
				isConfirmationButtonLoading={isDisconnecting}
			/>
		</VStack>
	)
}

export default BackupSettings
