import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bodyParser from 'body-parser'
import multer from 'multer'
import fs from 'fs'

// ···
import config from '../config/index.js'
import { path, __dirname, __filename } from '../utils/paths.js'
import { connection, pool } from './database.js'
import { auth } from '../services/auth.js'
import {extractionKeyValue} from "../utils/methods.js";

// ···
const uploadDirectory = path.resolve(__dirname, 'uploads/')

const uploadDest = multer({
	dest: uploadDirectory
})

// ···
export default (app) => {

	// ···
	app.set('view engine', 'pug')
	app.set('views', path.join(__dirname, 'src/views'))

	// ···
	app.enable('trust proxy')

	// ···
	app.use(cors())
	app.use(bodyParser.json())
	app.use(bodyParser.urlencoded({ extended: true }))

	// ···
	app.use('/dist', express.static(path.join(__dirname, 'src/dist')))
	app.use('/static', express.static(path.join(__dirname, 'src/static')))

	// /signin [POST]
	app.post('/signin', (request, response) => {
		const email = request.body.email
		const password = request.body.password

		auth.signIn(email, password, (error, userId) => {
			if (error) {
				response.status(500).json({message: 'An error occurred'})
			} else if (!userId) {
				response.status(401).json({message: 'Could not sign in, try again later'})
			} else {
				const accessToken = auth.generateAccessToken(userId, '10m')
				const refreshToken = auth.generateAccessToken(userId, '30d')

				// ···
				response.cookie('userId', userId, { httpOnly: true })
				
				// ···
				response.cookie('Authorization', accessToken, { httpOnly: true })
				response.cookie('Refresh-Token', refreshToken, { httpOnly: true })

				response.json({ message: 'Bearer-token request by id and password: ' + accessToken})
			}
		})
	})

	// /signin/new_token [POST]
	app.post('/signin/new_token', (request, response) => {
		const userId = auth.getUserId(req.body.username, request.body.password)

		if (!userId) {
			response.status(401).json({ message: 'Invalid credentials' })
		} else {
			const newAccessToken = jwt.sign({
				id: userId
			}, config.JWT_SECRET, {
				expiresIn: '10m'
			})

			response.json({accessToken: newAccessToken})
		}
	})

	// /signup [POST]
	app.post('/signup', async (request, response) => {
		const { username, email, password } = request.body
		const hashPassword = await auth.hashPassword(password)

		try {
			const userExists = await auth.userExists(username)

			if (userExists) {
				response.status(400).json({message: 'User with this email already exists'})
			} else {
				const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'

				pool.query(sql, [username, email, hashPassword], (insertError, insertResult) => {
					if (insertError) {
						console.error('Error inserting user:', insertError)
						response.status(500).json({ message: 'Internal server error' })
					} else {
						response.json({message: 'User registered successfully'})
					}
				})
			}
		} catch (error) {
			console.error('Error checking user:', error)
			response.status(500).json({message: 'Internal server error'})
		}
	})

	// /file/upload [POST]
	app.post('/file/upload', uploadDest.single('file'), (request, response) => {
		const { originalname, mimetype, size, path: tempPath } = request.file
		const { name, ext } = path.parse(originalname)

		const uploadDate = new Date()

		const sql = 'INSERT INTO files (name, extension, mime_type, size, upload_date) VALUES (?, ?, ?, ?, ?)'

		pool.query(sql, [name, ext.slice(1), mimetype, size, uploadDate], (error, result) => {
			if (error) {
				console.error('Error inserting file:', error)
				response.status(500).json({message: 'Internal server error'})
			} else {
				const destinationPath = path.join(uploadDirectory, `${name}${ext}`)

				// ···
				fs.rename(tempPath, destinationPath, (renameError) => {
					if (renameError) {
						console.error('Error renaming file:', renameError)
						response.status(500).json({message: 'Internal server error'})
					} else {
						response.json({message: 'Uploaded!'})
					}
				})
			}
		})
	})

	// /file/list [GET]
	app.get('/file/list', (request, response) => {
		const size = parseInt(request.query.list_size) || 10
		const page = parseInt(request.query.page) || 1

		const startIndex = (page - 1) * size

		const sql = 'SELECT * FROM files LIMIT ?, ?'

		pool.query(sql, [startIndex, size], (error, results) => {
			if (error) {
				console.error('Error:', error)
				response.status(500).json({message: 'Internal server error'})
			} else {
				response.json(results)
			}
		})
	})

	// /file/delete/:id [DELETE]
	app.delete('/file/delete/:id', async (request, response) => {
		try {
			const fileId = request.params.id

			const selectSql = 'SELECT * FROM files WHERE id = ?'
			const [results] = await pool.promise().execute(selectSql, [fileId])

			if (results.length === 0) {
				response.status(404).json({message: 'File not found'})
				return
			}

			const file = results[0]
			const filePath = path.join(uploadDirectory, file.name + '.' + file.extension)

			const deleteSql = 'DELETE FROM files WHERE id = ?'
			await pool.promise().execute(deleteSql, [fileId])

			fs.unlink(filePath, async (unlinkError) => {
				if (unlinkError) {
					console.error('Error deleting file:', unlinkError)
					response.status(500).json({message: 'Internal server error'})
				} else {
					response.json({message: 'File deleted successfully'})
				}
			})

		} catch (error) {
			console.error('Error:', error)
			response.status(500).json({message: 'Internal server error'})
		}
	})

	// /file/:id [GET]
	app.get('/file/:id', (request, reseponse) => {
		const fileId = request.params.id

		const sql = 'SELECT * FROM files WHERE id = ?'

		pool.query(sql, [fileId], (error, results) => {
			if (error) {
				console.error('Error:', error)
				reseponse.status(500).json({message: 'Internal server error'})
			} else if (results.length === 0) {
				reseponse.status(404).json({message: 'File not found'})
			} else {
				const file = results[0]
				reseponse.json(file)
			}
		})
	})

	// /file/download/:id [GET]
	app.get('/file/download/:id', (request, response) => {
		const fileId = request.params.id

		const sql = 'SELECT * FROM files WHERE id = ?'

		pool.query(sql, [fileId], (error, results) => {
			if (error) {
				console.error('Error:', error)
				response.status(500).json({message: 'Internal server error'})
			} else if (results.length === 0) {
				response.status(404).json({message: 'File not found'})
			} else {
				const file = results[0]
				const filePath = path.join(uploadDirectory, file.name + '.' + file.extension)

				// ···
				response.setHeader('Content-Disposition', `attachment; filename="${file.name}.${file.extension}"`)
				response.setHeader('Content-Type', file.mime_type)

				const stream = fs.createReadStream(filePath)
				stream.pipe(response)
			}
		})
	})

	// /file/update/:id [PUT]
	app.put('/file/update/:id', uploadDest.single('file'), async (request, response) => {
		const fileId = request.params.id

		try {
			const selectSql = 'SELECT * FROM files WHERE id = ?'
			const [results] = await pool.promise().execute(selectSql, [fileId])

			if (results.length === 0) {
				response.status(404).json({message: 'File not found'})
				return
			}

			const existFile = results[0]
			const existFilePath = path.join(uploadDirectory, `${existFile.name}.${existFile.extension}`)

			// ···
			fs.unlink(existFilePath, async (deleteError) => {
				if (deleteError) {
					console.error('Error deleting old file:', deleteError)
					response.status(500).json({message: 'Internal server error'})
					return
				}

				// ···
				const { originalname } = request.file
				const { name: uploadName, ext: uploadExt } = path.parse(originalname)
				const uploadFilePath = path.join(uploadDirectory, `${uploadName}${uploadExt}`)

				// ···
				const updateSql = 'UPDATE files SET name = ?, extension = ?, mime_type = ?, size = ? WHERE id = ?'

				try {
					await pool.promise().execute(updateSql, [uploadName, uploadExt.slice(1), request.file.mimetype, request.file.size, fileId])

					// ···
					fs.rename(request.file.path, uploadFilePath, (renameError) => {
						if (renameError) {
							console.error('Error replacing file:', renameError)
							response.status(500).json({message: 'Internal server error'})
						} else {
							Logger.info(`File ${existFile.name}.${existFile.extension} replaced with ${uploadName}${uploadExt}`)
							response.json({message: 'Updated!'})
						}
					})
				} catch (updateError) {
					console.error('Error updating file information:', updateError)
					response.status(500).json({message: 'Internal server error'})
				}
			})
		} catch (error) {
			console.error('Error:', error)
			response.status(500).json({message: 'Internal server error'})
		}
	})

	// /info [GET]
	app.get('/info', auth.authenticateToken, (request, response) => {
		const cookieHeader = request.headers.cookie.split(';').join(';')
		const cookiesRetriev = extractionKeyValue(cookieHeader)
		const userId = cookiesRetriev.userId

		response.json({message: `Welcome: ${userId}`})
	})

	app.get('/logout', (request, response) => {
		response.clearCookie('Authorization')
		response.clearCookie('Refresh-Token')
		response.clearCookie('userId')

		response.status(200).json({message: 'Logged out successfully'})
	})

	// Handler for termination
	app.use((request, response, next) => {
		pool.end()
	})

}