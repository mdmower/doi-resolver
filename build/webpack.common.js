const path = require('path');
const purgecss = require('@fullhuman/postcss-purgecss');

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: 'production',
  entry: {
    autolink: path.resolve(__dirname, '..', 'src', 'content_scripts', 'autolink.ts'),
    bubble: path.resolve(__dirname, '..', 'src', 'pages', 'bubble.ts'),
    citation: path.resolve(__dirname, '..', 'src', 'pages', 'citation.ts'),
    context_match: path.resolve(__dirname, '..', 'src', 'content_scripts', 'context_match.ts'),
    notification: path.resolve(__dirname, '..', 'src', 'pages', 'notification.ts'),
    options: path.resolve(__dirname, '..', 'src', 'pages', 'options.ts'),
    qr: path.resolve(__dirname, '..', 'src', 'pages', 'qr.ts'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  purgecss({
                    content: ['html/*.html', 'src/pages/*.ts', 'src/css/*.scss'],
                    safelist: [/^modal-/],
                  }),
                ],
              },
            },
          },
          'sass-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
    path: path.resolve(__dirname, '..', 'dist'),
  },
};
