import { ReactNode } from 'react'
import {
	LabelField,
	LabelFieldValues,
	LabelLayout,
	MM_TO_PX,
	ensureVerticalFields,
	isVerticalLayout,
	renderBarcodeSvg,
} from '../../shared/labelTemplate'

interface LabelPreviewProps {
	layout: LabelLayout
	values: LabelFieldValues
	selectedId?: string
	onSelect?: (id: string) => void
	onMove?: (id: string, x: number, y: number) => void
	onResize?: (id: string, width: number, height: number) => void
}

const fieldText = (field: LabelField, values: LabelFieldValues): string => {
	if (field.type === 'barcode' || field.type === 'storeLogo') {
		return ''
	}

	return values[field.type]
}

const mm = (value: number) => `${value}mm`

const RotatedContent = ({
	field,
	rotate,
	children,
}: {
	field: LabelField
	rotate: boolean
	children: ReactNode
}) => {
	if (!rotate) {
		return (
			<div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
				{children}
			</div>
		)
	}

	return (
		<div
			style={{
				position: 'relative',
				width: '100%',
				height: '100%',
				overflow: 'hidden',
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					position: 'absolute',
					width: mm(field.height),
					height: mm(field.width),
					left: '50%',
					top: '50%',
					transform: 'translate(-50%, -50%) rotate(90deg)',
					overflow: 'hidden',
				}}
			>
				{children}
			</div>
		</div>
	)
}

const scaleFromLabel = (fieldEl: HTMLElement, layoutWidth: number) => {
	const width = fieldEl.parentElement?.getBoundingClientRect().width ?? 0
	return layoutWidth > 0 && width > 0 ? width / layoutWidth : MM_TO_PX
}

const LabelPreview = ({
	layout,
	values,
	selectedId,
	onSelect,
	onMove,
	onResize,
}: LabelPreviewProps) => {
	const editable = Boolean(onMove)
	const viewLayout = editable ? layout : ensureVerticalFields(layout)
	const rotateContent = isVerticalLayout(viewLayout)

	return (
		<div
			style={{
				position: 'relative',
				width: mm(viewLayout.width),
				height: mm(viewLayout.height),
				background: '#ffffff',
				border: editable ? '1px solid #D0D5DD' : 'none',
				overflow: 'hidden',
				userSelect: 'none',
				boxSizing: 'border-box',
			}}
		>
			{viewLayout.fields.map(field => (
				<div
					key={field.id}
					style={{
						position: 'absolute',
						left: mm(field.x),
						top: mm(field.y),
						width: mm(field.width),
						height: mm(field.height),
						padding: mm(field.padding ?? 0),
						border:
							editable && selectedId === field.id
								? '1px solid #376288'
								: 'none',
						boxSizing: 'border-box',
						cursor: editable ? 'move' : 'default',
						overflow: 'hidden',
					}}
					onClick={event => {
						event.stopPropagation()
						onSelect?.(field.id)
					}}
					onPointerDown={event => {
						if (!onMove || event.button !== 0) {
							return
						}

						event.preventDefault()
						onSelect?.(field.id)
						const originX = event.clientX
						const originY = event.clientY
						const startX = field.x
						const startY = field.y
						const scale = scaleFromLabel(event.currentTarget, viewLayout.width)
						const maxX = Math.max(0, viewLayout.width - field.width)
						const maxY = Math.max(0, viewLayout.height - field.height)
						const pointerId = event.pointerId
						const target = event.currentTarget
						target.setPointerCapture(pointerId)

						const move = (moveEvent: PointerEvent) => {
							onMove(
								field.id,
								Math.min(
									maxX,
									Math.max(0, startX + (moveEvent.clientX - originX) / scale),
								),
								Math.min(
									maxY,
									Math.max(0, startY + (moveEvent.clientY - originY) / scale),
								),
							)
						}

						const up = () => {
							target.releasePointerCapture(pointerId)
							target.removeEventListener('pointermove', move)
							target.removeEventListener('pointerup', up)
							target.removeEventListener('pointercancel', up)
						}

						target.addEventListener('pointermove', move)
						target.addEventListener('pointerup', up)
						target.addEventListener('pointercancel', up)
					}}
				>
					{field.type === 'barcode' && values.barcode ? (
						<RotatedContent field={field} rotate={rotateContent}>
							<div
								dangerouslySetInnerHTML={{
									__html: renderBarcodeSvg(values.barcode),
								}}
								style={{ width: '100%', height: '100%' }}
							/>
						</RotatedContent>
					) : field.type === 'storeLogo' && values.storeLogo ? (
						<RotatedContent field={field} rotate={rotateContent}>
							<img
								src={values.storeLogo}
								alt=""
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'contain',
								}}
							/>
						</RotatedContent>
					) : (
						<RotatedContent field={field} rotate={rotateContent}>
							<div
								style={{
									fontSize: `${field.fontSize ?? 8}pt`,
									textAlign: field.align ?? 'left',
									lineHeight: 1.1,
									width: '100%',
									height: '100%',
									overflow: 'hidden',
									fontFamily: 'sans-serif',
								}}
							>
								{fieldText(field, values)}
							</div>
						</RotatedContent>
					)}
					{editable && onResize && selectedId === field.id ? (
						<div
							style={{
								position: 'absolute',
								right: 0,
								bottom: 0,
								width: 10,
								height: 10,
								background: '#376288',
								cursor: 'nwse-resize',
							}}
							onPointerDown={event => {
								event.stopPropagation()
								event.preventDefault()
								const fieldEl = event.currentTarget.parentElement
								if (!fieldEl) {
									return
								}

								const originX = event.clientX
								const originY = event.clientY
								const startW = field.width
								const startH = field.height
								const scale = scaleFromLabel(fieldEl, viewLayout.width)
								const maxW = Math.max(4, viewLayout.width - field.x)
								const maxH = Math.max(3, viewLayout.height - field.y)
								const pointerId = event.pointerId
								const target = event.currentTarget
								target.setPointerCapture(pointerId)

								const move = (moveEvent: PointerEvent) => {
									onResize(
										field.id,
										Math.min(
											maxW,
											Math.max(
												4,
												startW + (moveEvent.clientX - originX) / scale,
											),
										),
										Math.min(
											maxH,
											Math.max(
												3,
												startH + (moveEvent.clientY - originY) / scale,
											),
										),
									)
								}

								const up = () => {
									target.releasePointerCapture(pointerId)
									target.removeEventListener('pointermove', move)
									target.removeEventListener('pointerup', up)
									target.removeEventListener('pointercancel', up)
								}

								target.addEventListener('pointermove', move)
								target.addEventListener('pointerup', up)
								target.addEventListener('pointercancel', up)
							}}
						/>
					) : null}
				</div>
			))}
		</div>
	)
}

export default LabelPreview
