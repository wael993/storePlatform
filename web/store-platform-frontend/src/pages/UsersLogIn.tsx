import React from 'react'
import { Link } from 'react-router-dom'

const Home: React.FC = () => {
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

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Welcome to Business Solution Services</h1>
			<p style={styles.description}>
				At Business Solution Services, we provide top-notch consulting and IT
				solutions to help companies optimize their operations and achieve
				growth. Our experienced team offers expertise in business strategy,
				software development, and process automation.
			</p>
			<p style={styles.description}>
				Whether you're a startup or an established company, we have the right
				solutions tailored to your needs. Contact us today to learn how we can
				help your business thrive.
			</p>

			<Link to="/login" style={styles.button}>
				Login
			</Link>
		</div>
	)
}

export default Home
