import mongoose from 'mongoose'
import { config } from '../config/config'
import logger, { EntityType } from '../shared/logger/logger'

if (!config.mongoDB.connectionString) {
	throw new Error(
		'❌ MongoDB Connection Error: connectionString is not defined in environment variables.',
	)
}

const connectDB = async (): Promise<void> => {
	try {
		await mongoose.connect(config.mongoDB.connectionString)
		logger.info('Connected successfully to DB', {
			entity: EntityType.MONGODB,
		})
		console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`)
	} catch (error) {
		console.error(`❌ MongoDB Connection Error: ${(error as Error).message}`)
		process.exit(1)
	}
}

export default connectDB
