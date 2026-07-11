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
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		logger.info('Connected successfully to DB', {
			entity: EntityType.MONGODB,
			databaseName: config.mongoDB.databaseName,
		})

		console.log(
			`✅ MongoDB Connected: ${mongoose.connection.host} (${mongoose.connection.name})`,
		)
	} catch (error) {
		try {
			const controller = new AbortController()

			const timeoutId = setTimeout(() => {
				controller.abort()
			}, 3000)

			const response = await fetch('https://www.google.com', {
				method: 'HEAD',
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				console.error('❌ MongoDB Connection Error: No internet connection.')
			} else {
				console.error(
					`❌ MongoDB Connection Error: ${(error as Error).message}`,
				)
			}
		} catch {
			console.error('❌ MongoDB Connection Error: No internet connection.')
		}

		process.exit(1)
	}
}

export default connectDB
