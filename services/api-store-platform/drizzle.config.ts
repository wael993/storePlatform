import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema/index.ts',
	out: './drizzle',
	casing: 'snake_case',
	schemaFilter: ['platform', 'store'],
	dbCredentials: {
		url:
			process.env.DATABASE_URL ??
			'postgres://postgres:postgres@127.0.0.1:5433/store_platform',
	},
})
