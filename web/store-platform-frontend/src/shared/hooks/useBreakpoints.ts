import { useBreakpointValue } from '@chakra-ui/react'
import { Breakpoints } from '../globalEnums'

export function useBreakpoints() {
	const breakpoint = useBreakpointValue(
		{
			base: Breakpoints.MOBILE,
			md: Breakpoints.TABLET,
			xl: Breakpoints.DESKTOP,
			'2xl': Breakpoints.LARGE_DESKTOP,
		},
		{ ssr: false },
	)

	return breakpoint
}
