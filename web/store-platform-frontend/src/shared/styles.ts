import { EditableCellFieldProps } from '../components/list/EditableCellField'

export const listStyles = {
	tableHeader: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableHeaderText: {
		fontStyle: 'normal',
		textTransform: 'none',
		color: '#939596',
		fontSize: '0.625rem',
		fontWeight: 500,
		lineHeight: '1.2rem',
		letterSpacing: 'normal',
		whiteSpace: 'nowrap',
	},
	tableCell: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableCellText: {
		fontWeight: 500,
		color: '#1E1E1E',
		fontSize: '0.875rem',
		lineHeight: '1.2rem',
		overflowWrap: 'anywhere',
	},
	tableHeaderStickyRight: {
		position: 'sticky',
		right: 0,
		zIndex: 4,
		height: '3rem',
		margin: 0,
		padding: 0,
	},
} satisfies StylesObject

const inputHeight = '1.85rem'

export const cellFieldStyles: EditableCellFieldProps['customStyles'] = {
	mainFlexWrapper: {
		height: inputHeight,
		maxHeight: inputHeight,
		justifyContent: { base: 'flex-start', md: 'center' },
		paddingLeft: '0.25rem',
		maxWidth: '7rem',
	},
	mainRow: {
		marginRight: '0',
		border: 'none',
		height: inputHeight,
		width: '100%',
		maxWidth: '7rem',
		justifyContent: { base: 'space-between', md: 'center' },
		gap: '0',
		paddingBlock: '0.25rem',
	},
	mainTextWrapper: {
		display: 'flex',
		minHeight: inputHeight,
		width: '100%',
		maxWidth: '7.5rem',
		justifyContent: { base: 'space-between', md: 'center' },
		height: inputHeight,
		paddingX: '0',
	},
	valueText: {
		fontWeight: '500',
		paddingX: '0rem',
		fontSize: '0.875rem',
		flex: '1 1 auto',
		color: '#1E1E1E',
		whiteSpace: 'nowrap',
		textAlign: { base: 'left', md: 'right' },
		width: 'fit-content',
		maxWidth: '3rem',
	},
} satisfies StylesObject

export const editableCellFieldStyles = {
	mainFlexWrapper: {
		width: 'unset',
		height: inputHeight,
	},
	mainRow: {
		marginRight: '0',
		border: 'none',
		gap: '0',
		backgroundColor: '#D8D8D8',
		alignItems: 'center',
		width: 'min-content',
		maxWidth: '9rem',
		height: inputHeight,
	},
	mainTextWrapper: {
		display: 'flex',
		backgroundColor: '#D8D8D8',
		alignItems: 'center',
		height: inputHeight,
		minHeight: inputHeight,
		width: 'min-content',
		maxWidth: '8rem',
	},
	valueText: {
		fontWeight: 'bold',
		textAlign: 'left',
		fontSize: '0.75rem',
		width: 'fit-content',
		maxWidth: '5rem',
		color: '#1E1E1E',
		alignItems: 'center',
		whiteSpace: 'nowrap',
	},
} satisfies EditableCellFieldProps['customStyles']
