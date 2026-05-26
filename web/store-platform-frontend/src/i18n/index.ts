import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './en/translation.json'
import deTranslation from './de/translation.json'
import arTranslation from './ar/translation.json'

const persistedLanguage = window.localStorage.getItem('store-platform-language')
const language = ['de', 'ar'].includes(persistedLanguage || '')
	? (persistedLanguage as 'de' | 'ar')
	: 'en'

const applyDocumentLanguage = (nextLanguage: string) => {
	const direction = nextLanguage === 'ar' ? 'rtl' : 'ltr'
	document.documentElement.lang = nextLanguage
	document.documentElement.dir = direction
}

void i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: enTranslation,
		},
		de: {
			translation: deTranslation,
		},
		ar: {
			translation: arTranslation,
		},
	},
	lng: language,
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false,
	},
})

applyDocumentLanguage(language)

i18n.on('languageChanged', nextLanguage => {
	applyDocumentLanguage(nextLanguage)
})

export default i18n
