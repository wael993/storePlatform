import { ChevronRightIcon } from '@chakra-ui/icons'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	Text,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

interface BreadcrumbProps {
	items: BreadcrumbItem[]
	marginTop?: string
}

const CustomBreadcrumb = ({ items, marginTop }: BreadcrumbProps) => {
	const navigate = useNavigate()

	const handleClick = (href: string, e: React.MouseEvent) => {
		e.preventDefault()
		navigate(href)
	}

	const styles: StylesObject = {
		mainContainer: {
			marginTop: marginTop ?? '2rem',
		},
		separator: {
			color: '#939596',
		},
		item: {
			color: '#939596',
			fontSize: '0.75rem',
			lineHeight: '1rem',
			fontWeight: '700',
		},
	}

	const separator = <ChevronRightIcon sx={styles.separator} />

	return (
		<Breadcrumb separator={separator} sx={styles.mainContainer}>
			{items.map(item => (
				<BreadcrumbItem key={item.id} isCurrentPage={item.isCurrentPage}>
					<BreadcrumbLink
						href={item.href}
						onClick={e =>
							!item.isCurrentPage && item.href && handleClick(item.href, e)
						}
					>
						<Text
							sx={{
								...styles.item,
								cursor: !item.isCurrentPage ? 'pointer' : 'default',
							}}
						>
							{item.name}
						</Text>
					</BreadcrumbLink>
				</BreadcrumbItem>
			))}
		</Breadcrumb>
	)
}

export default CustomBreadcrumb
