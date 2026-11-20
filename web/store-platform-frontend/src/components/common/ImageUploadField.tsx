import { ChangeEvent, useState } from 'react'
import {
	Button,
	FormControl,
	FormLabel,
	Image,
	Input,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { readImageFile } from '../../shared/readFileAsDataUrl'

type ImageUploadFieldProps = {
	label: string
	hint: string
	value: string
	onChange: (value: string) => void
}

const ImageUploadField = ({
	label,
	hint,
	value,
	onChange,
}: ImageUploadFieldProps) => {
	const { t } = useTranslation()
	const [error, setError] = useState('')
	const [broken, setBroken] = useState(false)

	const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]

		event.target.value = ''

		if (!file) return

		try {
			onChange(await readImageFile(file))
			setError('')
			setBroken(false)
		} catch (readError) {
			setError(
				readError instanceof Error && readError.message === 'too-large'
					? t('imageUpload.tooLarge')
					: readError instanceof Error && readError.message === 'not-image'
						? t('imageUpload.notImage')
						: t('imageUpload.readFailed'),
			)
		}
	}

	return (
		<FormControl>
			<FormLabel fontSize="sm">{label}</FormLabel>
			<Input
				type="file"
				accept="image/png,image/jpeg"
				onChange={event => void onFile(event)}
			/>
			<Text fontSize="xs" color="gray.500" mt={1}>
				{hint}
			</Text>
			{error ? (
				<Text fontSize="xs" color="red.500" mt={1}>
					{error}
				</Text>
			) : null}
			{value && !broken ? (
				<Image
					src={value}
					alt={label}
					maxH="120px"
					mt={3}
					onError={() => setBroken(true)}
				/>
			) : null}
			{value && broken ? (
				<Text fontSize="xs" color="orange.600" mt={2}>
					{t('imageUpload.notDirect')}
				</Text>
			) : null}
			{value ? (
				<Button
					size="xs"
					mt={2}
					variant="outline"
					onClick={() => {
						onChange('')
						setBroken(false)
						setError('')
					}}
				>
					{t('imageUpload.remove')}
				</Button>
			) : null}
		</FormControl>
	)
}

export default ImageUploadField
