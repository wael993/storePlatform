import {
	ChangeStream,
	ChangeStreamDocument,
	Db,
	Document,
	MongoClient,
	FindOptions,
	Filter,
	Sort,
} from 'mongodb'
import logger, { EntityType } from '../logger/logger'
import { config } from '../../config/config'
import { DocumentError } from '../errors'
import { ERROR_CODES } from '../errorCodes'
import { COLLECTION_NAMES } from '../general'
import { RequestContext } from '../types'
import { TenantResource } from '../tenant'
import {
	createDocument as createDocumentAction,
	deleteDocument as deleteDocumentAction,
	EntityModel,
	getDocumentByField as getDocumentByFieldAction,
	listDocuments as listDocumentsAction,
	updateDocument as updateDocumentAction,
} from './documentActions'
import {
	deleteTenantUser as deleteTenantUserAction,
	updateTenantUser as updateTenantUserAction,
} from './tenantUserActions'
import { IUser } from '../../models/User'
import { UpdateTenantUserRequestBody } from '../types'
interface DocumentReadOperationResponse {
	id?: string[]
	documents: any[]
	error?: RequestError
}

interface RequestError {
	message: string
	errorCode: string
	hint?: string
}
interface AuthContext {
	username: string
	password: string
}
interface GetDocumentsContext<T> {
	collectionName: string
	fields?: object
	filter: Filter<T>
	pagination?: { skip?: number; limit?: number }
	sort?: Sort
}
type Maybe<T> = T | undefined
interface CreateDocumentContext {
	collectionName: TenantResource
	data: any
}

interface UpdateDocumentContext {
	collectionName: TenantResource
	id: string
}
interface DeleteDocumentContext {
	collectionName: TenantResource
	id: string
}

export default class MongodbController {
	private readonly url: string = config.mongoDB.connectionString
	private readonly authContext: AuthContext = {
		username: config.mongoDB.authContext.username,
		password: config.mongoDB.authContext.password,
	}
	private readonly databaseName: string = config.mongoDB.databaseName

	public client: Maybe<MongoClient>
	public db: Maybe<Db>
	private changeWatcher!:
		| ChangeStream<Document, ChangeStreamDocument<Document>>
		| undefined

	private defaultHint =
		'Please make sure all of the data you are requesting do exist. If you are sure that they should exist, please consult one of the developers'

	private async checkConnection(): Promise<void> {
		if (!this.db) {
			await this.initMongoDbController()
		}
	}

	public async isConnected(): Promise<boolean> {
		try {
			const result = await this.db?.admin().ping()

			return result?.ok === 1
		} catch {
			return false
		}
	}

	private async initChangeStream() {
		// This check allows developers to work with a local database instead of port-forwarding the current deployed one.
		if (!this.db) return
		if (
			(config.environment === 'dev' || config.environment === 'local') &&
			process.env.USING_LOCAL_DB === 'true'
		)
			return

		logger.info('Init ChangeStream', { entity: EntityType.MONGODB })
		try {
			const pipeline = [
				{
					$match: {
						'ns.coll': {
							$nin: [
								// COLLECTION_NAMES.AUDIT_LOG,
								COLLECTION_NAMES.PRODUCTS,
							],
						},
					},
				},
			]

			this.changeWatcher = this.db.watch(pipeline, {
				fullDocument: 'updateLookup',
			})

			while (!this.changeWatcher.closed) {
				let next = await this.changeWatcher.tryNext().catch(e => {
					logger.error('ChangeStream error, try connect again: ' + e, {
						entity: EntityType.MONGODB,
					})

					this.changeWatcher =
						this.db &&
						this.db.watch(pipeline, {
							fullDocument: 'updateLookup',
						})
				})

				while (next !== null && next !== undefined) {
					const collection = this.db?.collection(COLLECTION_NAMES.PRODUCTS)

					collection
						.updateOne(
							{
								_id: <Document>next._id,
							},
							{ $setOnInsert: next },
							{ upsert: true },
						)
						.catch(error =>
							logger.error(
								`Error while updating the ${COLLECTION_NAMES.PRODUCTS}: ${error}`,
								{ entity: EntityType.MONGODB },
							),
						)

					next = await this.changeWatcher.tryNext()
				}
			}
		} catch (error) {
			logger.error('ChangeStream lost connection', {
				entity: EntityType.MONGODB,
			})
		}
	}

