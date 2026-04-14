import express from 'express'
import logger from './logger/logger'

export const logIncomingRequests = (
	request: any,
	_: express.Response,
	next: express.NextFunction,
) => {
	logger.info(`Received ${request.method} request to ${request.url}`)
	next()
}
