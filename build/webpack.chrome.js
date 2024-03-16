const path = require('path');
const webpack = require('webpack');
const webpackCommon = require('./webpack.common');

/** @type {import('webpack').Configuration} */
module.exports = {
  ...webpackCommon,
  entry: {
    ...webpackCommon.entry,
    sw: path.resolve(__dirname, '..', 'src', 'sw.ts'),
    offscreen: path.resolve(__dirname, '..', 'src', 'pages', 'offscreen.ts'),
  },
  plugins: [
    ...webpackCommon.plugins,
    new webpack.DefinePlugin({
      G_DOI_BROWSER: JSON.stringify('chrome'),
    }),
  ],
};
