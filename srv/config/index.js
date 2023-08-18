// ···
import dotenv from 'dotenv'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// ···
const env = dotenv.config({
	path: './.env'
})

if (env.error) {
	throw new Error(`⚠️ Couldn't find .env file ⚠️`)
}

// ···
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
	throw new Error(`⚠️ JWT_SECRET not found in .env file ⚠️`);
}

export default {
	port:
		parseInt(process.env.PORT, 10),

	logs: {
		level:
			process.env.LOG_LEVEL || 'silly'
	},

	JWT_SECRET: JWT_SECRET,

	database: {
		uri: process.env.DB_URI,
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_DATABASE
	}
}