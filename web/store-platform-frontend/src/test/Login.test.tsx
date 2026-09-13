import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'

import en from '../i18n/en/translation.json'
import Login from '../pages/Login'
import { UserRole } from '../shared/globalEnums'
import { RoutePaths } from '../shared/routes'
import { TENANT_ACCESSIBLE_PAGE } from '../shared/tenantAccessiblePages'
import { createTestStore } from './createTestStore'

const navigate = vi.hoisted(() => vi.fn())
const setTenantOfflineConfig = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const ensureTenantOfflineDataIsolation = vi.hoisted(() =>
	vi.fn(() => Promise.resolve()),
)
const hydrateFromIndexedDB = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async importOriginal => {
	const actual = await importOriginal<typeof import('react-router-dom')>()

	return { ...actual, useNavigate: () => navigate }
})

vi.mock('../offline/offlineTenantAccess', () => ({
	setTenantOfflineConfig,
	ensureTenantOfflineDataIsolation,
	onAuthLogout: vi.fn(),
}))

vi.mock('../offline/productCatalogStore', () => ({
	hydrateFromIndexedDB,
}))

const server = setupServer(
	http.post('*/api/data/login', () => HttpResponse.json({}, { status: 401 })),
)

const loginUser = {
	accessToken: 't',
	userId: 'u1',
	tenantId: 'tenant-1',
	tenantName: 'Shop',
	email: 'user@example.com',
	firstName: 'A',
	lastName: 'B',
	role: UserRole.CASHIER,
}

const renderLogin = () => {
	const store = createTestStore()

	return render(
		<Provider store={store}>
			<ChakraProvider>
				<MemoryRouter>
					<Login />
				</MemoryRouter>
			</ChakraProvider>
		</Provider>,
	)
}

const signIn = async (email?: string, password?: string) => {
	const user = userEvent.setup()

	if (email) {
		await user.type(
			screen.getByPlaceholderText(en.login.emailPlaceholder),
			email,
		)
	}

	if (password) {
		await user.type(
			screen.getByPlaceholderText(en.login.passwordPlaceholder),
			password,
		)
	}

	await user.click(screen.getByRole('button', { name: en.login.signIn }))

	return user
}

describe('Login', () => {
	beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
	beforeEach(() => {
		navigate.mockReset()
		setTenantOfflineConfig.mockClear()
		ensureTenantOfflineDataIsolation.mockClear()
		hydrateFromIndexedDB.mockClear()
	})
	afterEach(() => {
		cleanup()
		server.resetHandlers()
	})
	afterAll(() => server.close())

	it('validates email and password before calling the API', async () => {
		renderLogin()
		await signIn()
		expect(screen.getByText(en.login.emailRequired)).toBeTruthy()
		cleanup()

		renderLogin()
		await signIn('foo@bar', 'password1')
		expect(screen.getByText(en.login.emailInvalid)).toBeTruthy()
		cleanup()

		renderLogin()
		await signIn('user@example.com', 'short')
		expect(screen.getByText(en.login.passwordMinLength)).toBeTruthy()
	})

	it('shows an error when the API rejects credentials', async () => {
		renderLogin()
		await signIn('user@example.com', 'password1')

		await waitFor(() => {
			expect(screen.getByText(en.login.invalidCredentials)).toBeTruthy()
		})
	})

	it('maps API error codes to login messages', async () => {
		server.use(
			http.post('*/api/data/login', () =>
				HttpResponse.json({}, { status: 429 }),
			),
		)
		renderLogin()
		await signIn('user@example.com', 'password1')
		await waitFor(() => {
			expect(screen.getByText(en.login.tooManyAttempts)).toBeTruthy()
		})
		cleanup()

		server.use(
			http.post('*/api/data/login', () =>
				HttpResponse.json({ errorCode: 'INACTIVE_TENANT' }, { status: 403 }),
			),
		)
		renderLogin()
		await signIn('user@example.com', 'password1')
		await waitFor(() => {
			expect(screen.getByText(en.login.inactiveTenant)).toBeTruthy()
		})
		cleanup()

		server.use(
			http.post('*/api/data/login', () =>
				HttpResponse.json(
					{ errorCode: 'REQUIRED_FIELD_MISSING' },
					{ status: 400 },
				),
			),
		)
		renderLogin()
		await signIn('user@example.com', 'password1')
		await waitFor(() => {
			expect(screen.getByText(en.login.validationError)).toBeTruthy()
		})
	})

	it('stores credentials and hydrates when the tenant has selling invoices', async () => {
		server.use(
			http.post('*/api/data/login', () =>
				HttpResponse.json({
					...loginUser,
					accessiblePages: [TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES],
				}),
			),
		)
		renderLogin()
		await signIn('user@example.com', 'password1')

		await waitFor(() => {
			expect(setTenantOfflineConfig).toHaveBeenCalledWith('tenant-1', undefined)
			expect(ensureTenantOfflineDataIsolation).toHaveBeenCalledWith('tenant-1')
			expect(hydrateFromIndexedDB).toHaveBeenCalledWith('tenant-1')
			expect(navigate).toHaveBeenCalledWith(RoutePaths.ROOT, {
				state: { role: UserRole.CASHIER, tenantId: 'tenant-1' },
			})
		})
	})

	it('sends super admins to add-tenant without hydrating the catalog', async () => {
		server.use(
			http.post('*/api/data/login', () =>
				HttpResponse.json({
					...loginUser,
					role: UserRole.SUPER_ADMIN,
				}),
			),
		)
		renderLogin()
		await signIn('user@example.com', 'password1')

		await waitFor(() => {
			expect(hydrateFromIndexedDB).not.toHaveBeenCalled()
			expect(navigate).toHaveBeenCalledWith(RoutePaths.ADD_NEW_TENANT, {
				state: { role: UserRole.SUPER_ADMIN, tenantId: 'tenant-1' },
			})
		})
	})

	it('asks for an email before forgot-password and shows the reset message', async () => {
		const user = userEvent.setup()
		renderLogin()

		await user.click(screen.getByText(en.login.forgotPassword))
		expect(screen.getByText(en.login.emailRequiredFirst)).toBeTruthy()

		await user.type(
			screen.getByPlaceholderText(en.login.emailPlaceholder),
			'user@example.com',
		)
		await user.click(screen.getByText(en.login.forgotPassword))
		expect(screen.getByText(en.login.resetSent)).toBeTruthy()
	})
})
