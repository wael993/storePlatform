import axios from 'axios'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const EditorDashboard = () => {
	// States for content
	const [header, setHeader] = useState('')
	const [supHeader, setSubheader] = useState('')
	const [text, setText] = useState('')

	// States for style customization
	const [headerStyle, setHeaderStyle] = useState({
		color: 'black',
		fontSize: '24px',
	})
	const [subheaderStyle, setSubheaderStyle] = useState({
		color: 'black',
		fontSize: '20px',
	})
	const [textStyle, setTextStyle] = useState({
		color: 'black',
		fontSize: '16px',
	})

	// State for messages
	const [message, setMessage] = useState<string>('')

	// Handle content changes
	const handleContentChange =
		(setter: React.Dispatch<React.SetStateAction<string>>) =>
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setter(event.target.value)
		}

	// Handle style changes (color and font size)
	const handleStyleChange =
		(setter: React.Dispatch<React.SetStateAction<any>>, type: string) =>
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setter((prev: any) => ({ ...prev, [type]: event.target.value }))
		}

	// Handle form submission
	const handleAddContent = async (e: React.FormEvent) => {
		e.preventDefault()
		setMessage('')

		try {
			const response = await axios.post(
				'http://localhost:3001/api/business-platform-store/update-content',
				{ header, supHeader, text },
			)

			if (response.data.success) {
				setMessage('Content updated successfully!')
			}
		} catch (error) {
			setMessage('Failed to update content. Please try again.')
		}
	}

	const styles = {
		container: {
			padding: '20px',
		},
		header: {
			marginBottom: '20px',
		},
		textarea: {
			width: '100%',
			marginBottom: '10px',
		},
		styleControls: {
			marginTop: '10px',
		},
		button: {
			marginTop: '20px',
			padding: '10px 20px',
			backgroundColor: '#4CAF50',
			color: 'white',
			border: 'none',
			cursor: 'pointer',
			marginRight: '1rem',
		},
		buttonHover: {
			backgroundColor: '#45a049',
		},
		link: {
			display: 'block',
			marginTop: '20px',
			color: '#007bff',
		},
		linkHover: {
			textDecoration: 'underline',
		},
		message: {
			marginBottom: '20px',
			color: 'green',
			fontWeight: 'bold',
		},
	}

	return (
		<div style={styles.container}>
			<h1>Editor Dashboard</h1>

			{message && <p style={styles.message}>{message}</p>}

			{/* Header Section */}
			<div style={styles.header}>
				<h2>Header</h2>
				<textarea
					value={header}
					onChange={handleContentChange(setHeader)}
					style={{ ...styles.textarea, ...headerStyle }}
				/>
				<div style={styles.styleControls}>
					<label>Color:</label>
					<input
						type="color"
						value={headerStyle.color}
						onChange={e => handleStyleChange(setHeaderStyle, 'color')(e)}
					/>
					<label>Font Size:</label>
					<input
						type="number"
						value={parseInt(headerStyle.fontSize)}
						onChange={e => handleStyleChange(setHeaderStyle, 'fontSize')(e)}
						min="10"
						max="50"
					/>
				</div>
			</div>

			{/* Subheader Section */}
			<div style={styles.header}>
				<h2>Subheader</h2>
				<textarea
					value={supHeader}
					onChange={handleContentChange(setSubheader)}
					style={{ ...styles.textarea, ...subheaderStyle }}
				/>
				<div style={styles.styleControls}>
					<label>Color:</label>
					<input
						type="color"
						value={subheaderStyle.color}
						onChange={e => handleStyleChange(setSubheaderStyle, 'color')(e)}
					/>
					<label>Font Size:</label>
					<input
						type="number"
						value={parseInt(subheaderStyle.fontSize)}
						onChange={e => handleStyleChange(setSubheaderStyle, 'fontSize')(e)}
						min="10"
						max="50"
					/>
				</div>
			</div>

			{/* Text Section */}
			<div style={styles.header}>
				<h2>Main Text</h2>
				<textarea
					value={text}
					onChange={handleContentChange(setText)}
					style={{ ...styles.textarea, ...textStyle }}
				/>
				<div style={styles.styleControls}>
					<label>Color:</label>
					<input
						type="color"
						value={textStyle.color}
						onChange={e => handleStyleChange(setTextStyle, 'color')(e)}
					/>
					<label>Font Size:</label>
					<input
						type="number"
						value={parseInt(textStyle.fontSize)}
						onChange={e => handleStyleChange(setTextStyle, 'fontSize')(e)}
						min="10"
						max="50"
					/>
				</div>
			</div>

			{/* Save Button */}
			<button
				onClick={handleAddContent}
				style={styles.button}
				onMouseOver={e =>
					(e.currentTarget.style.backgroundColor =
						styles.buttonHover.backgroundColor)
				}
				onMouseOut={e => (e.currentTarget.style.backgroundColor = '#4CAF50')}
			>
				Save Changes
			</button>

			{/*Admin Login Link */}

			<Link to="/admin" style={styles.button}>
				Go to Admin
			</Link>

			<Link to="/select-content" style={styles.button}>
				select content
			</Link>
		</div>
	)
}

export default EditorDashboard
