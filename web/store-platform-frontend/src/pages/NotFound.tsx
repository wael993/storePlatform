import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const NotFound = () => {
	const navigate = useNavigate()
	const { t } = useTranslation()

	return (
		<div>
			<h1>{t('notFound.status')}</h1>
			<h3>{t('notFound.title')}</h3>
			<div>
				{t('notFound.description')}
			</div>

			<button onClick={() => navigate('/')}>{t('notFound.goHome')}</button>
		</div>
	)
}

export default NotFound
