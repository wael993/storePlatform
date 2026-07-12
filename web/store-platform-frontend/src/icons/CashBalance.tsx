import { createIcon, Icon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			fill="currentColor"
			d="M489.739 367.304h-16.696V150.261c0-9.22-7.475-16.696-16.696-16.696H372.87v-33.391h83.478c9.22 0 16.696-7.475 16.696-16.696V16.696C473.043 7.475 465.568 0 456.348 0H256c-9.22 0-16.696 7.475-16.696 16.696v66.783c0 9.22 7.475 16.696 16.696 16.696h83.478v33.391H55.652c-9.22 0-16.696 7.475-16.696 16.696v217.043H22.261c-9.22 0-16.696 7.475-16.696 16.696v111.304C5.565 504.525 13.04 512 22.261 512h467.478c9.22 0 16.696-7.475 16.696-16.696V384c0-9.22-7.475-16.696-16.696-16.696zM272.696 66.783V33.391h166.956v33.391H272.696zM72.348 166.957h367.304v200.348H72.348V166.957zM473.043 478.609H38.957v-77.913h16.696h400.696h16.696V478.609z"
		/>
		<path
			fill="currentColor"
			d="M189.217 200.348h-66.783c-9.22 0-16.696 7.475-16.696 16.696 0 9.22 7.475 16.696 16.696 16.696h66.783c9.22 0 16.696-7.475 16.696-16.696 0-9.22-7.475-16.696-16.696-16.696z"
		/>
		<circle cx="256" cy="250.435" r="16.696" fill="currentColor" />
		<circle cx="322.783" cy="250.435" r="16.696" fill="currentColor" />
		<circle cx="389.565" cy="250.435" r="16.696" fill="currentColor" />
		<circle cx="256" cy="317.217" r="16.696" fill="currentColor" />
		<circle cx="322.783" cy="317.217" r="16.696" fill="currentColor" />
		<circle cx="389.565" cy="317.217" r="16.696" fill="currentColor" />
		<circle cx="256" cy="439.652" r="16.696" fill="currentColor" />
	</>
)
const width = '512'
const height = '512'
const viewBox = `0 0 ${width} ${height}`

export const CashBalanceIcon = (props: IconProps) => (
	<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
		<IconPath />
	</Icon>
)
export const AsCashBalanceIcon = createIcon({
	displayName: 'AsCashBalanceIcon',
	viewBox: viewBox,
	path: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={width}
			height={height}
			viewBox={viewBox}
			fill="none"
		>
			<IconPath />
		</svg>
	),
})
