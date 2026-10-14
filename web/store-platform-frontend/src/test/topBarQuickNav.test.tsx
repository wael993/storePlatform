import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'

import TopBar from '../components/TopBar'
import { RoutePaths } from '../shared/routes'
import { createTestStore } from './createTestStore'

const navItems = [
	{ label: 'Welcome', path: RoutePaths.ROOT },
	{ label: 'Dashboard', path: RoutePaths.DASHBOARD },
	{ label: 'Products', path: RoutePaths.PRODUCTS },
	{ label: 'Customers', path: RoutePaths.CUSTOMERS },
	{ label: 'Suppliers', path: RoutePaths.SUPPLIERS },
	{ label: 'Selling Invoices', path: RoutePaths.SELLING_INVOICES },
	{ label: 'Employees', path: RoutePaths.EMPLOYEES },
]

const renderBar = (pathname: string, items = navItems) =>
	render(
		<Provider store={createTestStore()}>
			<ChakraProvider>
				<MemoryRouter initialEntries={[pathname]}>
					<TopBar navItems={items} userName="Test" onLogout={() => undefined} />
				</MemoryRouter>
			</ChakraProvider>
		</Provider>,
	)

const quickLinks = () => screen.getAllByRole('link', { hidden: true })

describe('TopBar quick nav', () => {
	beforeEach(() => {
		window.matchMedia = (query: string) =>
			({
				matches: false,
				media: query,
				onchange: null,
				addListener: () => undefined,
				removeListener: () => undefined,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
				dispatchEvent: () => false,
			}) as MediaQueryList
	})

	afterEach(() => {
		cleanup()
	})

	it('shows the welcome-page sections in order and marks the open section', () => {
		renderBar(`${RoutePaths.PRODUCTS}/p1`)

		const links = quickLinks()
		expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
			'Dashboard',
			'Products',
			'Customers',
			'Suppliers',
			'Selling Invoices',
		])
		expect(links.map(link => link.getAttribute('href'))).toEqual([
			RoutePaths.DASHBOARD,
			RoutePaths.PRODUCTS,
			RoutePaths.CUSTOMERS,
			RoutePaths.SUPPLIERS,
			RoutePaths.SELLING_INVOICES,
		])
		expect(links[1].getAttribute('aria-current')).toBe('page')
		expect(links[0].getAttribute('aria-current')).toBeNull()
		expect(getComputedStyle(links[1]).width).not.toBe(
			getComputedStyle(links[0]).width,
		)
		const nav = links[0].parentElement
		if (!nav) throw new Error('quick nav missing')
		expect(getComputedStyle(nav).display).toBe('none')
	})

	it('hides a section the menu does not allow', () => {
		renderBar(
			RoutePaths.DASHBOARD,
			navItems.filter(item => item.path !== RoutePaths.SUPPLIERS),
		)

		expect(quickLinks().map(link => link.getAttribute('aria-label'))).toEqual([
			'Dashboard',
			'Products',
			'Customers',
			'Selling Invoices',
		])
		expect(quickLinks()[0].getAttribute('aria-current')).toBe('page')
	})
})
