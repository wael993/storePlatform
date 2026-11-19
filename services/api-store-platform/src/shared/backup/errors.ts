/**
 * Classified failure. `code` is safe to show customers (mapped to text in the UI);
 * `message` is internal and only logged / stored on the backup record.
 */
export class BackupError extends Error {
	public constructor(
		public readonly code: string,
		message: string,
	) {
		super(message)
		this.name = 'BackupError'
	}
}

export const backupErrorCode = (error: unknown, fallback: string): string =>
	error instanceof BackupError ? error.code : fallback
