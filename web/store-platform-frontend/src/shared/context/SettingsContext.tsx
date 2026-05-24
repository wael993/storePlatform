import React, { createContext, useContext, useState, useEffect } from 'react'

interface SettingsContextType {
	productsPerPage: number
	setProductsPerPage: (value: number) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(
	undefined,
)

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [productsPerPage, setProductsPerPageState] = useState<number>(20)

	// Load from localStorage on mount
	useEffect(() => {
		const saved = localStorage.getItem('productsPerPage')
		if (saved) {
			const value = parseInt(saved, 10)
			if (!isNaN(value)) {
				setProductsPerPageState(value)
			}
		}
	}, [])

	const setProductsPerPage = (value: number) => {
		setProductsPerPageState(value)
		localStorage.setItem('productsPerPage', value.toString())
	}

	return (
		<SettingsContext.Provider value={{ productsPerPage, setProductsPerPage }}>
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
