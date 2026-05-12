import mongoose from 'mongoose'
import { config } from '../config/config'

const STALE_INDEXES: Record<string, string[]> = {
	products: ['id_1', 'tenantId_1_id_1'],
}

async function dropStaleIndexes() {
	await mongoose.connect(config.mongoDB.connectionString)
	console.log('Connected to MongoDB')

	for (const [collectionName, indexes] of Object.entries(STALE_INDEXES)) {
		const collection = mongoose.connection.collection(collectionName)

		const existingIndexes = await collection.indexes()
		const existingNames = existingIndexes.map(i => i.name as string)

		for (const indexName of indexes) {
			if (!existingNames.includes(indexName)) {
				console.log(
					`Index "${indexName}" not found on "${collectionName}" — skipping.`,
				)
				continue
			}

			await collection.dropIndex(indexName)
			console.log(
				`Dropped stale index "${indexName}" from "${collectionName}".`,
			)
		}
	}

	await mongoose.disconnect()
	console.log('Done.')
}

dropStaleIndexes().catch(err => {
	console.error('Migration failed:', err)
	process.exit(1)
})
