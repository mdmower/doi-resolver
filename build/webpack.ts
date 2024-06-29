/**
 * @license Apache-2.0
 */

import path from 'node:path';
import purgecss from '@fullhuman/postcss-purgecss';
import {merge} from 'webpack-merge';
import {dirRef} from './utils.js';
import webpack, {Configuration} from 'webpack';

const common: Configuration = {
  mode: 'production',
  entry: {
    autolink: path.resolve(dirRef.root, 'src/autolink.ts'),
    bubble: path.resolve(dirRef.root, 'src/bubble.ts'),
    citation: path.resolve(dirRef.root, 'src/citation.ts'),
    context_match: path.resolve(dirRef.root, 'src/context_match.ts'),
    notification: path.resolve(dirRef.root, 'src/notification.ts'),
    options: path.resolve(dirRef.root, 'src/options.ts'),
    qr: path.resolve(dirRef.root, 'src/qr.ts'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
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
                  // ESM type definitions are incorrect for default purgecss import
                  (purgecss as unknown as typeof purgecss.default)({
                    content: ['src/*.html', 'src/*.ts', 'src/css/*.scss'],
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
    path: dirRef.dist,
  },
};

const chrome = merge(common, {
  entry: {
    sw: path.resolve(dirRef.root, 'src/sw.ts'),
    offscreen: path.resolve(dirRef.root, 'src/offscreen.ts'),
  },
  plugins: [
    new webpack.DefinePlugin({
      G_DOI_BROWSER: JSON.stringify('chrome'),
    }),
  ],
});

const edge = merge(common, {
  entry: {
    sw: path.resolve(dirRef.root, 'src/sw.ts'),
    offscreen: path.resolve(dirRef.root, 'src/offscreen.ts'),
  },
  plugins: [
    new webpack.DefinePlugin({
      G_DOI_BROWSER: JSON.stringify('edge'),
    }),
  ],
});

const firefox = merge(common, {
  entry: {
    background: path.resolve(dirRef.root, 'src/background.ts'),
  },
  plugins: [
    new webpack.DefinePlugin({
      G_DOI_BROWSER: JSON.stringify('firefox'),
    }),
  ],
});

export const webpackConfig = {chrome, edge, firefox};
