import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	AlertTitle,
	Box,
	Button,
	Container,
	FormControl,
	FormErrorMessage,
	FormLabel,
	Heading,
	Input,
	SimpleGrid,
	Stack,
	Text,
} from '@chakra-ui/react'

import { useAddTenantMutation } from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'
import { useTranslation } from 'react-i18next'

const createTenantSchema = (t: (key: string) => string) =>
	z
	.object({
		tenantName: z.string().min(1, t('addTenant.validation.tenantNameRequired')),
		tenantDomain: z
			.string()
			.min(1, t('addTenant.validation.tenantDomainRequired')),
		ownerFirstName: z
			.string()
			.min(1, t('addTenant.validation.firstNameRequired')),
		ownerLastName: z
			.string()
			.min(1, t('addTenant.validation.lastNameRequired')),
		ownerEmail: z.string().email(t('addTenant.validation.emailInvalid')),
		ownerPassword: z
			.string()
			.min(8, t('addTenant.validation.passwordMinLength'))
			.regex(/[a-z]/, t('addTenant.validation.passwordLowercase'))
			.regex(/\d/, t('addTenant.validation.passwordNumber')),
	})
	.superRefine((data, ctx) => {
		if (data.ownerEmail && data.tenantDomain) {
			const emailDomain = data.ownerEmail.split('@')[1]?.toLowerCase()
			if (emailDomain !== data.tenantDomain.toLowerCase()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t('addTenant.validation.emailDomainMismatch'),
					path: ['ownerEmail'],
				})
			}
		}
	})

type TenantFormData = z.infer<ReturnType<typeof createTenantSchema>>

const AddNewTenant = () => {
	const { t } = useTranslation()
	const breadcrumbs = generateBreadcrumbs()
	const tenantSchema = useMemo(() => createTenantSchema(t), [t])

	const [addTenant, { isLoading }] = useAddTenantMutation()

	const [success, setSuccess] = useState<AddTenantResponse | null>(null)
	const [serverError, setServerError] = useState<string>('')

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isValid },
	} = useForm<TenantFormData>({
		resolver: zodResolver(tenantSchema),
		mode: 'onChange',
	})

	const onSubmit = async (formData: TenantFormData) => {
		setSuccess(null)
		setServerError('')

		try {
			const response = await addTenant(formData).unwrap()
			setSuccess(response)
			reset()
		} catch (err: unknown) {
			const errorMessage =
				typeof err === 'object' &&
				err !== null &&
				'data' in err &&
				typeof (err as { data?: { message?: unknown } }).data?.message ===
					'string'
					? (err as { data: { message: string } }).data.message
					: t('addTenant.createFailed')

			setServerError(errorMessage)
		}
	}

	return (
		<Container maxW="4xl" py={10}>
			<Stack gap={6}>
				<CustomBreadcrumb items={breadcrumbs[BreadCrumbItem.ADD_NEW_TENANT]} />

				<Box>
					<Heading size="lg">{t('addTenant.title')}</Heading>
					<Text color="gray.600">
						{t('addTenant.description')}
					</Text>
				</Box>

				{serverError && (
					<Alert status="error" borderRadius="md">
						<AlertIcon />
						<AlertDescription>{serverError}</AlertDescription>
					</Alert>
				)}

				{success && (
					<Alert status="success" borderRadius="md">
						<AlertIcon />
						<Box>
							<AlertTitle>{t('addTenant.successTitle')}</AlertTitle>
							<AlertDescription>
								{t('addTenant.tenantId', { tenantId: success.tenantId })}
							</AlertDescription>
							<br />
							<AlertDescription>
								{t('addTenant.ownerUserId', {
									ownerUserId: success.ownerUserId,
								})}
							</AlertDescription>
						</Box>
					</Alert>
				)}

				<Box borderWidth="1px" borderRadius="xl" p={6}>
					<form onSubmit={handleSubmit(onSubmit)}>
						<Stack gap={5}>
							<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
								<FormControl isRequired isInvalid={Boolean(errors.tenantName)}>
									<FormLabel>{t('tenants.tenantName')}</FormLabel>
									<Input {...register('tenantName')} />
									<FormErrorMessage>
										{errors.tenantName?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl
									isRequired
									isInvalid={Boolean(errors.tenantDomain)}
								>
									<FormLabel>{t('addTenant.tenantDomain')}</FormLabel>
									<Input
										placeholder={t('addTenant.tenantDomainPlaceholder')}
										{...register('tenantDomain')}
									/>
									<FormErrorMessage>
										{errors.tenantDomain?.message}
									</FormErrorMessage>
								</FormControl>
							</SimpleGrid>

							<Heading size="sm">{t('addTenant.ownerUser')}</Heading>

							<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
								<FormControl
									isRequired
									isInvalid={Boolean(errors.ownerFirstName)}
								>
									<FormLabel>{t('addTenant.firstName')}</FormLabel>
									<Input {...register('ownerFirstName')} />
									<FormErrorMessage>
										{errors.ownerFirstName?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl
									isRequired
									isInvalid={Boolean(errors.ownerLastName)}
								>
									<FormLabel>{t('addTenant.lastName')}</FormLabel>
									<Input {...register('ownerLastName')} />
									<FormErrorMessage>
										{errors.ownerLastName?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl isRequired isInvalid={Boolean(errors.ownerEmail)}>
									<FormLabel>{t('login.email')}</FormLabel>
									<Input type="email" {...register('ownerEmail')} />
									<FormErrorMessage>
										{errors.ownerEmail?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl
									isRequired
									isInvalid={Boolean(errors.ownerPassword)}
								>
									<FormLabel>{t('addTenant.temporaryPassword')}</FormLabel>
									<Input type="password" {...register('ownerPassword')} />
									<FormErrorMessage>
										{errors.ownerPassword?.message}
									</FormErrorMessage>
								</FormControl>
							</SimpleGrid>

							<Button
								type="submit"
								colorScheme="blue"
								isLoading={isLoading}
								isDisabled={!isValid}
							>
								{t('addTenant.createTenant')}
							</Button>
						</Stack>
					</form>
				</Box>
			</Stack>
		</Container>
	)
}

export default AddNewTenant
