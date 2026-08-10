import { useToast, UseToastOptions } from '@chakra-ui/react'

const useCustomToast = () => {
	const toast = useToast()

	const showCustomToast = (options: UseToastOptions) => {
		toast({
			...options,
			duration: options.duration ?? 5000,
			isClosable: options.isClosable ?? true,
			containerStyle: options.containerStyle || {
				marginBottom: { base: '3rem', lg: '5rem' },
			},
		})
	}

	return showCustomToast
}

export default useCustomToast
