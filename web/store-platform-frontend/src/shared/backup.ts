export const DEFAULT_BACKUP_RETENTION = 3
export const MAX_BACKUP_RETENTION = 30

/** "M H * * *" → "HH:MM"; any other cron expression is shown as-is. */
export const scheduleTime = (cron: string): string => {
	const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(cron.trim())

	return match
		? `${match[2].padStart(2, '0')}:${match[1].padStart(2, '0')}`
		: cron
}

export const formatBackupSize = (bytes: number | null): string => {
	if (bytes === null) return '-'
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`

	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
