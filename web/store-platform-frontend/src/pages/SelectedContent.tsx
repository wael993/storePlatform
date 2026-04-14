import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

const SelectContent: React.FC = () => {
	const [content, setContent] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)
	const [contentNumber, setContentNumber] = useState<number>(0)
	const [contentNumbers, setContentNumbers] = useState<number[]>([])

	const styles: { [key: string]: React.CSSProperties } = {
		container: {
			textAlign: 'center',
			padding: '40px',
			maxWidth: '800px',
			margin: 'auto',
		},
		title: {
			fontSize: '2rem',
			fontWeight: 'bold',
			marginBottom: '20px',
			color: '#333',
		},
		description: {
			fontSize: '1.2rem',
			color: '#555',
			lineHeight: '1.6',
		},
		button: {
			textDecoration: 'none',
			backgroundColor: '#007bff',
			color: '#fff',
			padding: '10px 20px',
			borderRadius: '5px',
			marginTop: '20px',
		},
		dropdown: {
			padding: '10px',
			margin: '20px 0',
			fontSize: '1rem',
		},
	}

	// Function to fetch the default content
	const fetchDefaultContent = async () => {
		try {
			const response = await axios.get(
				'http://localhost:3001/api/business-platform-store/get-default-content'
			)
			if (response.data.success) {
				setContent(response.data.content) // Set the default content
				setContentNumber(response.data.content.contentNumber) // Set the contentNumber for dropdown
			}
		} catch (err) {
			setError('Failed to load default content') // Handle error
		}
	}

	// Function to fetch available content numbers for dropdown
	const fetchContentNumbers = async () => {
		try {
			const response = await axios.get(
				'http://localhost:3001/api/business-platform-store/get-content-numbers'
			)
			if (response.data.success) {
				setContentNumbers(response.data.contentNumbers) // Set content numbers
			}
		} catch (err) {
			setError('Failed to load content numbers') // Handle error
		}
	}

	// Fetch content and content numbers on component mount
	useEffect(() => {
		fetchDefaultContent() // Fetch default content
		fetchContentNumbers() // Fetch content numbers for dropdown
	}, [])

	// Function to change content based on selected content number
	const changeContent = async (number: number) => {
		try {
			const response = await axios.get(
				`http://localhost:3001/api/business-platform-store/get-content/${number}`
			)
			if (response.data.success) {
				setContent(response.data.content) // Set new content
				setContentNumber(number) // Update the selected content number
			}
		} catch (err) {
			setError('Failed to load content') // Handle error
		}
	}

	if (error) {
		return <div>{error}</div> // Display error message if an error occurs
	}

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>
				{content?.header || 'Welcome to Business Solution Services'}
			</h1>

			{/* Dropdown for changing content */}
			<select
				style={styles.dropdown}
				value={contentNumber}
				onChange={e => {
					const number = Number(e.target.value)
					setContentNumber(number)
					if (number !== 0) changeContent(number)
				}}
			>
				<option value={0}>Select Content</option>
				{contentNumbers.map(num => (
					<option key={num} value={num}>
						Content {num}
					</option>
				))}
			</select>

			{/* Display content */}
			<p style={styles.description}>
				{content?.text || 'No content available.'}
			</p>
			<p style={styles.description}>
				{content?.supHeader || 'No supplementary header available.'}
			</p>

			<Link to="/admin" style={styles.button}>
				Go to Admin
			</Link>
		</div>
	)
}

export default SelectContent
