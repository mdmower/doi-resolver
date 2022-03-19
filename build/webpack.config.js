const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    autolink: path.resolve(__dirname, '..', 'src', 'autolink.ts'),
    background: path.resolve(__dirname, '..', 'src', 'background.ts'),
    bubble: path.resolve(__dirname, '..', 'src', 'bubble.ts'),
    citation: path.resolve(__dirname, '..', 'src', 'citation.ts'),
    context_match: path.resolve(__dirname, '..', 'src', 'context_match.ts'),
    options: path.resolve(__dirname, '..', 'src', 'options.ts'),
    qr: path.resolve(__dirname, '..', 'src', 'qr.ts'),
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
