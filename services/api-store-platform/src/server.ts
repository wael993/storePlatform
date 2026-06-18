import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import connectDB from './db/db'
import { config } from './config/config'
import { errorHandler } from './middleware/errorHandler'
import ProductController from './apis/api.controller'
import StoreRoutes from './apis/api.routes'
import MongodbController from './shared/mongodb/mongodbController'
import ProductsMapper from './apis/mappings/ProductsMapper'
import { startTokenCleanupCron } from './cron/cleanExpiredTokens'
import { redisCache } from './shared/cache/redisCache'
import logger, { EntityType } from './shared/logger/logger'

const mongoDbClient = new MongodbController()
const productsMapper = new ProductsMapper()

const productController = new ProductController(productsMapper, mongoDbClient)
const storeRoutes = new StoreRoutes(productController)
const app = express()

app.use(express.json())
app.use(cookieParser())

app.use(
	cors({
		origin: process.env.FRONTEND_URL || 'http://localhost:3000',
		credentials: true,
	}),
)
app.use(errorHandler)

connectDB()
if (config.redis.enabled) {
	redisCache.connect().catch(() => undefined)
}
const cacheMetricsInterval = setInterval(() => {
	const stats = redisCache.getStats()
	logger.info(
		`[cache-metrics] ready=${stats.ready} hits=${stats.hits} misses=${stats.misses} sets=${stats.sets} dels=${stats.dels} errors=${stats.errors}`,
		{ entity: EntityType.STORAGE },
	)
}, 60_000)
cacheMetricsInterval.unref()

startTokenCleanupCron()

storeRoutes.setRoutes(app)

const gracefulShutdown = async () => {
	logger.info('Shutting down server...')
	clearInterval(cacheMetricsInterval)
	await redisCache.disconnect()
	process.exit(0)
}

process.on('SIGINT', gracefulShutdown) // For Ctrl+C shutdown
process.on('SIGTERM', gracefulShutdown) // For termination signal (e.g., from a process manager)

app.listen(config.port, () =>
	logger.info(`Server running on port ${config.port}`),
)
