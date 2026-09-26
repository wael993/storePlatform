import { Box } from '@chakra-ui/react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useEffect, useRef } from 'react'

interface EChartsHostProps {
	option: EChartsOption
	height?: string | Record<string, string>
}

/** Thin ECharts mount — dispose + resize handled here. */
const EChartsHost = ({ option, height = '16rem' }: EChartsHostProps) => {
	const hostRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const el = hostRef.current
		if (!el) return

		const chart = echarts.init(el)
		chart.setOption(option)

		const resize = () => chart.resize()
		window.addEventListener('resize', resize)
		const observer = new ResizeObserver(resize)
		observer.observe(el)

		return () => {
			window.removeEventListener('resize', resize)
			observer.disconnect()
			chart.dispose()
		}
	}, [option])

	return <Box ref={hostRef} w="100%" h={height} minH="14rem" />
}

export default EChartsHost
