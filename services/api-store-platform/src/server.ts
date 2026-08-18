import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import connectDB from './db/db'
import { config } from './config/config'
import { errorHandler } from './middleware/errorHandler'
import ProductController from './apis/api.controller'
import CustomerController from './apis/customer/api.controller'
import CustomerRoutes from './apis/customer/api.routes'
import SupplierController from './apis/supplier/api.controller'
import SupplierRoutes from './apis/supplier/api.routes'
import CategoryController from './apis/category/api.controller'
import CategoryRoutes from './apis/category/api.routes'
import PartnerController from './apis/partner/api.controller'
import PartnerRoutes from './apis/partner/api.routes'
import SettingController from './apis/setting/api.controller'
import SettingRoutes from './apis/setting/api.routes'
import StoreRoutes from './apis/api.routes'
import MongodbController from './shared/mongodb/mongodbController'
import ProductsMapper from './apis/mappings/ProductsMapper'
import { startTokenCleanupCron } from './cron/cleanExpiredTokens'
import { redisCache } from './shared/cache/redisCache'
import logger, { EntityType } from './shared/logger/logger'

const mongoDbClient = new MongodbController()
const productsMapper = new ProductsMapper()

const productController = new ProductController(productsMapper, mongoDbClient)
const customerController = new CustomerController(
	mongoDbClient,
	productController,
)

productController.setCustomerController(customerController)

const supplierController = new SupplierController(
	mongoDbClient,
	productController,
)

productController.setSupplierController(supplierController)

const categoryController = new CategoryController(mongoDbClient)

productController.setCategoryController(categoryController)

const partnerController = new PartnerController(
	mongoDbClient,
	productController,
)

productController.setPartnerController(partnerController)

const settingController = new SettingController(productController)

productController.setSettingController(settingController)

const customerRoutes = new CustomerRoutes(customerController, productController)
const supplierRoutes = new SupplierRoutes(supplierController, productController)
const categoryRoutes = new CategoryRoutes(categoryController, productController)
const partnerRoutes = new PartnerRoutes(partnerController, productController)
const settingRoutes = new SettingRoutes(settingController, productController)
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

connectDB()
if (config.redis.enabled) {
	redisCache.connect().catch(() => undefined)
} else {
	logger.info(
		'Redis cache not enabled (set REDIS_ENABLED=true with REDIS_HOST and REDIS_PASSWORD)',
		{ entity: EntityType.STORAGE },
	)
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

customerRoutes.setRoutes(app)
supplierRoutes.setRoutes(app)
categoryRoutes.setRoutes(app)
partnerRoutes.setRoutes(app)
settingRoutes.setRoutes(app)
storeRoutes.setRoutes(app)

app.use(errorHandler)

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
