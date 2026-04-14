import axios from 'axios'

const API_BASE_URL = 'http://localhost:3001/api/business-platform-store'

const apiClient = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true, // Applied globally for requests that need credentials
})

interface LoginRequest {
	email: string
	password: string
}

const api = {
	getDefaultContent: () => apiClient.get('/get-default-content'),
	login: (data: LoginRequest) => apiClient.post('/login', data),
	forgotPassword: (data: { email: string }) =>
		apiClient.post('/forgot-password', data),
	fetchProduct: (data: { productId: string }) =>
		apiClient.post('/fetch-product', data),
	postProduct: (data: { productId: string }) =>
		apiClient.post('/post-product', data),
}

export default api
