const path = require('path');
var webpack = require('webpack');

const baseConfig = {
  mode: 'production',
  target: 'node',
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
  },
  module: {
    rules: [
      {
        test: /.ts$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: {
                    node: true,
                  },
                },
              ],
            ],
            plugins: ["@babel/plugin-transform-typescript"],
          },
        },
      },
    ],
  },
};

const serverConfig = {
  entry: './server.ts',
  plugins: [
    new webpack.IgnorePlugin({resourceRegExp: /^pg-native$/})
  ],
  output: {
    filename: 'pg-async.js',
    path: path.resolve(__dirname, '..'),
  },
  ...baseConfig,
};

module.exports = serverConfig;