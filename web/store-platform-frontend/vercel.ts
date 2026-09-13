import { routes, type VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
	framework: 'vite',
	buildCommand: 'npm run build',
	outputDirectory: 'dist',
	rewrites: [
		routes.rewrite(
			'/api/data/:path*',
			`${process.env.API_ORIGIN}/api/data/:path*`,
		),
		routes.rewrite('/(.*)', '/index.html'),
	],
}
