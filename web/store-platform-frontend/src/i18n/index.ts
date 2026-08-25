import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './en/translation.json'
import deTranslation from './de/translation.json'
import arTranslation from './ar/translation.json'

const persistedLanguage = window.localStorage.getItem('store-platform-language')
const language = ['ar', 'en', 'de'].includes(persistedLanguage || '')
	? (persistedLanguage as 'ar' | 'en' | 'de')
	: 'ar'

const applyDocumentLanguage = (nextLanguage: string) => {
	const direction = nextLanguage === 'ar' ? 'rtl' : 'ltr'
	document.documentElement.lang = nextLanguage
	document.documentElement.dir = direction
	if (i18n.isInitialized) {
		document.title = i18n.t('appTitle')
	}
}

applyDocumentLanguage(language)

void i18n
	.use(initReactI18next)
	.init({
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
		fallbackLng: ['ar', 'en', 'de'],
		interpolation: {
			escapeValue: false,
		},
	})
	.then(() => {
		applyDocumentLanguage(i18n.language)
	})

i18n.on('languageChanged', nextLanguage => {
	applyDocumentLanguage(nextLanguage)
})

export default i18n
