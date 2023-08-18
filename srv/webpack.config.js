// # webpack.config.js

// ···
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

// ···
import { path, __dirname, __filename } from './utils/paths.js'

export default {
	mode: 'development',
	entry: '../src/app.js',
	output: {
		path: path.resolve(__dirname, 'src/dist'),
		filename: 'bundle.js'
	},

	experiments: {
		topLevelAwait: true
	},

	module: {
		rules: [
			{
				test: /.s[ac]ss$/i,
				use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
			},
			{
				test: /.css$/i,
				use: [MiniCssExtractPlugin.loader, 'css-loader'],
			}
		]
	},

	plugins: [
		new MiniCssExtractPlugin({
			filename: 'style.css',
		})
	],

	resolve: {
		alias: {
			'src': path.resolve(__dirname, 'src/')
		},
	},

	watch: true
}