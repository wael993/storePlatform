// note: static regex scan — misses dynamic t(`key.${x}`); upgrade path: AST or i18n-parser
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(__dirname, '..')
const srcDir = join(frontendRoot, 'src')
const localesDir = join(srcDir, 'i18n')
const localeFiles = ['en', 'de', 'ar'].map(locale => ({
	locale,
	path: join(localesDir, locale, 'translation.json'),
}))

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*$/

const SOURCE_PATTERNS = [
	/\bt\(\s*['"]([^'"]+)['"]/g,
	/\bi18n\.t\(\s*['"]([^'"]+)['"]/g,
	/(?:labelKey|translationKey|titleKey|descriptionKey|errorKey)\s*:\s*['"]([^'"]+)['"]/g,
]

const stripComments = content =>
	content
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1')

const walkFiles = (dir, files = []) => {
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry)
		const stats = statSync(fullPath)
		if (stats.isDirectory()) {
			if (entry === 'i18n' || entry === 'test') continue
			walkFiles(fullPath, files)
			continue
		}
		if (/\.(ts|tsx)$/.test(entry)) {
			files.push(fullPath)
		}
	}
	return files
}

const flattenTranslationKeys = (value, prefix = '') => {
	const keys = new Map()
	if (value == null || typeof value !== 'object' || Array.isArray(value)) {
		return keys
	}

	for (const [key, nested] of Object.entries(value)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		const isLeaf =
			nested == null ||
			typeof nested !== 'object' ||
			Array.isArray(nested)

		if (isLeaf) {
			keys.set(fullKey, 'leaf')
		} else {
			keys.set(fullKey, 'branch')
			for (const [childKey, childKind] of flattenTranslationKeys(
				nested,
				fullKey,
			)) {
				keys.set(childKey, childKind)
			}
		}
	}

	return keys
}

const findDuplicateKeysInRawJson = (raw, filePath) => {
	const duplicates = []
	const stack = [new Set()]

	for (let index = 0; index < raw.length; index += 1) {
		const char = raw[index]
		if (char === '{') {
			stack.push(new Set())
			continue
		}
		if (char === '}') {
			if (stack.length > 1) stack.pop()
			continue
		}
		if (char !== '"') continue

		let cursor = index + 1
		let key = ''
		while (cursor < raw.length) {
			const next = raw[cursor]
			if (next === '\\') {
				key += raw[cursor + 1] ?? ''
				cursor += 2
				continue
			}
			if (next === '"') break
			key += next
			cursor += 1
		}

		const afterKey = raw.slice(cursor + 1).trimStart()
		if (!afterKey.startsWith(':')) {
			index = cursor
			continue
		}

		const current = stack[stack.length - 1]
		if (current?.has(key)) {
			duplicates.push(`${filePath}: duplicate key "${key}"`)
		} else {
			current?.add(key)
		}
		index = cursor
	}

	return duplicates
}

const collectUsedKeys = sourceFiles => {
	const used = new Set()
	for (const filePath of sourceFiles) {
		const content = stripComments(readFileSync(filePath, 'utf8'))
		for (const pattern of SOURCE_PATTERNS) {
			pattern.lastIndex = 0
			for (const match of content.matchAll(pattern)) {
				const key = match[1]?.trim()
				if (key) used.add(key)
			}
		}
	}
	return used
}

const strictUnused = process.argv.includes('--strict-unused')

const errors = []
const warnings = []

const localeKeys = new Map()
for (const { locale, path } of localeFiles) {
	const raw = readFileSync(path, 'utf8')
	errors.push(...findDuplicateKeysInRawJson(raw, path))

	let parsed
	try {
		parsed = JSON.parse(raw)
	} catch (error) {
		errors.push(`${path}: invalid JSON (${error.message})`)
		continue
	}

	const keys = flattenTranslationKeys(parsed)
	localeKeys.set(locale, keys)

	for (const key of keys.keys()) {
		if (!KEY_PATTERN.test(key)) {
			errors.push(`${path}: invalid translation key "${key}"`)
		}
	}
}

const referenceLocale = 'en'
const referenceKeys = localeKeys.get(referenceLocale)
if (!referenceKeys) {
	errors.push(`Missing reference locale: ${referenceLocale}`)
} else {
	for (const { locale, path } of localeFiles) {
		if (locale === referenceLocale) continue
		const keys = localeKeys.get(locale)
		if (!keys) continue

		for (const key of referenceKeys.keys()) {
			if (!keys.has(key)) {
				errors.push(`${path}: missing translation for "${key}"`)
			}
		}
		for (const key of keys.keys()) {
			if (!referenceKeys.has(key)) {
				errors.push(
					`${path}: extra translation key not in ${referenceLocale}: "${key}"`,
				)
			}
		}
	}
}

const usedKeys = collectUsedKeys(walkFiles(srcDir))
for (const key of usedKeys) {
	if (!KEY_PATTERN.test(key)) {
		errors.push(`source: invalid translation key "${key}"`)
		continue
	}
	if (!referenceKeys?.has(key)) {
		errors.push(`source: missing translation for "${key}"`)
	}
}

if (referenceKeys) {
	for (const [key, kind] of referenceKeys) {
		if (kind !== 'leaf' || usedKeys.has(key)) continue
		const message = `unused translation key: "${key}"`
		if (strictUnused) {
			errors.push(message)
		} else {
			warnings.push(message)
		}
	}
}

if (warnings.length > 0) {
	console.warn('Translation warnings:')
	for (const warning of warnings) {
		console.warn(`  - ${warning}`)
	}
}

if (errors.length > 0) {
	console.error('Translation check failed:')
	for (const error of errors) {
		console.error(`  - ${error}`)
	}
	process.exit(1)
}

console.log(
	`Translation check passed (${referenceKeys?.size ?? 0} keys, ${usedKeys.size} used in source, ${warnings.length} unused).`,
)
