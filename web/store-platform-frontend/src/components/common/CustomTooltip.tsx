import { PlacementWithLogical, Box, Tooltip } from '@chakra-ui/react'
import { SystemStyleObject } from '@chakra-ui/system'
import { useEffect, useRef, useState } from 'react'
interface CustomTooltipProps {
	children?: React.ReactNode
	label?: string | string[]
	ariaLabel?: string
	styles?: SystemStyleObject
	placement?: PlacementWithLogical
	nonOverflowTooltip?: string
	customWidth?: string
	isTruncated?: boolean
	textUsesEllipsis?: boolean
	openDelay?: number
}
export const CustomTooltip = ({
	ariaLabel,
	label,
	children,
	styles: customStyles,
	placement,
	nonOverflowTooltip,
	customWidth,
	isTruncated = true,
	textUsesEllipsis = false,
	openDelay = 0,
}: CustomTooltipProps) => {
	const styles = {
		box: {
			...(customStyles ?? {}),
		},
		// width: customWidth || '100%',
		text: {
			width: customWidth || '100%',
		},
	} satisfies StylesObject

	const ref = useRef<HTMLDivElement>(null)

	const [isOverflown, setIsOverflown] = useState(false)

	const checkOverflow = () => {
		if (!ref.current) return
		let element: HTMLElement | null = ref.current

		if (!element) return

		if (textUsesEllipsis) {
			const child = ref.current.firstElementChild as HTMLElement | null
			if (child) {
				element = child
			}
		}

		const hasHorizontalOverflow = element.scrollWidth > element.clientWidth
		setIsOverflown(hasHorizontalOverflow)
	}

	const tooltipLabel = isOverflown ? label : nonOverflowTooltip

	useEffect(() => {
		if (!ref.current) return

		const resizeObserver = new ResizeObserver(checkOverflow)
		resizeObserver.observe(ref.current)

		requestAnimationFrame(checkOverflow)

		return () => {
			resizeObserver.disconnect()
		}
	}, [label])

	return (
		<Tooltip
			closeOnScroll
			aria-label={ariaLabel}
			label={tooltipLabel}
			placement={placement}
			isDisabled={!isOverflown && !nonOverflowTooltip}
			openDelay={openDelay}
		>
			<Box sx={styles.box}>
				<Box ref={ref} isTruncated={isTruncated} sx={styles.text}>
					{children}
				</Box>
			</Box>
		</Tooltip>
	)
}
