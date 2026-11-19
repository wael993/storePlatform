import { describe, expect, it } from 'vitest'

import { formatBackupSize, scheduleTime } from '../shared/backup'

describe('backup display helpers', () => {
	it('shows a daily cron as HH:MM and anything else unchanged', () => {
		expect(scheduleTime('0 3 * * *')).toBe('03:00')
		expect(scheduleTime('30 23 * * *')).toBe('23:30')
		expect(scheduleTime('*/5 * * * *')).toBe('*/5 * * * *')
	})

	it('formats sizes', () => {
		expect(formatBackupSize(null)).toBe('-')
		expect(formatBackupSize(200)).toBe('1 KB')
		expect(formatBackupSize(506282)).toBe('494 KB')
		expect(formatBackupSize(5 * 1024 * 1024)).toBe('5.0 MB')
	})
})
