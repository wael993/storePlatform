import { Button, Icon } from '@chakra-ui/react'
import { BiSortDown, BiSortUp } from 'react-icons/bi'
import { SortOrder } from '../list/shared/globalEnums'
import hoverFocusActiveButtonStyles from '../../theme'
import { AsSortIcon } from '../icons/Sort'

const styles = {
	icon: {
		fontSize: '1rem',
		cursor: 'pointer',
	},
	button: {
		cursor: 'pointer',
		color: '#707070',
		paddingX: '0.3rem',
		height: '1rem',
		minWidth: '1rem',
		_hover: {
			color: '#1E1E1E',
		},
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

const SortButton = ({
	sortingOrder,
	onSort,
}: {
	sortingOrder: SortOrder | null
	onSort: (sorting: SortOrder, key?: string) => void
}) => {
	return (
		<Button
			sx={styles.button}
			variant="ghost"
			onClick={() => {
				if (sortingOrder === null || sortingOrder === SortOrder.DESC) {
					onSort(SortOrder.ASC)
				} else {
					onSort(SortOrder.DESC)
				}
			}}
		>
			{sortingOrder === null ? (
				<Icon sx={styles.icon} as={AsSortIcon} />
			) : sortingOrder === SortOrder.DESC ? (
				<Icon sx={styles.icon} as={AsSortIcon} />
			) : (
				<Icon sx={styles.icon} as={AsSortIcon} />
			)}
		</Button>
	)
}

interface CustomTableSortProps {
	sortingOrder: SortOrder | null
	handleSort: (sorting: SortOrder, key?: string) => void
}

const TableSort = ({ sortingOrder, handleSort }: CustomTableSortProps) => {
	return <SortButton sortingOrder={sortingOrder} onSort={handleSort} />
}
export default TableSort
