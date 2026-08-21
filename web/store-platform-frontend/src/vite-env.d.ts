/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_BUSINESS_PLATFORM_ENDPOINT?: string
	readonly VITE_ENVIRONMENT?: string
	readonly VITE_SERVICE_ID?: string
	readonly VITE_PERSISTENCE_SERVICE_ENDPOINT?: string
	readonly VITE_ACTIONS_ENABLED?: string
	readonly VITE_TENANT_ACTIONS_ENABLED?: string
}
