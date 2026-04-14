import React from 'react'
// import { useTranslation } from 'react-i18next'

interface AdminDashboardProps {
	message: string
	handleRegister: (e: React.FormEvent) => void
	handleChange: (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => void
	formData: {
		username: string
		email: string
		password: string
		role: string
	}
}

const styles = {
	formGroup: {
		marginBottom: '10px',
	},
	input: {
		width: '100%',
		padding: '8px',
		marginBottom: '10px',
		border: '1px solid #ccc',
		borderRadius: '5px',
	},
	select: {
		width: '100%',
		padding: '8px',
		border: '1px solid #ccc',
		borderRadius: '5px',
	},
	button: {
		width: '100%',
		padding: '10px',
		backgroundColor: '#28a745',
		color: 'white',
		border: 'none',
		borderRadius: '5px',
		cursor: 'pointer',
	},
}

const AdminDashboard = ({
	formData,
	message,
	handleChange,
	handleRegister,
}: AdminDashboardProps) => {
	// const { t } = useTranslation()

	return (
		<>
			<h2
				style={{
					textAlign: 'center',
					marginBottom: '15px',
				}}
			>
				Register a New User
			</h2>
			{message && (
				<p
					style={{
						textAlign: 'center',
						color: message.includes('successfully') ? 'green' : 'red',
						marginTop: '10px',
					}}
				>
					{message}
				</p>
			)}

			<form onSubmit={handleRegister}>
				<div style={styles.formGroup}>
					<input
						type="text"
						name="username"
						placeholder="Username"
						value={formData.username}
						onChange={handleChange}
						style={styles.input}
						required
					/>
				</div>

				<div style={styles.formGroup}>
					<input
						type="email"
						name="email"
						placeholder="Email"
						value={formData.email}
						onChange={handleChange}
						style={styles.input}
						required
					/>
				</div>

				<div style={styles.formGroup}>
					<input
						type="password"
						name="password"
						placeholder="Password"
						value={formData.password}
						onChange={handleChange}
						style={styles.input}
						required
					/>
				</div>

				<div style={styles.formGroup}>
					<select
						name="role"
						value={formData.role}
						onChange={handleChange}
						style={styles.select}
					>
						<option value="editor">Editor</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<button type="submit" style={styles.button}>
					Register User
				</button>
			</form>
		</>
	)
}

export default AdminDashboard
