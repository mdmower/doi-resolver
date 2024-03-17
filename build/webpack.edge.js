/**
 * @license Apache-2.0
 */

const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: {
    sw: path.resolve(__dirname, '..', 'src', 'sw.ts'),
    offscreen: path.resolve(__dirname, '..', 'src', 'pages', 'offscreen.ts'),
  },
  plugins: [
    new webpack.DefinePlugin({
      G_DOI_BROWSER: JSON.stringify('edge'),
    }),
  ],
};
