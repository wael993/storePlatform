import { ChakraProvider } from '@chakra-ui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import en from '../i18n/en/translation.json'
import Login from '../pages/Login'
import { createTestStore } from './createTestStore'

const server = setupServer(
	http.post('*/api/data/login', () => HttpResponse.json({}, { status: 401 })),
)

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

describe('Login', () => {
	beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
	afterEach(() => server.resetHandlers())
	afterAll(() => server.close())

	it('shows an error when the API rejects credentials', async () => {
		const user = userEvent.setup()
		renderLogin()

		await user.type(
			screen.getByPlaceholderText(en.login.emailPlaceholder),
			'user@example.com',
		)
		await user.type(
			screen.getByPlaceholderText(en.login.passwordPlaceholder),
			'password1',
		)
		await user.click(screen.getByRole('button', { name: en.login.signIn }))

		await waitFor(() => {
			expect(screen.getByText(en.login.invalidCredentials)).toBeTruthy()
		})
	})
})
