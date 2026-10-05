import {
	Modal,
	ModalHeader,
	ModalContent,
	ModalOverlay,
	ModalBody,
} from '@chakra-ui/react'
import React, { useMemo, useState } from 'react'
import DropdownLabel from '../DropdownLabel'
import { useTranslation } from 'react-i18next'
import {
	useGetCategoriesQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
} from '../../api/apiStore'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'

interface BulkEditModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	cancelButtonText: string
	confirmationButtonText: string
	isConfirmationButtonLoading: boolean
}

const BulkEditModal = ({
	isOpen,
	onClose,
	onConfirm,
	cancelButtonText,
	confirmationButtonText,
	isConfirmationButtonLoading,
}: BulkEditModalProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canSeeCategories = canSee(SEE.categories)
	const canSeeSupplier = canSee(SEE.supplier)
	const [form, setForm] = useState({
		categoryId: '',
		supplierId: '',
		unitId: '',
	})
	const { data: categories = [], isLoading: isCategoriesLoading } =
		useGetCategoriesQuery(undefined, {
			skip: !isOpen || !canSeeCategories,
		})
	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({}, { skip: !isOpen || !canSeeSupplier })
	const { data: units = [], isLoading: isUnitsLoading } = useGetUnitsQuery(
		{},
		{ skip: !isOpen },
	)

	const categoryOptions = useMemo(
		() =>
			categories.map(category => ({
				value: category.categoryId,
				label: category.name,
			})),
		[categories],
	)

	const getSelectedOption = (
		options: DropdownOption[],
		value: string,
		fallbackLabel?: string,
	): DropdownOption[] => {
		if (!value) return []
		const match = options.find(option => option.value === value)
		return match ? [match] : [{ value, label: fallbackLabel || value }]
	}

	const handleDropdownSelect = (field: keyof typeof form, values: string[]) => {
		setForm(prev => ({ ...prev, [field]: values[0] ?? '' }))
	}
	const supplierOptions = useMemo(
		() =>
			suppliers.map(supplier => ({
				value: supplier.supplierId,
				label: supplier.name,
			})),
		[suppliers],
	)
	const unitOptions = useMemo(
		() =>
			units.map(unit => ({
				value: unit.unitId,
				label: unit.name,
			})),
		[units],
	)
	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>Bulk Edit</ModalHeader>
				<ModalBody>
					<DropdownLabel
						isSearchable
						isSingle
						label={t('common.category')}
						placeholder={t('common.category')}
						options={categoryOptions}
						selectedOptions={getSelectedOption(
							categoryOptions,
							form.categoryId,
						)}
						onSelect={values => handleDropdownSelect('categoryId', values)}
						isLoading={isCategoriesLoading}
					/>
					<DropdownLabel
						label="Select a Supplier"
						options={[]}
						selectedOptions={[]}
						onSelect={values => handleDropdownSelect('supplierId', values)}
					/>
					<DropdownLabel
						label="Select a Unit"
						options={[]}
						selectedOptions={[]}
						onSelect={values => handleDropdownSelect('unitId', values)}
					/>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default BulkEditModal
