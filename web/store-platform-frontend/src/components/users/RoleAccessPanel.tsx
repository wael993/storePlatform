import {
	Box,
	Button,
	Checkbox,
	HStack,
	Spinner,
	Stack,
	Text,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetRoleSeeCatalogQuery,
	useGetRoleSeeQuery,
	usePutRoleSeeMutation,
} from '../../api/apiStore'
import { SEE } from '../../shared/seeFlags'

const EDITABLE_ROLES = ['admin', 'cashier', 'employee'] as const
const PACKAGE_HELPER_KEYS: Record<string, string> = {
	[SEE.supplier]: 'users.roleAccess.helpers.supplier',
	[SEE.productsAdd]: 'users.roleAccess.helpers.addProduct',
	[SEE.productsBuyingPrice]: 'users.roleAccess.helpers.buyingPrice',
}

type RoleChip = 'owner' | (typeof EDITABLE_ROLES)[number]

const sameSee = (a: string[], b: string[]) => {
	if (a.length !== b.length) return false

	const other = new Set(b)

	return a.every(id => other.has(id))
}

const RoleAccessPanel = () => {
	const { t } = useTranslation()
	const [role, setRole] = useState<RoleChip>('admin')
	const isOwnerView = role === 'owner'

	const { data: catalogData, isLoading: isCatalogLoading } =
		useGetRoleSeeCatalogQuery()
	const { data: roleData, isFetching: isRoleFetching } = useGetRoleSeeQuery(role)
	const [putRoleSee, { isLoading: isSaving }] = usePutRoleSeeMutation()

	const catalog = roleData?.catalog ?? catalogData?.catalog ?? []
	const [see, setSee] = useState<string[]>([])

	useEffect(() => {
		if (roleData?.see) setSee(roleData.see)
	}, [role, roleData?.see])

	const seeSet = useMemo(() => new Set(see), [see])
	const isDirty = !sameSee(see, roleData?.see ?? [])

	const toggle = (id: string, locked?: boolean) => {
		if (isOwnerView || locked) return

		setSee(
			seeSet.has(id) ? see.filter(item => item !== id) : [...see, id],
		)
	}

	const onSave = async () => {
		if (isOwnerView || !isDirty) return

		try {
			const saved = await putRoleSee({ role, see }).unwrap()
			setSee(saved.see)
		} catch {
			// keep local `see` so they can retry
		}
	}

	const renderNode = (node: SeeCatalogNode, depth = 0) => {
		const helperKey = PACKAGE_HELPER_KEYS[node.id]
		const checked = node.locked || seeSet.has(node.id)
		const disabled = isOwnerView || Boolean(node.locked) || isSaving

		return (
			<Box key={node.id} ps={depth ? 6 : 0}>
				<Checkbox
					isChecked={checked}
					isDisabled={disabled}
					onChange={() => toggle(node.id, node.locked)}
				>
					{t(`users.roleAccess.items.${node.id.replace(/\./g, '_')}`, {
						defaultValue: node.id,
					})}
				</Checkbox>
				{helperKey ? (
					<Text fontSize="sm" color="gray.500" ps={6} mb={1}>
						{t(helperKey)}
					</Text>
				) : null}
				{node.children?.map(child => renderNode(child, depth + 1))}
			</Box>
		)
	}

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
			<Stack gap={2}>{catalog.map(node => renderNode(node))}</Stack>
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
