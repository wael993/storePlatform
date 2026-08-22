import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	SavedColumnConfig,
	useGetUserSettingsQuery,
	useUpdateUserSettingsMutation,
} from '../../../api/apiStore'
import {
	ColumnDef,
	ColumnLayout,
	defaultLayout,
	parseCols,
	pickerColumns as resolvePickerColumns,
	reorderColumns,
	serializeCols,
	toggleHidden,
	visibleColumns,
} from './layout'

type Session =
	| { kind: 'builtin' }
	| { kind: 'saved'; cols: string }
	| { kind: 'edited'; layout: ColumnLayout }

type ListColumnConfigContextValue = {
	listType: SavedColumnConfig['listType']
	pickerColumns: ColumnDef[]
	visibleColumns: ColumnDef[]
	isHidden: (id: string) => boolean
	toggle: (id: string) => void
	reorder: (fromId: string, toId: string) => void
	savedConfigs: SavedColumnConfig[]
	canSaveMore: boolean
	saveCurrent: (name: string) => Promise<void>
	loadConfig: (id: string) => Promise<void>
	renameConfig: (id: string, name: string) => Promise<void>
	overwriteConfig: (id: string) => Promise<void>
	deleteConfig: (id: string) => Promise<void>
	isSaving: boolean
	currentCols: string
}

const ListColumnConfigContext = createContext<
	ListColumnConfigContextValue | undefined
>(undefined)

export const MAX_SAVED_COLUMN_CONFIGS = 50

interface ListColumnConfigProviderProps {
	listType: SavedColumnConfig['listType']
	catalog: ColumnDef[]
	children: ReactNode
}

