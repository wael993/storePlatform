import { closeDb } from '../db'
import { insertDoc } from '../db/docs'
import { pgFindOneAndUpdate } from '../db/mongoQuery'
import bcrypt from 'bcrypt'
import User from '../models/User'
import Tenant from '../models/Tenant'
import {
	DEFAULT_TENANT_DOMAIN,
	DEFAULT_TENANT_ID,
	DEFAULT_TENANT_NAME,
} from '../shared/tenant'

// Admin user details - CHANGE THESE
//to run this script, use: `ts-node scripts/create-admin-user.ts`
const INITIAL_USERS = [
	{
		userId: '32165498765432164',
		displayName: 'Wael Zobani admin',
		user: { firstName: 'wael', lastName: 'Zobani' },
		email: 'admin@example.com',
		password: 'admin123', // Minimum 6 chars
		role: 'owner',
		avatarColorId: 3215,
	},
	{
		userId: '654987654987654987',
		displayName: 'Wael Zobani worker',
		user: { firstName: 'wael', lastName: 'Zobani' },
		email: 'editor@example.com',
		password: 'editor123', // Minimum 6 chars
		role: 'admin',
		avatarColorId: 321522,
	},
]

async function createInitialUsers() {
	try {
		await pgFindOneAndUpdate(
			Tenant,
			DEFAULT_TENANT_ID,
			{},
			{
				$set: {
					name: DEFAULT_TENANT_NAME,
					domain: DEFAULT_TENANT_DOMAIN,
					status: 'active',
				},
			},
			{ upsert: true },
		)

		// Delete all existing users
		// await User.deleteMany({ tenantId: DEFAULT_TENANT_ID } as any)
		// console.log('🗑️  All existing users deleted')

		// Create initial users
		for (const userData of INITIAL_USERS) {
			// Hash password
			const hashedPassword = await bcrypt.hash(userData.password, 10)

			// Create user
			const user = (await insertDoc(User, {
				tenantId: DEFAULT_TENANT_ID,
				userId: userData.userId,
				displayName: userData.displayName,
				user: {
					firstName: userData.user.firstName,
					lastName: userData.user.lastName,
					// isInternal: userData.user.isInternal,
				},
				email: userData.email,
				password: hashedPassword,
				role: userData.role,
				avatarColorId: userData.avatarColorId,
				createdBy: { _id: 'seed', displayName: 'seed', createdAt: new Date() },
			})) as unknown as InstanceType<typeof User>

			console.log(
				`✅ ${userData.role.toUpperCase()} user created successfully!`,
			)

			console.log('👤 _id:', user.userId)
			console.log('👤 displayName:', user.displayName)
			console.log('📧 Email:', user.email)
			console.log('🏢 Tenant:', DEFAULT_TENANT_ID)
			console.log('🎭 Role:', user.role)
			console.log('🎭 firstName:', user.user.firstName)
			console.log('🎭 lastName:', user.user.lastName)
			// console.log('🎭 isInternal:', user.user.isInternal)

			console.log('')
			console.log('🚀 Login at: POST http://localhost:3001/api/data/login')
			console.log(
				'📝 Body: {"email": "' +
					user.email +
					'", "password": "' +
					userData.password +
					'"}',
			)

			console.log('─'.repeat(50))
		}
	} catch (error) {
		console.error('❌ Error creating initial users:', error)
		process.exit(1)
	} finally {
		await closeDb()
	}
}

createInitialUsers()
