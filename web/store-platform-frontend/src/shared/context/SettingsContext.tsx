import React, { createContext, useContext, useState, useEffect } from 'react'
import { useGetUserSettingsQuery } from '../../api/apiStore'
import i18n from '../../i18n'

interface SettingsContextType {
	productsPerPage: number
	setProductsPerPage: (value: number) => void
	displayLanguage: 'en' | 'de' | 'ar'
	setDisplayLanguage: (value: 'en' | 'de' | 'ar') => void
	isLoading: boolean
	hasChanges: boolean
	setHasChanges: (value: boolean) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(
	undefined,
)

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { data: userSettings, isLoading } = useGetUserSettingsQuery()
	const [productsPerPage, setProductsPerPageState] = useState<number>(20)
	const [displayLanguage, setDisplayLanguageState] = useState<'en' | 'de' | 'ar'>('en')
	const [hasChanges, setHasChanges] = useState(false)

	// Initialize from fetched settings
	useEffect(() => {
		if (userSettings) {
			setProductsPerPageState(userSettings.productsPerPage || 20)
			setDisplayLanguageState(userSettings.displayLanguage || 'en')
			if (i18n.resolvedLanguage !== userSettings.displayLanguage) {
				void i18n.changeLanguage(userSettings.displayLanguage || 'en')
			}
		}
	}, [userSettings])

	const setProductsPerPage = (value: number) => {
		setProductsPerPageState(value)
		setHasChanges(true)
	}

	const setDisplayLanguage = (value: 'en' | 'de' | 'ar') => {
		setDisplayLanguageState(value)
		setHasChanges(true)
	}

	return (
		<SettingsContext.Provider
			value={{
				productsPerPage,
				setProductsPerPage,
				displayLanguage,
				setDisplayLanguage,
				isLoading,
				hasChanges,
				setHasChanges,
			}}
		>
			{children}
		</SettingsContext.Provider>
	)
}

export const useSettings = () => {
	const context = useContext(SettingsContext)
	if (!context) {
		throw new Error('useSettings must be used within SettingsProvider')
	}
	return context
}