	public async initMongoDbController(): Promise<boolean> {
		try {
			logger.debug('Trying to connect to DB with DB: ' + this.databaseName, {
				entity: EntityType.MONGODB,
			})

			this.client = new MongoClient(this.url, {
				auth: this.authContext,
				connectTimeoutMS: 300,
				heartbeatFrequencyMS: 1000,
			})

			await this.client.connect()
			this.db = this.client.db(this.databaseName)

			// this.initChangeStream()
			if (config.enableChangeStream) {
				this.initChangeStream()
			}
			logger.info('Connected successfully to DB', {
				entity: EntityType.MONGODB,
			})

			return true
		} catch (error) {
			logger.error('Can not connect to DB', { entity: EntityType.MONGODB })
			logger.debug(`DB connection error: ${error}`, {
				entity: EntityType.MONGODB,
			})

			return false
		}
	}

	public async listDocuments<T>(
		requestContext: RequestContext,
		resource: TenantResource,
		model: EntityModel,
		sort: Record<string, 1 | -1>,
	): Promise<T[]> {
		const startTime = new Date().getTime()

		try {
			await this.checkConnection()

			const result = await listDocumentsAction<T>(
				requestContext,
				resource,
				model,
				sort,
			)
			console.log('🚀 ~ MongodbController ~ listDocuments ~ result:', result)

			logger.debug(`List documents for resource: ${resource}`, {
				entity: EntityType.MONGODB,
				userId: requestContext.userId,
				sort,
			})

			return result
		} catch (error: any) {
			logger.error(
				`Error listing documents for resource ${resource}: ${error?.message || error}`,
				{ entity: EntityType.MONGODB, userId: requestContext.userId },
			)

			throw error
		} finally {
			const endTime = new Date().getTime()

			logger.debug(`LIST ${resource}: ${endTime - startTime} ms`, {
				entity: EntityType.MONGODB,
			})
		}
	}

	public async getDocumentByField<T>(
		requestContext: RequestContext,
		resource: TenantResource,
		model: EntityModel,
		{ fieldName, fieldValue }: Record<string, string>,
	): Promise<T | null> {
		const startTime = new Date().getTime()

		try {
			await this.checkConnection()

			const result = await getDocumentByFieldAction<T>(
				requestContext,
				resource,
				model,
				{
					[fieldName]: fieldValue,
				},
			)

			logger.debug(
				`Get document by field for resource: ${resource}, field: ${fieldName}`,
				{
					entity: EntityType.MONGODB,
					userId: requestContext.userId,
					fieldName,
					fieldValue,
				},
			)

			return result
		} catch (error: any) {
			logger.error(
				`Error getting document by field for resource ${resource}, field ${fieldName}: ${error?.message || error}`,
				{
					entity: EntityType.MONGODB,
					userId: requestContext.userId,
					fieldName,
					fieldValue,
				},
			)

			throw error
		} finally {
			const endTime = new Date().getTime()

			logger.debug(`READ_ONE ${resource}: ${endTime - startTime} ms`, {
				entity: EntityType.MONGODB,
			})
		}
	}

	public async createDocument(
		{ collectionName, data }: CreateDocumentContext,
		model: EntityModel,
		requestContext: RequestContext,
	): Promise<{ _id: string }> {
		logger.debug(`Creating document for resource: ${collectionName}`, {
			entity: EntityType.MONGODB,
			userId: requestContext.userId,
			data,
		})

		const result = await createDocumentAction(
			requestContext,
			collectionName,
			model,
			data,
		)

		logger.debug(
			`Created document for resource: ${collectionName} with id: ${result._id}`,
			{
				entity: EntityType.MONGODB,
				result,
			},
		)

		return result
	}

	public async updateDocument(
		{ collectionName, id }: UpdateDocumentContext,
		requestContext: RequestContext,
		model: EntityModel,
		payload: Record<string, unknown>,
	) {
		return updateDocumentAction(
			requestContext,
			collectionName,
			model,
			id,
			payload,
		)
	}

	public async deleteDocument(
		{ collectionName, id }: DeleteDocumentContext,
		requestContext: RequestContext,
		model: EntityModel,
	) {
		return deleteDocumentAction(requestContext, collectionName, model, id)
	}

	public async updateTenantUser(
		userId: string,
		requestBody: UpdateTenantUserRequestBody,
		requestContext: RequestContext,
	): Promise<IUser> {
		return updateTenantUserAction(userId, requestBody, requestContext)
	}

	public async deleteTenantUser(
		userId: string,
		requestContext: RequestContext,
	): Promise<void> {
		return deleteTenantUserAction(userId, requestContext)
	}
}
