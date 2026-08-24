import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		setupFiles: './src/test/setup.ts',
		include: ['src/test/**/*.test.ts'],
		allowOnly: false,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: [
				'src/app.ts',
				'src/shared/invoiceNumbering.ts',
				'src/shared/productSearch.ts',
				'src/shared/seeCatalog.ts',
			],
		},
	},
})
