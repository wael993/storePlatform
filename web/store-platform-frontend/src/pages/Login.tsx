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
import api from '../api/api'
import { useLoginMutation } from '../api/apiStore'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/user/reducer'

const Login = () => {
	const [email, setEmail] = useState('admin@example.com')
	const [password, setPassword] = useState('admin123')
	const [error, setError] = useState('')
	const [resetMessage, setResetMessage] = useState('')
	const [login, { isLoading: isLoggingLoading }] = useLoginMutation()
	const navigate = useNavigate()
	const dispatch = useDispatch()

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		try {
			const response = await login({ body: { email, password } }).unwrap()

			if (!response) {
				throw new Error('No user returned')
			}
			dispatch(setCredentials(response)) // ✅ store user globally
			const { token, role } = response

			// ✅ store token

			localStorage.setItem('token', token)

			// ✅ safer role handling
			if (role?._id) {
				localStorage.setItem('role', role._id)
			}

			navigate('/barcode', { state: { role } })
		} catch (err: any) {
			setError(err?.response?.data?.message || 'Invalid email or password')
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
			await api.forgotPassword({ email })
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
