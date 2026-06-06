import { useState } from 'react'
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

const createTenantSchema = z
	.object({
		tenantName: z.string().min(1, 'Tenant name is required'),
		tenantDomain: z.string().min(1, 'Tenant domain is required'),
		ownerFirstName: z.string().min(1, 'First name is required'),
		ownerLastName: z.string().min(1, 'Last name is required'),
		ownerEmail: z.string().email('Please enter a valid email address'),
		ownerPassword: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.regex(/[a-z]/, 'Must contain at least one lowercase letter')
			.regex(/\d/, 'Must contain at least one number'),
	})
	.superRefine((data, ctx) => {
		if (data.ownerEmail && data.tenantDomain) {
			const emailDomain = data.ownerEmail.split('@')[1]?.toLowerCase()
			if (emailDomain !== data.tenantDomain.toLowerCase()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Owner email domain must match tenant domain',
					path: ['ownerEmail'],
				})
			}
		}
	})

type TenantFormData = z.infer<typeof createTenantSchema>

const AddNewTenant = () => {
	const breadcrumbs = generateBreadcrumbs()

	const [addTenant, { isLoading }] = useAddTenantMutation()

	const [success, setSuccess] = useState<AddTenantResponse | null>(null)
	const [serverError, setServerError] = useState<string>('')

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isValid },
	} = useForm<TenantFormData>({
		resolver: zodResolver(createTenantSchema),
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
					: 'Failed to create tenant.'

			setServerError(errorMessage)
		}
	}

	return (
		<Container maxW="4xl" py={10}>
			<Stack gap={6}>
				<CustomBreadcrumb items={breadcrumbs[BreadCrumbItem.ADD_NEW_TENANT]} />

				<Box>
					<Heading size="lg">Add New Tenant</Heading>
					<Text color="gray.600">
						Super administrators can register a tenant and provision its owner
						account.
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
							<AlertTitle>Tenant Created Successfully</AlertTitle>
							<AlertDescription>Tenant ID: {success.tenantId}</AlertDescription>
							<br />
							<AlertDescription>
								Owner User ID: {success.ownerUserId}
							</AlertDescription>
						</Box>
					</Alert>
				)}

				<Box borderWidth="1px" borderRadius="xl" p={6}>
					<form onSubmit={handleSubmit(onSubmit)}>
						<Stack gap={5}>
							<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
								<FormControl isRequired isInvalid={Boolean(errors.tenantName)}>
									<FormLabel>Tenant Name</FormLabel>
									<Input {...register('tenantName')} />
									<FormErrorMessage>
										{errors.tenantName?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl
									isRequired
									isInvalid={Boolean(errors.tenantDomain)}
								>
									<FormLabel>Tenant Domain</FormLabel>
									<Input
										placeholder="example.com"
										{...register('tenantDomain')}
									/>
									<FormErrorMessage>
										{errors.tenantDomain?.message}
									</FormErrorMessage>
								</FormControl>
							</SimpleGrid>

							<Heading size="sm">Owner User</Heading>

							<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
								<FormControl
									isRequired
									isInvalid={Boolean(errors.ownerFirstName)}
								>
									<FormLabel>First Name</FormLabel>
									<Input {...register('ownerFirstName')} />
									<FormErrorMessage>
										{errors.ownerFirstName?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl
									isRequired
									isInvalid={Boolean(errors.ownerLastName)}
								>
									<FormLabel>Last Name</FormLabel>
									<Input {...register('ownerLastName')} />
									<FormErrorMessage>
										{errors.ownerLastName?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl isRequired isInvalid={Boolean(errors.ownerEmail)}>
									<FormLabel>Email</FormLabel>
									<Input type="email" {...register('ownerEmail')} />
									<FormErrorMessage>
										{errors.ownerEmail?.message}
									</FormErrorMessage>
								</FormControl>

								<FormControl
									isRequired
									isInvalid={Boolean(errors.ownerPassword)}
								>
									<FormLabel>Temporary Password</FormLabel>
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
								Create Tenant
							</Button>
						</Stack>
					</form>
				</Box>
			</Stack>
		</Container>
	)
}

export default AddNewTenant
