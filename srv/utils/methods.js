// ···
export function extractionKeyValue(input) {
	if (typeof input !== 'string') {
		throw new Error('Input is not a string')
	}

	const regex = /(\w+)\s*=\s*([^;]+)/g
	const matches = [...input.matchAll(regex)]

	const params = {}

	for (const match of matches) {
		const key = match[1]
		const value = match[2]

		params[key] = value
	}

	return params
}