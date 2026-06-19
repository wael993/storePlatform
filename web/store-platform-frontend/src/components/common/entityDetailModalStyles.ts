const fullWidth = '100%'
const pageContentPadding = '2rem'
const pageContentPaddingMobile = '1.25rem'

export const entityDetailModalStyles = {
	grid: {
		gridTemplateColumns: 'repeat(12, 1fr)',
		paddingLeft: {
			base: pageContentPaddingMobile,
			md: pageContentPadding,
		},
		paddingRight: {
			base: pageContentPaddingMobile,
			md: pageContentPadding,
		},
	},
	fullWidthSection: {
		width: fullWidth,
		gridColumn: '1 / span 12',
		paddingBottom: { base: '1rem', md: '2rem' },
	},
	listSection: {
		width: fullWidth,
		gridColumn: '1 / span 12',
		paddingLeft: {
			base: pageContentPaddingMobile,
			md: pageContentPadding,
		},
		paddingRight: {
			base: pageContentPaddingMobile,
			md: pageContentPadding,
		},
		paddingBottom: { base: '2rem', md: '3rem' },
	},
	errorSection: {
		width: fullWidth,
		gridColumn: '1 / span 12',
		paddingBottom: { base: '2rem', md: '3rem' },
		justifyContent: 'space-between',
		marginTop: '3rem',
	},
	errorTextBox: {
		width: '90%',
	},
	errorText: {
		marginTop: '7rem',
	},
	modalContent: {
		maxH: '100dvh',
		h: { base: 'calc(100dvh - 4rem)', md: 'calc(100dvh - 5rem)' },
		m: 0,
		mt: { base: 0, md: '5rem' },
		borderRadius: 0,
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden',
		zIndex: 1,
	},
	modalBody: {
		flex: 1,
		minH: 0,
		overflowY: 'auto',
		overflowX: 'hidden',
		width: fullWidth,
		px: 0,
		py: 0,
		WebkitOverflowScrolling: 'touch',
	},
} satisfies StylesObject

export const entityDetailModalContainerZIndex = 10
