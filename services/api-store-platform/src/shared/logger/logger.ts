import { createLogger, format, transports } from 'winston'
import { config } from '../../config/config'
import { tracer } from 'dd-trace'
import { TransformableInfo } from 'logform'

const { combine, timestamp, printf } = format

const printFn = printf((info: TransformableInfo) => {
	const { level, message, errorCode, timestamp: logTimestamp, entity } = info

	if (config.environment === 'dev') {
		return `[${level}][${logTimestamp}][${errorCode ? `${errorCode}` : ''}]${
			entity ? `[${entity}]` : ''
		} ${message}`
	}

	const span = tracer.scope().active()
	const traceId = span ? span.context().toTraceId() : '0'
	const spanId = span ? span.context().toSpanId() : '0'

	return JSON.stringify({
		timestamp: logTimestamp,
		level,
		errorCode,
		message,
		dd: {
			trace_id: traceId,
			span_id: spanId,
		},
	})
})
const logFormat = combine(
	timestamp(),
	printFn,
	config.environment === 'local' ? format.colorize() : format.uncolorize(),
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
	ACTIVITIES = 'ACTIVITIES',
	AUTHORIZATION = 'AUTHORIZATION',
	STORAGE = 'STORAGE_SERVICE',
	MONGODB = 'MONGO_DB',
}

export default logger
