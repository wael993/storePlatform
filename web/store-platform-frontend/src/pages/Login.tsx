import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Box,
	Flex,
	Heading,
	Button,
	Stack,
	Container,
	Spinner,
	Text,
	Input,
	Link,
} from '@chakra-ui/react'
import { useLoginMutation } from '../api/apiStore'
import { setTenantOfflineConfig, ensureTenantOfflineDataIsolation } from '../offline/offlineTenantAccess'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/user/reducer'
import { UserRole } from '../shared/globalEnums'
import { RoutePaths } from '../shared/routes'
import { useTranslation } from 'react-i18next'

const Login = () => {
	const { t } = useTranslation()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [resetMessage, setResetMessage] = useState('')
	const [login, { isLoading: isLoggingLoading }] = useLoginMutation()
	const navigate = useNavigate()
	const dispatch = useDispatch()
	const inactiveTenantMessage = t('login.inactiveTenant')
	const validationErrorMessage = t('login.validationError')

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		// Client-side validation
		if (!email) {
			setError(t('login.emailRequired'))
			return
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(email)) {
			setError(t('login.emailInvalid'))
			return
		}
		if (!password || password.length < 8) {
			setError(t('login.passwordMinLength'))
			return
		}

		try {
			const response = await login({ body: { email, password } }).unwrap()

			if (!response) {
				throw new Error('No user returned')
			}
			dispatch(setCredentials(response))
			await setTenantOfflineConfig(response.tenantId, response.offlineEnabled)
			await ensureTenantOfflineDataIsolation(response.tenantId)

			const nextRoute =
				response.role === UserRole.SUPER_ADMIN
					? RoutePaths.ADD_NEW_TENANT
					: RoutePaths.ROOT

			navigate(nextRoute, {
				state: { role: response.role, tenantId: response.tenantId },
			})
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			const status = err?.status
			const errorCode = err?.data?.errorCode
			if (status === 429) {
				setError(t('login.tooManyAttempts'))
			} else if (errorCode === 'INACTIVE_TENANT') {
				setError(inactiveTenantMessage)
			} else if (
				errorCode === 'REQUIRED_FIELD_MISSING' ||
				errorCode === 'INVALID_EMAIL_FORMAT' ||
				errorCode === 'WEAK_PASSWORD'
			) {
				setError(validationErrorMessage)
			} else {
				setError(t('login.invalidCredentials'))
			}
		}
	}

	const handleForgotPassword = async () => {
		setError('')
		setResetMessage('')

		if (!email) {
			setError(t('login.emailRequiredFirst'))
			return
		}

		try {
			setResetMessage(t('login.resetSent'))
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setError(err?.data?.message || t('login.resetFailed'))
		}
	}

	return (
		<Flex minH="100vh" align="center" justify="center" bg="gray.100">
			<Container maxW="md">
				<Box bg="white" p={10} borderRadius="2xl" boxShadow="xl">
					<Stack gap={6}>
						<Heading textAlign="center" color="blue.600">
							{t('login.welcomeBack')}
						</Heading>

						<Text textAlign="center" color="gray.500">
							{t('login.signInSubtitle')}
						</Text>

						{/* Error Message */}
						{error && (
							<Box bg="red.50" p={3} borderRadius="md">
								<Text color="red.600" fontSize="sm">
									{error}
								</Text>
							</Box>
						)}

						{/* Success Message */}
						{resetMessage && (
							<Box bg="green.50" p={3} borderRadius="md">
								<Text color="green.600" fontSize="sm">
									{resetMessage}
								</Text>
							</Box>
						)}

						<form onSubmit={handleLogin}>
							<Stack gap={4}>
								<Box>
									<Text>{t('login.email')}</Text>
									<Input
										type="email"
										value={email}
										onChange={e => setEmail(e.target.value)}
										placeholder={t('login.emailPlaceholder')}
									/>
								</Box>

								<Box>
									<Text>{t('login.password')}</Text>
									<Input
										type="password"
										value={password}
										onChange={e => setPassword(e.target.value)}
										placeholder={t('login.passwordPlaceholder')}
									/>
								</Box>

								<Flex justify="flex-end">
									<Link
										fontSize="sm"
										color="blue.500"
										onClick={handleForgotPassword}
									>
										{t('login.forgotPassword')}
									</Link>
								</Flex>

								<Button
									type="submit"
									size="lg"
									isLoading={isLoggingLoading}
									loadingText={t('login.signingIn')}
									spinner={<Spinner size="sm" />}
									w="full"
								>
									{t('login.signIn')}
								</Button>
							</Stack>
						</form>
					</Stack>
				</Box>
			</Container>
		</Flex>
	)
}

export default Login
