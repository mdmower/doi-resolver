const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    autolink: path.resolve(__dirname, '..', 'src', 'content_scripts', 'autolink.ts'),
    bubble: path.resolve(__dirname, '..', 'src', 'pages', 'bubble.ts'),
    citation: path.resolve(__dirname, '..', 'src', 'pages', 'citation.ts'),
    context_match: path.resolve(__dirname, '..', 'src', 'content_scripts', 'context_match.ts'),
    notification: path.resolve(__dirname, '..', 'src', 'pages', 'notification.ts'),
    offscreen: path.resolve(__dirname, '..', 'src', 'pages', 'offscreen.ts'),
    options: path.resolve(__dirname, '..', 'src', 'pages', 'options.ts'),
    qr: path.resolve(__dirname, '..', 'src', 'pages', 'qr.ts'),
    sw: path.resolve(__dirname, '..', 'src', 'sw.ts'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(scss)$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: function () {
                  return [require('autoprefixer')];
                },
              },
            },
          },
          {
            loader: 'sass-loader',
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
    path: path.resolve(__dirname, '..', 'dist'),
  },
};
