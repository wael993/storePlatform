/**
 * Fire the daily subscription lifecycle now (does not wait for the schedule).
 * npm run cron:subscription-lifecycle
 */
import mongoose from 'mongoose'
import { config } from '../config/config'
import { runSubscriptionLifecycle } from '../cron/manageSubscriptions'

const run = async () => {
	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	await runSubscriptionLifecycle()
}

run()
	.catch(error => {
		console.error(error)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())
