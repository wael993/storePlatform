import { useNavigate } from 'react-router-dom'

const NotFound = () => {
	const navigate = useNavigate()

	return (
		<div>
			<h1>status="404"</h1>
			<h3>title="404"</h3>
			<div>
				Sorry, the page you visited does not exist yet. <br />
				Talk to your admin if you believe this is an error.
			</div>

			<button onClick={() => navigate('/')}>Go to Tracking</button>
		</div>
	)
}

export default NotFound
