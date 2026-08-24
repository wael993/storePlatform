import {
	Box,
	Button,
	Checkbox,
	HStack,
	Spinner,
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetRoleSeeCatalogQuery,
	useGetRoleSeeQuery,
	usePutRoleSeeMutation,
} from '../../api/apiStore'
import { SEE } from '../../shared/seeFlags'
import useCustomToast from '../common/CustomToast'

const EDITABLE_ROLES = ['admin', 'cashier', 'employee'] as const
const PACKAGE_HELPER_KEYS: Record<string, string> = {
	[SEE.supplier]: 'users.roleAccess.helpers.supplier',
	[SEE.productsAdd]: 'users.roleAccess.helpers.addProduct',
	[SEE.productsBuyingPrice]: 'users.roleAccess.helpers.buyingPrice',
}

const ADD_FOR: Record<string, string> = {
	[SEE.products]: SEE.productsAdd,
	[SEE.supplier]: SEE.suppliersAdd,
	[SEE.customers]: SEE.customersAdd,
	[SEE.categories]: SEE.categoriesAdd,
	[SEE.partners]: SEE.partnersAdd,
	[SEE.employees]: SEE.employeesAdd,
	[SEE.usersList]: SEE.usersInvite,
	[SEE.sellingInvoicesBuyingButton]: SEE.invoicesBuyingAdd,
	[SEE.sellingInvoices]: SEE.sellingInvoicesSellingButton,
	[SEE.sellingInvoicesEntriesButton]: SEE.invoicesEntriesAdd,
}

const DELETE_FOR: Record<string, string> = {
	[SEE.products]: SEE.productsDelete,
	[SEE.supplier]: SEE.suppliersDelete,
	[SEE.customers]: SEE.customersDelete,
	[SEE.categories]: SEE.categoriesDelete,
	[SEE.partners]: SEE.partnersDelete,
	[SEE.sellingInvoicesBuyingButton]: SEE.invoicesBuyingDelete,
	[SEE.sellingInvoices]: SEE.sellingInvoicesDelete,
	[SEE.sellingInvoicesEntriesButton]: SEE.invoicesEntriesDelete,
}

const EDIT_FOR: Record<string, string> = {
	[SEE.products]: SEE.productsEdit,
	[SEE.sellingInvoicesBuyingButton]: SEE.invoicesBuyingEdit,
	[SEE.sellingInvoices]: SEE.sellingInvoicesEdit,
	[SEE.sellingInvoicesEntriesButton]: SEE.invoicesEntriesEdit,
}

const HOISTED = new Set([
	...Object.values(ADD_FOR),
	...Object.values(EDIT_FOR),
	...Object.values(DELETE_FOR),
])

type RoleChip = 'owner' | (typeof EDITABLE_ROLES)[number]

const sameSee = (a: string[], b: string[]) => {
	if (a.length !== b.length) return false

	const other = new Set(b)

	return a.every(id => other.has(id))
}

const idsOf = (node: SeeCatalogNode): string[] => [
	node.id,
	...(node.children ?? []).flatMap(idsOf),
]

const stripOrphans = (
	ids: string[],
	nodes: SeeCatalogNode[],
	parentOn = true,
): string[] => {
	const keep = new Set(ids)
	const visit = (list: SeeCatalogNode[], on: boolean) => {
		for (const node of list) {
			const selfOn = on && (Boolean(node.locked) || keep.has(node.id))

			if (!selfOn) keep.delete(node.id)
			if (node.children) visit(node.children, selfOn)
		}
	}

	visit(nodes, parentOn)

	return [...keep]
}

