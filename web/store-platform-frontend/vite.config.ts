/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'store-domain': path.resolve(__dirname, '../../packages/store-domain/src'),
		},
	},
	server: {
		port: 3000,
	},
	preview: {
		port: 3000,
	},
	test: {
		environment: 'jsdom',
		setupFiles: './src/test/setup.ts',
		include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
		allowOnly: false,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: [
				'src/pages/Login.tsx',
				'src/shared/hooks/useResources.ts',
				'src/components/SellingInvoice/cashBalance.ts',
			],
		},
	},
})
