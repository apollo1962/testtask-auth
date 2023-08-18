// ···
import mysql from 'mysql2'

// ···
import config from '../config/index.js'

export const connection = mysql.createConnection({
	uri: config.database.uri
})

export const pool = mysql.createPool({
	uri: config.database.uri,
	connectionLimit: 10
})