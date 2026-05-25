import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './en/translation.json'

const persistedLanguage = window.localStorage.getItem('store-platform-language')
const language = persistedLanguage === 'de' ? 'de' : 'en'

void i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: enTranslation,
		},
	},
	lng: language,
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false,
	},
})

export default i18n
