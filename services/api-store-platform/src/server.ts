import express from 'express'
import cors from 'cors'
import connectDB from './db/db'
import { config } from './config/config'
import { errorHandler } from './middleware/errorHandler' // Import the function
import ProductController from './apis/api.controller'
import StoreRoutes from './apis/api.routes'
import MongodbController from './shared/mongodb/mongodbController'
import ProductsMapper from './apis/mappings/ProductsMapper'

const mongoDbClient = new MongodbController()
const productsMapper = new ProductsMapper()

const productController = new ProductController(productsMapper, mongoDbClient)
const storeRoutes = new StoreRoutes(productController)
const app = express()

app.use(express.json())

app.use(
	cors({
		origin: 'http://localhost:3000',
		credentials: true,
	}),
)
app.use(errorHandler)

connectDB()

// console.log('test');
storeRoutes.setRoutes(app)

// PlatformRoutes.setRoutes(app)
// storeRoutes.setRoutes(app)

//app.use( PlatformRoutes);

const gracefulShutdown = () => {
	console.log('Shutting down server...')
	process.exit(0)
}

process.on('SIGINT', gracefulShutdown) // For Ctrl+C shutdown
process.on('SIGTERM', gracefulShutdown) // For termination signal (e.g., from a process manager)

app.listen(config.port, () =>
	console.log(`Server running on port ${config.port}`),
)
