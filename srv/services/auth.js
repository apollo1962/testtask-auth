// ···
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

// ···
import config from '../config/index.js'
import { connection, pool } from '../loaders/database.js'
import { extractionKeyValue } from '../utils/methods.js'

export class auth {

	static signIn(email, password, callback) {
		const sql = 'SELECT id, password FROM users WHERE email = ?'

		pool.query(sql, [email], async (error, results) => {
			if (error) {
				callback(error, null);
			} else if (results.length === 0) {
				callback(null, null);
			} else {
				const userId = results[0].id
				const hashedPassword = results[0].password

				try {
					const passwordMatch = await bcrypt.compare(password, hashedPassword)

					if (passwordMatch) {
						callback(null, userId)
					} else {
						callback(null, null)
					}
				} catch (compareError) {
					callback(compareError, null)
				}
			}
		})
	}

	static authenticateToken(request, response, next) {
		const cookieHeader = request.headers.cookie.split(';').join(';')
		const cookiesRetriev = extractionKeyValue(cookieHeader)
		const Authorization = cookiesRetriev.Authorization

		jwt.verify(Authorization, config.JWT_SECRET, (error, decoded) => {
			if (error) {
				if (error.name === 'TokenExpiredError') {

					// Access-token expired, let's try to renew it
					const refreshToken = cookiesRetriev['Refresh-Token']

					jwt.verify(refreshToken, config.JWT_SECRET, (refreshError, refreshDecoded) => {
						if (refreshError) {

							// Refresh-token expired too, send 403
							response.sendStatus(403)
						} else {

							// Create new access-token and send it
							const newAccessToken = auth.generateAccessToken(refreshDecoded.id)
							response.cookie('Authorization', newAccessToken, { httpOnly: true })

							// Put user id into request
							response.user = refreshDecoded
							next()
						}
					})
				} else {
					// Some other error, send 403
					response.sendStatus(403)
				}
			} else {

				// Access-token is valid, put user id into request
				response.user = decoded

				// ···
				next()
			}
		})
	}

	static generateAccessToken(userId, expiresIn = '10m') {
		const accessToken = jwt.sign(
			{ id: userId },
			config.JWT_SECRET,
			{ expiresIn: expiresIn }
		)

		return accessToken
	}

	static async hashPassword(password) {
		return await bcrypt.hash(password, 10)
	}

	static async userExists(username) {
		return new Promise((resolve, reject) => {
			const sql = 'SELECT * FROM users WHERE email = ?'

			pool.query(sql, [username], (error, result) => {
				if (error) {
					console.error('Error finding user:', error)
					reject(error)
				} else {
					resolve(result.length > 0)
				}
			})
		})
	}

}