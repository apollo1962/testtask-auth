// ···
import express from 'express'

// ···
import config from './config/index.js'
import loader from './loaders/index.js'

async function startServer() {
	const app = express()

	await loader(app)

	app.listen(config.port, () => {
		console.log('server is running')
	}).on('error', error => {
		process.exit(1)
	})
}

startServer()