import { createLogger, format, transports } from 'winston'
import { config } from '../../config/config'
import { TransformableInfo } from 'logform'

const { combine, timestamp, printf } = format

// one readable line per entry: "2026-11-20 08:53:58 INFO  [STORAGE] (E123) message"
const printFn = printf((info: TransformableInfo) => {
	const { level, message, errorCode, timestamp: logTimestamp, entity } = info

	return [
		logTimestamp,
		level.toUpperCase().padEnd(5),
		entity ? `[${entity}]` : '',
		errorCode ? `(${errorCode})` : '',
		message,
	]
		.filter(Boolean)
		.join(' ')
})
const logFormat = combine(
	timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	printFn,
	config.environment === 'dev' ? format.colorize() : format.uncolorize(),
)
const consoleTransports = [
	new transports.Console({
		format: logFormat,
	}),
]

const logger = createLogger({
	level: config.logLevel.toLowerCase(),
	format: logFormat,
	defaultMeta: { service: 'api-marketing-platform' },
	silent: process.env.NODE_ENV === 'test',
	transports: consoleTransports,
})

export enum EntityType {
	AUTHORIZATION = 'AUTHORIZATION',
	STORAGE = 'STORAGE_SERVICE',
	MONGODB = 'MONGO_DB',
	PRODUCTS = 'PRODUCTS',
	API = 'API',
}

export default logger
