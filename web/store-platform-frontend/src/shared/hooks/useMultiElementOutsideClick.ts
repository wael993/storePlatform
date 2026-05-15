import { useCallbackRef } from '@chakra-ui/react'
import { useEffect, useRef } from 'react'

/**
 * This is modification of use outside click hook from chakra ui to handle references of multiple elements instead of single one
 * https://github.com/chakra-ui/chakra-ui/blob/main/packages/hooks/src/use-outside-click.ts
 */

export interface UseOutsideClickProps {
	/**
	 * Whether the hook is enabled
	 */
	enabled?: boolean
	/**
	 * References to a DOM element.
	 */
	refs: React.RefObject<HTMLElement>[]
	/**
	 * Function invoked when a click is triggered outside the referenced elements.
	 */
	handler?: (e: Event) => void
}

/**
 * Example, used in components like Dialogs and Popovers, so they can close
 * when a user clicks outside them.
 */
const useMultiElementOutsideClick = (props: UseOutsideClickProps) => {
	const { refs, handler, enabled = true } = props
	const savedHandler = useCallbackRef(handler)

	const stateRef = useRef({
		isPointerDown: false,
		ignoreEmulatedMouseEvents: false,
	})

	const state = stateRef.current

	useEffect(() => {
		if (!enabled) return
		const onPointerDown = (e: Event) => {
			if (isValidEvent(e, refs)) {
				state.isPointerDown = true
			}
		}

		const onMouseUp = (event: MouseEvent) => {
			if (state.ignoreEmulatedMouseEvents) {
				state.ignoreEmulatedMouseEvents = false
				return
			}

			if (state.isPointerDown && handler && isValidEvent(event, refs)) {
				state.isPointerDown = false
				savedHandler(event)
			}
		}

		const onTouchEnd = (event: TouchEvent) => {
			state.ignoreEmulatedMouseEvents = true
			if (handler && state.isPointerDown && isValidEvent(event, refs)) {
				state.isPointerDown = false
				savedHandler(event)
			}
		}

		const docs = refs.map(ref => getOwnerDocument(ref?.current))
		const doc = docs.every(doc => docs[0] === doc) ? docs[0] : document
		doc.addEventListener('mousedown', onPointerDown, true)
		doc.addEventListener('mouseup', onMouseUp, true)
		doc.addEventListener('touchstart', onPointerDown, true)
		doc.addEventListener('touchend', onTouchEnd, true)

		return () => {
			doc.removeEventListener('mousedown', onPointerDown, true)
			doc.removeEventListener('mouseup', onMouseUp, true)
			doc.removeEventListener('touchstart', onPointerDown, true)
			doc.removeEventListener('touchend', onTouchEnd, true)
		}
	}, [handler, refs, savedHandler, state, enabled])
}

const isValidEvent = (event: Event, refs: React.RefObject<HTMLElement>[]) => {
	const target = event.target as HTMLElement

	if (target) {
		const doc = getOwnerDocument(target)
		if (!doc.contains(target)) return false
	}

	return refs.every(ref => ref && !ref.current?.contains(target))
}

const getOwnerDocument = (node?: Element | null): Document => {
	return node?.ownerDocument ?? document
}

export default useMultiElementOutsideClick
