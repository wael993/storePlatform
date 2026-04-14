import axios from 'axios'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom' // To access the state passed via navigation
import AdminDashboard from './AdminDashboard'
import { UserRole } from '../shared/globalEnums'
// import { useAddUserMutation } from '../store/api/platform'
const Dashboard: React.FC = () => {
	const location = useLocation() // Get the state passed via navigate
	const [role, setRole] = useState<string>(localStorage.getItem('role') || '') // Default to role from localStorage
	const [message, setMessage] = useState<string>('')

	// const [addUser, { isLoading: isPostNewUserFetching }] = useAddUserMutation()

	useEffect(() => {
		if (location.state?.role) {
			setRole(location.state.role) // If the role is passed via state, use it
		}
	}, [location])
	const isAdmin = role === UserRole.ADMIN
	useEffect(() => {
		if (isAdmin) {
			setMessage('Welcome to the Admin Dashboard! You can add users.')
		} else {
			setMessage('Welcome to the Dashboard! You can only view data.')
		}
	}, [isAdmin])

	const [formData, setFormData] = useState({
		username: '',
		email: '',
		password: '',
		role: UserRole.EDITOR,
	})

	// Handle input changes
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		setFormData({ ...formData, [e.target.name]: e.target.value })
	}

	// Handle user registration (only admins)
	const handleRegister = async (user: React.FormEvent) => {
		user.preventDefault()
		setMessage('')

		if (role !== UserRole.ADMIN) {
			setMessage('Unauthorized: Only admins can add users.')
			return
		}

		if (!formData.username || !formData.email || !formData.password) {
			setMessage('All fields are required.')
			return
		}

		try {
			// Send form data to the backend API
			const response = await axios.post(
				'http://localhost:3001/api/business-platform-store/register',
				formData
			)

			if (response.data.success) {
				setMessage('Registration successful! Please login.')
				setFormData({
					username: '',
					email: '',
					password: '',
					role: UserRole.EDITOR,
				})
			}
		} catch (err: any) {
			setMessage('Registration failed. Please try again.')
		}
	}

	const styles = {
		container: {
			maxWidth: '400px',
			margin: '20px auto',
			padding: '20px',
			border: '1px solid #ddd',
			borderRadius: '5px',
			boxShadow: '2px 2px 10px rgba(0,0,0,0.1)',
		},
	}

	return (
		<div style={styles.container}>
			<h1
				style={{
					textAlign: 'center',
					marginBottom: '15px',
				}}
			>
				Dashboard
			</h1>
			<p style={{ textAlign: 'center' }}>Welcome, {role?.toUpperCase()}</p>

			{role === UserRole.ADMIN ? (
				<AdminDashboard
					formData={formData}
					message={message}
					handleChange={handleChange}
					handleRegister={handleRegister}
				/>
			) : (
				<p style={{ textAlign: 'center', color: 'blue' }}>
					You are logged in as an Editor. You can only view data.
				</p>
			)}
		</div>
	)
}

export default Dashboard
