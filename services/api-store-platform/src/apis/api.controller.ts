import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { config } from '../config/config'
import express, { NextFunction, request } from 'express'

import {
	BusinessLogicError,
	AuthorizationError,
	AuthenticationError,
} from '../middleware/errorHandler'
import { Product } from '../models/Products'
import User from '../models/User'
import { COLLECTION_NAMES } from '../shared/constants.ts/general'
import { ERROR_CODES } from '../shared/errorCodes'
import logger from '../shared/logger/logger'
import MongodbController from '../shared/mongodb/mongodbController'
import {
	CreateProductResponse,
	ProductDocument,
	ProductRequestBody,
	RequestContext,
} from '../shared/types'
import { ObjectId, Sort, type Filter } from 'mongodb'
import { LoginData, LoginRequestBody } from '../shared/types/api'
import { v4 as uuidv4 } from 'uuid'
import ProductsMapper from './mappings/ProductsMapper'

interface UserAPIFormat {
	_id: string
	displayName: string
	businessPartnerId?: string
	isInternal?: boolean
	avatarColorId?: number
}

interface APIResponse<T> {
	totalCount: number
	data: T[]
}
interface ProductResponse extends APIResponse<Comment> { }

export default class ProductController {
	constructor(
		private productsMapper: ProductsMapper,
		private mongoDbClient: MongodbController,
	) { }

	public async getProducts(requestContext: RequestContext) {
		const filter: Filter<ProductDocument> = {}

		try {
			const data = await Product.find().sort({ name: 1 }).lean()

			return data
		} catch (error) {
			logger.error('Error fetching products:', error)
			throw error
		}
	}
	public async validateUser(request: any, token: string) {
		const decoded = jwt.verify(token, config.jwtSecure)

		const user = (request.user = decoded)

		return user
	}

	public async login(requestBody: LoginData) {
		const { email: loginEmail, password: loginPassword } = requestBody

		if (!loginEmail || !loginPassword) {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'Email or password missing',
			)
		}

		const user = await User.findOne({ email: loginEmail }).lean()

		if (!user) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'User not found',
			)
		}

		const isValid = await bcrypt.compare(loginPassword, user.password)

		if (!isValid) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'Invalid credentials',
			)
		}

		if (!config.jwtSecure || !config.refreshSecret) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'Server configuration error',
			)
		}

		const accessToken = jwt.sign(
			{ userId: user._id, role: user.role },
			config.jwtSecure,
			{ expiresIn: '15m' },
		)

		const refreshToken = jwt.sign(
			{ userId: user._id },
			config.refreshSecret,
			{ expiresIn: '7d' },
		)

		return {
			accessToken,
			refreshToken,
			userId: user._id,
			email: user.email,
			role: user.role,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
			isInternal: user.user.isInternal,
		}
	}


	public async refresh(req: express.Request) {
		const token = req.cookies?.refreshToken

		if (!token) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'No refresh token',
			)
		}

		try {
			const payload = jwt.verify(token, config.refreshSecret as string) as jwt.JwtPayload

			const user = await User.findById(payload.userId).lean()

			if (!user) {
				throw new AuthenticationError(
					ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
					'User not found',
				)
			}

			const accessToken = jwt.sign(
				{ userId: user._id, role: user.role },
				config.jwtSecure as string,
				{ expiresIn: '15m' },
			)

			const newRefreshToken = jwt.sign(
				{ userId: user._id },
				config.refreshSecret as string,
				{ expiresIn: '7d' },
			)

			return { accessToken, refreshToken: newRefreshToken }
		} catch (error) {
			if (error instanceof AuthenticationError) throw error

			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'Invalid refresh token',
			)
		}
	}

	public async getProduct(
		productId: string,
		requestContext: RequestContext,
	): Promise<ProductRequestBody | null> {
		try {
			const product = await Product.findOne({ barcode: productId }).lean()
			if (!product) {
				logger.warn(`Product not found: ${productId}`)
				return null
			}
			const mappedProduct: ProductRequestBody = this.productsMapper.mapProduct(
				product,
				requestContext,
			)

			return mappedProduct
		} catch (error) {
			logger.error(`Error fetching product ${productId}:`, error)
			throw error
		}
	}

	public async postProduct(
		requestBody: ProductRequestBody,
		requestContext: RequestContext,
	): Promise<CreateProductResponse | null> {
		const productId = uuidv4()

		const { barcode, count, id, name, price, description } = requestBody
		const product = await Product.findOne({ name }).lean()
		if (product && name === product.name)
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product already existed',
			)
		console.log(
			'🚀 ~ ProductController ~ postProduct ~ requestContext:',
			requestContext,
		)
		const createdBy = {
			_id: requestContext.userId as string,
			displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
			isInternal: requestContext.user?.isInternal,
		}
		console.log('🚀 ~ ProductController ~ postProduct ~ createdBy:', createdBy)
		const createdAt = new Date()
		const productData: ProductDocument = {
			productId: productId,
			id,
			name,
			barcode,
			price,
			count,
			createdBy,
			createdAt,
			description,
		}
		const createProductResponse = await Product.create(productData)

		if (!createProductResponse) {
			logger.warn(`Product not created: ${productId}`)
			return null
		}

		logger.info(`Product crested: ${productId}`)
		return { _id: createProductResponse.id }
	}

	public async getUser(userId: string) {
		try {
			const user = await Product.findOne({ id: userId }).lean()
			if (!user) {
				logger.warn(`User not found: ${userId}`)
				return null
			}
			return user
		} catch (error) {
			logger.error(`Error fetching user ${userId}:`, error)
			throw error
		}
	}

	public async patchProduct(
		productId: string,
		requestBody: Partial<Omit<ProductDocument, '_id'>>,
		requestContext: RequestContext,
	) {
		try {
			const productToUpdate = this.getProduct(productId, requestContext)

			if (!productToUpdate) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Product not found',
				)
			}
			const fieldsToUpdate = Object.keys(requestBody)

			// Prevent _id/id updates
			const { id, ...allowedUpdates } = requestBody

			if (Object.keys(allowedUpdates).length === 0) {
				throw new Error('No valid fields to update')
			}

			const updatedProduct = await Product.findOneAndUpdate(
				{ id: productId },
				{ $set: allowedUpdates },
				{ new: true, runValidators: true },
			).lean()

			if (!updatedProduct) {
				logger.warn(`Product not found for update: ${productId}`)
				return null
			}

			logger.info(`Product updated: ${productId}`, { changes: allowedUpdates })
			return updatedProduct
		} catch (error) {
			logger.error(`Error updating product ${productId}:`, error)
			throw error
		}
	}
}
