import { useState } from 'react'
import {
	Button,
	FormControl,
	FormLabel,
	Input,
	InputGroup,
	InputRightElement,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
	useChangePasswordMutation,
	useLogoutCurrentMutation,
} from '../api/apiStore'
import { logout } from '../store/user/reducer'
import { RoutePaths } from '../shared/routes'
import { useTranslation } from 'react-i18next'

interface ChangePasswordModalProps {
	isOpen: boolean
	onClose: () => void
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
	const { t } = useTranslation()
	const [changePassword, { isLoading }] = useChangePasswordMutation()
	const [logoutCurrent] = useLogoutCurrentMutation()
	const dispatch = useDispatch()
	const navigate = useNavigate()

	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showCurrent, setShowCurrent] = useState(false)
	const [showNew, setShowNew] = useState(false)
	const [error, setError] = useState('')

	const handleClose = () => {
		setCurrentPassword('')
		setNewPassword('')
		setConfirmPassword('')
		setError('')
		onClose()
	}

	const handleSubmit = async () => {
		setError('')

		if (!currentPassword || !newPassword || !confirmPassword) {
			setError(t('changePassword.allFieldsRequired'))
			return
		}

		if (newPassword !== confirmPassword) {
			setError(t('changePassword.passwordsDoNotMatch'))
			return
		}

		if (newPassword === currentPassword) {
			setError(t('changePassword.passwordMustDiffer'))
			return
		}

		try {
			await changePassword({ currentPassword, newPassword }).unwrap()
			// Password changed — force logout so user re-authenticates
			try {
				await logoutCurrent().unwrap()
			} catch {
				// ignore logout errors
			}
			dispatch(logout())
			navigate(RoutePaths.LOGIN, { replace: true })
		} catch (err: any) {
			setError(err?.data?.message || t('changePassword.failed'))
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} isCentered>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>{t('changePassword.title')}</ModalHeader>
				<ModalBody>
					<VStack gap={4}>
						<FormControl>
							<FormLabel>{t('changePassword.currentPassword')}</FormLabel>
							<InputGroup>
								<Input
									type={showCurrent ? 'text' : 'password'}
									value={currentPassword}
									onChange={e => setCurrentPassword(e.target.value)}
									autoComplete="current-password"
								/>
								<InputRightElement width="4rem">
									<Button
										h="1.75rem"
										size="sm"
										variant="ghost"
										onClick={() => setShowCurrent(v => !v)}
									>
										{showCurrent ? t('common.hide') : t('common.show')}
									</Button>
								</InputRightElement>
							</InputGroup>
						</FormControl>

						<FormControl>
							<FormLabel>{t('changePassword.newPassword')}</FormLabel>
							<InputGroup>
								<Input
									type={showNew ? 'text' : 'password'}
									value={newPassword}
									onChange={e => setNewPassword(e.target.value)}
									autoComplete="new-password"
								/>
								<InputRightElement width="4rem">
									<Button
										h="1.75rem"
										size="sm"
										variant="ghost"
										onClick={() => setShowNew(v => !v)}
									>
										{showNew ? t('common.hide') : t('common.show')}
									</Button>
								</InputRightElement>
							</InputGroup>
						</FormControl>

						<FormControl>
							<FormLabel>{t('changePassword.confirmNewPassword')}</FormLabel>
							<Input
								type="password"
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
								autoComplete="new-password"
							/>
						</FormControl>

						{error && (
							<Text color="red.500" fontSize="sm" alignSelf="flex-start">
								{error}
							</Text>
						)}
					</VStack>
				</ModalBody>
				<ModalFooter gap={2}>
					<Button variant="ghost" onClick={handleClose} isDisabled={isLoading}>
						{t('common.cancel')}
					</Button>
					<Button
						colorScheme="blue"
						onClick={handleSubmit}
						isLoading={isLoading}
					>
						{t('changePassword.title')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default ChangePasswordModal
