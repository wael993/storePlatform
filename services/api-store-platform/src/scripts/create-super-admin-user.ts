import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/config'
import User from '../models/User'
import Tenant from '../models/Tenant'

const SUPER_ADMIN_TENANT = {
	tenantId: 'super-admin',
	name: 'Super Admin Control',
	domain: 'superadmin.de',
	status: 'active' as const,
}

const SUPER_ADMIN_USER = {
	email: 'wael@superadmin.de',
	password: 'S-uAboMHDZain010203',
	firstName: 'Wael',
	lastName: 'SuperAdmin',
	role: 'super_admin' as const,
}

async function createSuperAdminUser() {
	try {
		await mongoose.connect(config.mongoDB.connectionString)
		console.log('Connected to MongoDB')

		await User.syncIndexes()

		await Tenant.updateOne(
			{ tenantId: SUPER_ADMIN_TENANT.tenantId },
			{ $set: SUPER_ADMIN_TENANT },
			{ upsert: true },
		)

		await User.deleteMany({
			tenantId: SUPER_ADMIN_TENANT.tenantId,
			email: SUPER_ADMIN_USER.email,
		} as any)

		const hashedPassword = await bcrypt.hash(SUPER_ADMIN_USER.password, 10)

		const user = await User.create({
			tenantId: SUPER_ADMIN_TENANT.tenantId,
			userId: uuidv4(),
			displayName: `${SUPER_ADMIN_USER.firstName} ${SUPER_ADMIN_USER.lastName}`,
			user: {
				firstName: SUPER_ADMIN_USER.firstName,
				lastName: SUPER_ADMIN_USER.lastName,
				isInternal: true,
			},
			email: SUPER_ADMIN_USER.email,
			password: hashedPassword,
			role: SUPER_ADMIN_USER.role,
			avatarColorId: Math.floor(Math.random() * 1000000),
		})

		console.log('Super admin user created')
		console.log('Email:', user.email)
		console.log('Password:', SUPER_ADMIN_USER.password)
		console.log('Login URL: POST http://localhost:3001/api/data/login')
	} catch (error) {
		console.error('Failed to create super admin user:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
	}
}

createSuperAdminUser()
