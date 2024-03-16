const path = require('path');
const webpack = require('webpack');
const webpackCommon = require('./webpack.common');

/** @type {import('webpack').Configuration} */
module.exports = {
  ...webpackCommon,
  entry: {
    ...webpackCommon.entry,
    background: path.resolve(__dirname, '..', 'src', 'pages', 'background.ts'),
  },
  plugins: [
    ...webpackCommon.plugins,
    new webpack.DefinePlugin({
      G_DOI_BROWSER: JSON.stringify('firefox'),
    }),
  ],
};
