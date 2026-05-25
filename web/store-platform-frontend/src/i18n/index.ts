import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './en/translation.json'
import deTranslation from './de/translation.json'

const persistedLanguage = window.localStorage.getItem('store-platform-language')
const language = persistedLanguage === 'de' ? 'de' : 'en'

void i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: enTranslation,
		},
		de: {
			translation: deTranslation,
		},
	},
	lng: language,
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false,
	},
})

export default i18n