const RoleAccessPanel = () => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const [role, setRole] = useState<RoleChip>('admin')
	const isOwnerView = role === 'owner'

	const { data: catalogData, isLoading: isCatalogLoading } =
		useGetRoleSeeCatalogQuery()
	const { data: roleData, isFetching: isRoleFetching } = useGetRoleSeeQuery(role)
	const [putRoleSee, { isLoading: isSaving }] = usePutRoleSeeMutation()

	const catalog = roleData?.catalog ?? catalogData?.catalog ?? []
	const [see, setSee] = useState<string[]>([])

	useEffect(() => {
		if (!roleData?.see) return
		setSee(prev => (sameSee(prev, roleData.see) ? prev : roleData.see))
	}, [role, roleData?.see])

	const seeSet = useMemo(() => new Set(see), [see])
	const isDirty = !sameSee(see, roleData?.see ?? [])

	const toggleSee = (node: SeeCatalogNode) => {
		if (isOwnerView || node.locked) return

		if (seeSet.has(node.id)) {
			const drop = new Set(idsOf(node))

			setSee(see.filter(id => !drop.has(id)))
			return
		}

		setSee([...see, node.id])
	}

	const toggleAction = (id: string, seeOn: boolean) => {
		if (isOwnerView || !seeOn) return

		if (seeSet.has(id)) {
			const found = catalog.flatMap(function collect(
				node: SeeCatalogNode,
			): string[] {
				if (node.id === id) return idsOf(node)
				return node.children?.flatMap(collect) ?? []
			})
			const drop = new Set(found.length ? found : [id])

			setSee(see.filter(item => !drop.has(item)))
			return
		}

		setSee([...see, id])
	}

	const onSave = async () => {
		if (isOwnerView || !isDirty) return

		try {
			const saved = await putRoleSee({
				role,
				see: stripOrphans(see, catalog),
			}).unwrap()
			setSee(saved.see)
		} catch {
			showToast({
				status: 'error',
				description: t('users.roleUpdateFailed'),
			})
		}
	}

	const renderRows = (
		nodes: SeeCatalogNode[],
		depth = 0,
		ancestors: SeeCatalogNode[] = [],
	): ReactElement[] =>
		nodes.flatMap(node => {
			if (HOISTED.has(node.id)) {
				return node.children
					? renderRows(node.children, depth, [...ancestors, node])
					: []
			}

			const ancestorsOn = ancestors.every(
				ancestor => ancestor.locked || seeSet.has(ancestor.id),
			)
			const seeOn =
				ancestorsOn && (Boolean(node.locked) || seeSet.has(node.id))
			const addId = ADD_FOR[node.id]
			const editId = EDIT_FOR[node.id]
			const deleteId = DELETE_FOR[node.id]
			const helperKey = PACKAGE_HELPER_KEYS[node.id]
			const addHelperKey = addId ? PACKAGE_HELPER_KEYS[addId] : undefined
			const disabled = isOwnerView || isSaving
			const seeDisabled = disabled || Boolean(node.locked)
			const actionDisabled = disabled || !seeOn

			return [
				<Tr key={node.id}>
					<Td py={2} ps={`${0.5 + depth * 1.25}rem`} whiteSpace="nowrap">
						<Text>
							{t(`users.roleAccess.items.${node.id.replace(/\./g, '_')}`, {
								defaultValue: node.id,
							})}
						</Text>
						{helperKey ? (
							<Text fontSize="sm" color="gray.500">
								{t(helperKey)}
							</Text>
						) : null}
					</Td>
					<Td py={2} textAlign="center">
						<Checkbox
							isChecked={seeOn}
							isDisabled={seeDisabled}
							onChange={() => toggleSee(node)}
						/>
					</Td>
					<Td py={2} textAlign="center">
						{addId ? (
							<Box>
								<Checkbox
									isChecked={seeOn && seeSet.has(addId)}
									isDisabled={actionDisabled}
									onChange={() => toggleAction(addId, seeOn)}
								/>
								{addHelperKey ? (
									<Text fontSize="sm" color="gray.500">
										{t(addHelperKey)}
									</Text>
								) : null}
							</Box>
						) : null}
					</Td>
					<Td py={2} textAlign="center">
						{editId ? (
							<Checkbox
								isChecked={seeOn && seeSet.has(editId)}
								isDisabled={actionDisabled}
								onChange={() => toggleAction(editId, seeOn)}
							/>
						) : null}
					</Td>
					<Td py={2} textAlign="center">
						{deleteId ? (
							<Checkbox
								isChecked={seeOn && seeSet.has(deleteId)}
								isDisabled={actionDisabled}
								onChange={() => toggleAction(deleteId, seeOn)}
							/>
						) : null}
					</Td>
				</Tr>,
				...(node.children
					? renderRows(node.children, depth + 1, [...ancestors, node])
					: []),
			]
		})

	return (
		<Stack gap={4}>
			<Text color="gray.600">{t('users.roleAccess.description')}</Text>
			<HStack flexWrap="wrap">
				{(['owner', ...EDITABLE_ROLES] as const).map(chip => (
					<Button
						key={chip}
						size="sm"
						variant={role === chip ? 'solid' : 'outline'}
						colorScheme="blue"
						onClick={() => setRole(chip)}
					>
						{t(`users.roles.${chip}`)}
					</Button>
				))}
			</HStack>
			{isOwnerView ? (
				<Text fontSize="sm" color="gray.500">
					{t('users.roleAccess.ownerReadOnly')}
				</Text>
			) : null}
			{isCatalogLoading || isRoleFetching ? <Spinner size="sm" /> : null}
			<Box overflowX="auto">
				<Table size="sm" variant="simple">
					<Thead>
						<Tr>
							<Th>{t('users.roleAccess.columns.name')}</Th>
							<Th textAlign="center">{t('users.roleAccess.columns.see')}</Th>
							<Th textAlign="center">{t('users.roleAccess.columns.add')}</Th>
							<Th textAlign="center">{t('users.roleAccess.columns.edit')}</Th>
							<Th textAlign="center">
								{t('users.roleAccess.columns.delete')}
							</Th>
						</Tr>
					</Thead>
					<Tbody>{renderRows(catalog)}</Tbody>
				</Table>
			</Box>
			{!isOwnerView ? (
				<Button
					alignSelf="flex-start"
					colorScheme="blue"
					isDisabled={!isDirty || isSaving}
					isLoading={isSaving}
					onClick={() => void onSave()}
				>
					{t('common.save')}
				</Button>
			) : null}
		</Stack>
	)
}

export default RoleAccessPanel
