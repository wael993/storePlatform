import React, { useEffect, useState } from 'react'
import api from '../api/api'

const Home: React.FC = () => {
	const [content, setContent] = useState<any>(null) // State to store the fetched content
	const [loading, setLoading] = useState<boolean>(true) // Loading state
	const [error, setError] = useState<string | null>(null) // Error state

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
	}

	// Function to fetch default content
	const fetchDefaultContent = async () => {
		try {
			setLoading(true)
			const response = await api.getDefaultContent()
			if (response.data.success) {
				setContent(response.data.content) // Set the fetched content to state
				setLoading(false)
			}
		} catch (err) {
			setError('Failed to load default content') // Handle error
		}
	}

	// Fetch default content on component mount
	useEffect(() => {
		fetchDefaultContent() // Fetch default content when the component mounts
	}, [])

	if (loading) {
		return <div>Loading...</div> // Display loading text while fetching data
	}

	if (error) {
		return <div>{error}</div> // Display error message if an error occurs
	}

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{content?.header || 'No Content Available'}</h1>
			<p style={styles.description}>
				{content?.text || 'No content available.'}
			</p>
			<p style={styles.description}>
				{content?.supHeader || 'No content available.'}
			</p>
		</div>
	)
}

export default Home
