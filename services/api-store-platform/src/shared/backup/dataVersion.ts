import express from 'express'

import { bumpDataVersion } from '../../db/repos/backups'
import logger from '../logger/logger'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** 4xx = request rejected before writing; 2xx/3xx and 5xx (possible partial write) count as changes. */
export const isTenantDataChange = (
	method: string,
	path: string,
	statusCode: number,
): boolean =>
	WRITE_METHODS.has(method.toUpperCase()) &&
	!path.startsWith('/api/data/backup') &&
	(statusCode < 400 || statusCode >= 500)

/**
 * Bumps the tenant's dataVersion once per mutating request (one business operation),
 * covering every controller and sync replay without touching each write site.
 * `tenantId` is set by ActivityAuthorization, so unauthenticated requests never bump.
 * shortcut: bump is after commit, not inside the business transaction; a crash between the two
 * misses one bump (the next write fixes it). Writes from scripts/crons do not bump.
 */
export const bumpTenantDataVersion: express.RequestHandler = (
	request,
	response,
	next,
) => {
	const { method, path } = request

	response.on('finish', () => {
		const tenantId = (request as { tenantId?: string }).tenantId

		if (tenantId && isTenantDataChange(method, path, response.statusCode)) {
			bumpDataVersion(tenantId).catch(error =>
				logger.error(
					`dataVersion bump failed for tenant ${tenantId}: ${error}`,
				),
			)
		}
	})

	next()
}
