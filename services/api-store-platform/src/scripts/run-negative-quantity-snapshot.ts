/**
 * Fire the 03:00 snapshot now (does not wait for the schedule).
 * npm run cron:negative-quantity-snapshot
 */
import mongoose from 'mongoose'
import { config } from '../config/config'
import { runNegativeQuantitySnapshot } from '../cron/snapshotNegativeQuantity'
import { NegativeQuantitySnapshot } from '../models/NegativeQuantitySnapshot'

const run = async () => {
	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	await runNegativeQuantitySnapshot()

	console.log(
		'stored snapshots:',
		JSON.stringify(
			await NegativeQuantitySnapshot.collection
				.find(
					{},
					{
						projection: {
							tenantId: 1,
							type: 1,
							runAt: 1,
							count: 1,
							productIds: 1,
							_id: 0,
						},
					},
				)
				.toArray(),
			null,
			2,
		),
	)
}

run()
	.catch(error => {
		console.error(error)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())
