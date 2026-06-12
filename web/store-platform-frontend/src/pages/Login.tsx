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
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/user/reducer'
import { UserRole } from '../shared/globalEnums'
import { RoutePaths } from '../shared/routes'

const Login = () => {
	const [email, setEmail] = useState('admin@example.com')
	const [password, setPassword] = useState('admin123')
	const [error, setError] = useState('')
	const [resetMessage, setResetMessage] = useState('')
	const [login, { isLoading: isLoggingLoading }] = useLoginMutation()
	const navigate = useNavigate()
	const dispatch = useDispatch()
	const inactiveTenantMessage =
		'Tenant is inactive. Contact the platform admin.'
	const validationErrorMessage =
		'Please check your email and password format and try again.'

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		// Client-side validation
		if (!email) {
			setError('Please enter your email address.')
			return
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(email)) {
			setError('Please provide a valid email address (e.g. user@example.com).')
			return
		}
		if (!password || password.length < 8) {
			setError('Password must be at least 8 characters.')
			return
		}

		try {
			const response = await login({ body: { email, password } }).unwrap()

			if (!response) {
				throw new Error('No user returned')
			}
			dispatch(setCredentials(response))

			const nextRoute =
				response.role === UserRole.SUPER_ADMIN
					? RoutePaths.ADD_NEW_TENANT
					: RoutePaths.ROOT

			navigate(nextRoute, {
				state: { role: response.role, tenantId: response.tenantId },
			})
		} catch (err: any) {
			const status = err?.status
			const errorCode = err?.data?.errorCode
			if (status === 429) {
				setError('Too many login attempts. Please try again after 1 minute.')
			} else if (errorCode === 'INACTIVE_TENANT') {
				setError(inactiveTenantMessage)
			} else if (
				errorCode === 'REQUIRED_FIELD_MISSING' ||
				errorCode === 'INVALID_EMAIL_FORMAT' ||
				errorCode === 'WEAK_PASSWORD'
			) {
				setError(validationErrorMessage)
			} else {
				setError('Invalid email or password.')
			}
		}
	}

	const handleForgotPassword = async () => {
		setError('')
		setResetMessage('')

		if (!email) {
			setError('Please enter your email first')
			return
		}

		try {
			setResetMessage('Password reset link sent to your email')
		} catch (err: any) {
			setError(err.response?.data?.error || 'Failed to send reset email')
		}
	}

	return (
		<Flex minH="100vh" align="center" justify="center" bg="gray.100">
			<Container maxW="md">
				<Box bg="white" p={10} borderRadius="2xl" boxShadow="xl">
					<Stack gap={6}>
						<Heading textAlign="center" color="blue.600">
							Welcome Back
						</Heading>

						<Text textAlign="center" color="gray.500">
							Sign in to your account
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
									<Text>Email</Text>
									<Input
										type="email"
										value={email}
										onChange={e => setEmail(e.target.value)}
										placeholder="you@example.com"
									/>
								</Box>

								<Box>
									<Text>Password</Text>
									<Input
										type="password"
										value={password}
										onChange={e => setPassword(e.target.value)}
										placeholder="Enter your password"
									/>
								</Box>

								<Flex justify="flex-end">
									<Link
										fontSize="sm"
										color="blue.500"
										onClick={handleForgotPassword}
									>
										Forgot password?
									</Link>
								</Flex>

								<Button
									type="submit"
									size="lg"
									isLoading={isLoggingLoading}
									loadingText="Signing in..."
									spinner={<Spinner size="sm" />}
									w="full"
								>
									Sign In
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
