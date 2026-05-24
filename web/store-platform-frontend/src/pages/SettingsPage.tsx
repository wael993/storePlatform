import { useState } from 'react'
import {
	Box,
	Flex,
	Heading,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	VStack,
	FormControl,
	FormLabel,
	RadioGroup,
	Stack,
	Radio,
} from '@chakra-ui/react'
import { useSettings } from '../shared/context/SettingsContext'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'

const styles = {
	wrapper: {
		width: '100%',
		flexDir: 'column',
		paddingBottom: '2rem',
	},
	header: {
		flexDir: 'column',
		width: '100%',
		paddingX: '1rem',
	},
	title: {
		fontSize: '1.5rem',
		fontWeight: 700,
		marginTop: '0.4rem',
		marginBottom: '2rem',
	},
	tabsContainer: {
		width: '100%',
		paddingX: '1rem',
	},
	content: {
		paddingX: '2rem',
		paddingY: '2rem',
	},
} satisfies StylesObject

const SettingsPage = () => {
	const { productsPerPage, setProductsPerPage } = useSettings()
	const [selectedTab, setSelectedTab] = useState(0)
	const breadCrumbItems = generateBreadcrumbs()

	const handleProductsPerPageChange = (value: string) => {
		const numValue = value === 'all' ? 1000 : parseInt(value, 10)
		setProductsPerPage(numValue)
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.PRODUCTS]}
				/>
			</Flex>

			<Heading sx={styles.title} variant="h5">
				Settings
			</Heading>

			<Box sx={styles.tabsContainer}>
				<Tabs
					index={selectedTab}
					onChange={setSelectedTab}
					variant="soft-rounded"
					colorScheme="blue"
				>
					<TabList borderBottom="2px solid #EAEAEA" pb={0} mb={0}>
						<Tab>Products</Tab>
						{/* Future tabs can be added here */}
					</TabList>

					<TabPanels>
						{/* Products Tab */}
						<TabPanel sx={styles.content}>
							<VStack align="stretch" spacing={6}>
								<FormControl>
									<FormLabel fontWeight={600} mb={4}>
										Products Per Page
									</FormLabel>
									<RadioGroup
										value={
											productsPerPage === 1000
												? 'all'
												: productsPerPage.toString()
										}
										onChange={handleProductsPerPageChange}
									>
										<Stack spacing={3}>
											<Radio value="20">20 products per page</Radio>
											<Radio value="100">100 products per page</Radio>
											<Radio value="all">Show all products</Radio>
										</Stack>
									</RadioGroup>
								</FormControl>
							</VStack>
						</TabPanel>
					</TabPanels>
				</Tabs>
			</Box>
		</Flex>
	)
}

export default SettingsPage
