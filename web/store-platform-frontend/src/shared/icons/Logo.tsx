import { chakra } from '@chakra-ui/react'

const Logo = ({ className }: { className?: string }) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="40"
			height="40"
			viewBox="0 0 256 256"
			fill="none"
			className={className}
			role="img"
			aria-hidden="true"
		>
			<path
				fill="currentColor"
				d="M 32 32 H 224 V 152 H 144 V 64 H 32 Z M 32 104 H 104 V 192 H 224 V 224 H 32 Z"
			/>
		</svg>
	)
}

export default chakra(Logo)
