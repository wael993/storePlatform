import { useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	AlertTitle,
	Box,
	Button,
	Container,
	FormControl,
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

const AddNewTenant = () => {
	const breadCrumbItems = generateBreadcrumbs()
	const [addTenant, { isLoading }] = useAddTenantMutation()
	const [tenantName, setTenantName] = useState('')
	const [tenantDomain, setTenantDomain] = useState('')
	const [ownerFirstName, setOwnerFirstName] = useState('')
	const [ownerLastName, setOwnerLastName] = useState('')
	const [ownerEmail, setOwnerEmail] = useState('')
	const [ownerPassword, setOwnerPassword] = useState('')
	const [success, setSuccess] = useState<AddTenantResponse | null>(null)
	const [error, setError] = useState('')

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setSuccess(null)
		setError('')

		try {
			const response = await addTenant({
				tenantName,
				tenantDomain,
				ownerFirstName,
				ownerLastName,
				ownerEmail,
				ownerPassword,
			}).unwrap()

			setSuccess(response)
			setTenantName('')
			setTenantDomain('')
			setOwnerFirstName('')
			setOwnerLastName('')
			setOwnerEmail('')
			setOwnerPassword('')
		} catch (submitError: any) {
			setError(submitError?.data?.message || 'Failed to create tenant.')
		}
	}

	return (
		<Container maxW="4xl" py={10}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadCrumbItems[BreadCrumbItem.ADD_NEW_TENANT]}
				/>
				<Box>
					<Heading size="lg">Add New Tenant</Heading>
					<Text color="gray.600">
						Super admin can register a tenant and bootstrap its owner user.
					</Text>
				</Box>

				{error ? (
					<Alert status="error" borderRadius="md">
						<AlertIcon />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				{success ? (
					<Alert status="success" borderRadius="md">
						<AlertIcon />
						<Box>
							<AlertTitle>Tenant Created</AlertTitle>
							<AlertDescription>Tenant ID: {success.tenantId}</AlertDescription>
							<AlertDescription>
								Owner User ID: {success.ownerUserId}
							</AlertDescription>
						</Box>
					</Alert>
				) : null}

				<Box borderWidth="1px" borderRadius="xl" p={6}>
					<form onSubmit={onSubmit}>
						<Stack gap={5}>
							<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
								<FormControl isRequired>
									<FormLabel>Tenant Name</FormLabel>
									<Input
										value={tenantName}
										onChange={event => setTenantName(event.target.value)}
									/>
								</FormControl>

								<FormControl isRequired>
									<FormLabel>Tenant Domain</FormLabel>
									<Input
										placeholder="example.com"
										value={tenantDomain}
										onChange={event => setTenantDomain(event.target.value)}
									/>
								</FormControl>
							</SimpleGrid>

							<Heading size="sm">Owner User</Heading>

							<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
								<FormControl isRequired>
									<FormLabel>First Name</FormLabel>
									<Input
										value={ownerFirstName}
										onChange={event => setOwnerFirstName(event.target.value)}
									/>
								</FormControl>

								<FormControl isRequired>
									<FormLabel>Last Name</FormLabel>
									<Input
										value={ownerLastName}
										onChange={event => setOwnerLastName(event.target.value)}
									/>
								</FormControl>

								<FormControl isRequired>
									<FormLabel>Email</FormLabel>
									<Input
										type="email"
										value={ownerEmail}
										onChange={event => setOwnerEmail(event.target.value)}
									/>
								</FormControl>

								<FormControl isRequired>
									<FormLabel>Temporary Password</FormLabel>
									<Input
										type="password"
										value={ownerPassword}
										onChange={event => setOwnerPassword(event.target.value)}
									/>
								</FormControl>
							</SimpleGrid>

							<Button type="submit" colorScheme="blue" isLoading={isLoading}>
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
