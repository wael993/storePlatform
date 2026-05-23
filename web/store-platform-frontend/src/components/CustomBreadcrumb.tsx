// import {
// 	Breadcrumb,
// 	BreadcrumbItem,
// 	BreadcrumbLink,
// 	Text,
// } from '@chakra-ui/react'
// import { useNavigate } from 'react-router-dom'

// import { Link } from 'react-router-dom'
// import { Fragment } from 'react/jsx-runtime'
// import { AsChevronRightIcon } from './icons/ChevronRight'
// import { Icon } from '@chakra-ui/react'

// interface BreadcrumbProps {
// 	items: BreadcrumbItem[]
// 	marginTop?: string
// 	href?: string
// }

// const CustomBreadcrumb = ({ items, ...props }: BreadcrumbProps) => {
// 	return (
// 		<Breadcrumbs.Root {...props}>
// 			<Breadcrumbs.Group>
// 				{items.map(({ href, name, id, isCurrentPage }) => (
// 					<Fragment key={`breadcrumb-item-${id}`}>
// 						<Breadcrumbs.Item aria-disabled={isCurrentPage}>
// 							<Link to={href}>{name}</Link>
// 						</Breadcrumbs.Item>
// 						<Breadcrumbs.Separator>
// 							<Icon focusable="false" aria-hidden="true" role="img">
// 								<AsChevronRightIcon />
// 							</Icon>
// 						</Breadcrumbs.Separator>
// 					</Fragment>
// 				))}
// 			</Breadcrumbs.Group>
// 		</Breadcrumbs.Root>
// 	)
// }

// export default CustomBreadcrumb

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
