import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(path.dirname(path.dirname(__filename)))

// ···
export { path, __dirname, __filename }