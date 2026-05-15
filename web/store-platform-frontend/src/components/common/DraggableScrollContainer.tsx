import { Box, SystemStyleObject } from '@chakra-ui/react'
import React, {
	ForwardedRef,
	MouseEvent,
	MutableRefObject,
	PropsWithChildren,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react'
import omit from 'lodash/omit'
import { compareBreakpoint } from '../../shared/utils'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'

const getScrollState = (el: HTMLDivElement) => {
	return {
		reachedStartX: el.scrollLeft <= 0,
		reachedEndX: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
		reachedStartY: el.scrollTop <= 0,
		reachedEndY: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
	}
}

type DraggableScrollContainerProps = PropsWithChildren & {
	styles?: SystemStyleObject
	onDrag?: (args: ReturnType<typeof getScrollState>) => void
}

const DraggableScrollContainer = (
	{ onDrag = () => {}, ...props }: DraggableScrollContainerProps,
	forwardedRef: ForwardedRef<HTMLDivElement>,
) => {
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const ref = forwardedRef as MutableRefObject<HTMLDivElement>

	const [isMouseDown, setIsMouseDown] = useState(false)
	const [isDragging, setIsDragging] = useState(false)

	const stylesDefault: SystemStyleObject = {
		cursor: isMouseDown ? 'grabbing' : 'grab',
		userSelect: isDragging ? 'none' : 'auto',
	}
	const mouseCoords = useRef({
		startX: 0,
		startY: 0,
		scrollLeft: 0,
		scrollTop: 0,
	})
	const handleDragStart = (
		e: MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
	) => {
		if (!ref?.current) return
		const slider = ref.current
		const rect = slider.getBoundingClientRect()
		const startX =
			'touches' in e ? e.touches[0].pageX - rect.left : e.pageX - rect.left
		const startY =
			'touches' in e ? e.touches[0].pageY - rect.top : e.pageY - rect.top
		const scrollLeft = slider.scrollLeft
		const scrollTop = slider.scrollTop
		mouseCoords.current = { startX, startY, scrollLeft, scrollTop }
		setIsMouseDown(true)
		setIsDragging(false)
	}
	const handleDragEnd = useCallback(() => {
		setIsMouseDown(false)
		setTimeout(() => setIsDragging(false), 0)
	}, [setIsMouseDown, setIsDragging])

	const handleDrag = (
		e: MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
	) => {
		if (!isMouseDown || !ref.current) return
		const slider = ref.current
		const rect = slider.getBoundingClientRect()

		const clientX = 'touches' in e ? e.touches[0].pageX : e.pageX
		const x = clientX - rect.left

		const clientY = 'touches' in e ? e.touches[0].pageY : e.pageY
		const y = clientY - rect.top

		const walkX = x - mouseCoords.current.startX
		const walkY = y - mouseCoords.current.startY

		// Determine if a drag has occurred
		if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
			setIsDragging(true)
		}

		!isMobile && (slider.scrollLeft = mouseCoords.current.scrollLeft - walkX)
		slider.scrollTop = mouseCoords.current.scrollTop - walkY
		onDrag(getScrollState(slider))
	}
	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isDragging) {
			e.stopPropagation()
			e.preventDefault()
		}
	}

	const handleScrollUpdate = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
		if (!onDrag) return
		onDrag(getScrollState(e.currentTarget))
	}

	useEffect(() => {
		if (isMouseDown) {
			window.addEventListener('mouseup', handleDragEnd)
			window.addEventListener('touchend', handleDragEnd)
		} else {
			window.removeEventListener('mouseup', handleDragEnd)
			window.removeEventListener('touchend', handleDragEnd)
		}
		return () => {
			window.removeEventListener('mouseup', handleDragEnd)
			window.removeEventListener('touchend', handleDragEnd)
		}
	}, [isMouseDown, handleDragEnd])

	return (
		<Box
			{...omit(props, 'styles')}
			id="scroller-component"
			ref={ref}
			sx={{ ...(props.styles || {}), ...stylesDefault }}
			onMouseDown={handleDragStart}
			onMouseMove={handleDrag}
			onTouchStart={handleDragStart}
			onTouchMove={handleDrag}
			onScroll={handleScrollUpdate}
			onClickCapture={handleClick}
		>
			{props.children}
		</Box>
	)
}

export default React.forwardRef(DraggableScrollContainer)
