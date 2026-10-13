import { routes, type VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
	framework: 'vite',
	buildCommand: 'npm run build',
	outputDirectory: 'dist',
	headers: [
		routes.cacheControl(
			'/((?!assets/|api/|fonts/)(?!.*\\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$).*)',
			{ noCache: true },
		),
		routes.cacheControl('/assets/(.*)', {
			public: true,
			maxAge: '365days',
			immutable: true,
		}),
		routes.cacheControl(
			'/((?!assets/|api/).*)\\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)',
			{
				public: true,
				maxAge: '365days',
				immutable: true,
			},
		),
	],
	rewrites: [
		routes.rewrite(
			'/api/data/:path*',
			`${process.env.API_ORIGIN}/api/data/:path*`,
		),
		routes.rewrite('/(.*)', '/index.html'),
	],
}