export const ListColumnConfigProvider = ({
	listType,
	catalog,
	children,
}: ListColumnConfigProviderProps) => {
	const { data: userSettings } = useGetUserSettingsQuery()
	const [updateUserSettings, { isLoading: isSaving }] =
		useUpdateUserSettingsMutation()
	const [session, setSession] = useState<Session>({ kind: 'builtin' })
	const [configs, setConfigs] = useState<SavedColumnConfig[] | undefined>()
	const configsRef = useRef<SavedColumnConfig[]>([])
	const hydratedRef = useRef(false)
	const persistLock = useRef(Promise.resolve())
	const didApplyDefault = useRef(false)

	useEffect(() => {
		if (hydratedRef.current || !userSettings) return
		const initial = userSettings.columnConfigs ?? []
		configsRef.current = initial
		hydratedRef.current = true
		setConfigs(initial)
	}, [userSettings])

	const allConfigs = configs ?? userSettings?.columnConfigs ?? []
	const savedConfigs = useMemo(
		() => allConfigs.filter(config => config.listType === listType),
		[allConfigs, listType],
	)

	useEffect(() => {
		if (didApplyDefault.current || !userSettings) return
		didApplyDefault.current = true
		const defaultConfig = savedConfigs.find(config => config.isDefault)
		if (defaultConfig) setSession({ kind: 'saved', cols: defaultConfig.cols })
	}, [userSettings, savedConfigs])

	const layout = useMemo(() => {
		if (session.kind === 'edited') return session.layout
		if (session.kind === 'saved') return parseCols(session.cols, catalog)
		return defaultLayout(catalog)
	}, [session, catalog])

	const pickerColumns = useMemo(
		() => resolvePickerColumns(layout, catalog),
		[layout, catalog],
	)
	const visible = useMemo(
		() => visibleColumns(layout, catalog),
		[layout, catalog],
	)
	const visibleIds = useMemo(
		() => new Set(visible.map(column => column.id)),
		[visible],
	)
	const currentCols = useMemo(
		() => serializeCols(layout, catalog),
		[catalog, layout],
	)

	const persist = useCallback(
		(mutate: (currentForType: SavedColumnConfig[]) => SavedColumnConfig[]) => {
			const run = persistLock.current.then(async () => {
				if (!hydratedRef.current) {
					throw new Error('Column configs not loaded')
				}
				const current = configsRef.current
				const nextForType = mutate(
					current.filter(config => config.listType === listType),
				)
				const next = [
					...current.filter(config => config.listType !== listType),
					...nextForType,
				]
				configsRef.current = next
				setConfigs(next)
				try {
					const result = await updateUserSettings({
						columnConfigs: next,
					}).unwrap()
					const confirmed = result.columnConfigs ?? next
					configsRef.current = confirmed
					setConfigs(confirmed)
				} catch (error) {
					if (configsRef.current === next) {
						configsRef.current = current
						setConfigs(current)
					}
					throw error
				}
			})
			persistLock.current = run.then(
				() => undefined,
				() => undefined,
			)
			return run
		},
		[listType, updateUserSettings],
	)

	const toggle = useCallback(
		(id: string) =>
			setSession({
				kind: 'edited',
				layout: toggleHidden(layout, id, catalog),
			}),
		[catalog, layout],
	)
	const reorder = useCallback(
		(fromId: string, toId: string) =>
			setSession({
				kind: 'edited',
				layout: reorderColumns(layout, fromId, toId, catalog),
			}),
		[catalog, layout],
	)
	const isHidden = useCallback(
		(id: string) => !visibleIds.has(id),
		[visibleIds],
	)

	const saveCurrent = useCallback(
		async (name: string) => {
			const trimmed = name.trim()
			if (!trimmed) return
			if (configsRef.current.length >= MAX_SAVED_COLUMN_CONFIGS) {
				throw new Error('limit')
			}
			const cols = serializeCols(layout, catalog)
			await persist(currentForType => [
				...currentForType.map(config => ({ ...config, isDefault: false })),
				{
					id: crypto.randomUUID(),
					listType,
					name: trimmed,
					cols,
					isDefault: true,
				},
			])
			setSession({ kind: 'saved', cols })
		},
		[catalog, layout, listType, persist],
	)

	const loadConfig = useCallback(
		async (id: string) => {
			let cols: string | undefined
			await persist(currentForType => {
				const config = currentForType.find(item => item.id === id)
				if (!config) return currentForType
				cols = config.cols
				return currentForType.map(item => ({
					...item,
					isDefault: item.id === id,
				}))
			})
			if (cols) setSession({ kind: 'saved', cols })
		},
		[persist],
	)

	const renameConfig = useCallback(
		async (id: string, name: string) => {
			const trimmed = name.trim()
			if (!trimmed) return
			await persist(currentForType =>
				currentForType.map(config =>
					config.id === id ? { ...config, name: trimmed } : config,
				),
			)
		},
		[persist],
	)

	const overwriteConfig = useCallback(
		async (id: string) => {
			const cols = serializeCols(layout, catalog)
			await persist(currentForType =>
				currentForType.map(config =>
					config.id === id ? { ...config, cols } : config,
				),
			)
			setSession({ kind: 'saved', cols })
		},
		[catalog, layout, persist],
	)

	const deleteConfig = useCallback(
		async (id: string) => {
			let removedDefault = false
			await persist(currentForType => {
				const removed = currentForType.find(config => config.id === id)
				removedDefault = Boolean(removed?.isDefault)
				return currentForType.filter(config => config.id !== id)
			})
			if (removedDefault) setSession({ kind: 'builtin' })
		},
		[persist],
	)

	const value = useMemo(
		() => ({
			listType,
			pickerColumns,
			visibleColumns: visible,
			isHidden,
			toggle,
			reorder,
			savedConfigs,
			canSaveMore: allConfigs.length < MAX_SAVED_COLUMN_CONFIGS,
			saveCurrent,
			loadConfig,
			renameConfig,
			overwriteConfig,
			deleteConfig,
			isSaving,
			currentCols,
		}),
		[
			allConfigs.length,
			currentCols,
			deleteConfig,
			isHidden,
			isSaving,
			listType,
			loadConfig,
			overwriteConfig,
			pickerColumns,
			renameConfig,
			reorder,
			saveCurrent,
			savedConfigs,
			toggle,
			visible,
		],
	)

	return (
		<ListColumnConfigContext.Provider value={value}>
			{children}
		</ListColumnConfigContext.Provider>
	)
}

export const useListColumnConfig = (): ListColumnConfigContextValue => {
	const context = useContext(ListColumnConfigContext)
	if (!context) {
		throw new Error(
			'useListColumnConfig must be used within ListColumnConfigProvider',
		)
	}
	return context
}
