const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
// const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const extractSass = new ExtractTextPlugin({
  filename: '[name].[hash].css',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = {
  // context: path.resolve(__dirname, 'src'),

  entry: {
    app: ['./index.js'],
  },
  cache: false,
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'docs'),
    filename: '[name].[hash].js',
  },
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [

      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test:/\.(s*)css$/,
        use: extractSass.extract({
          use: [
            {
              loader: 'css-loader',
            },
            {
              loader: 'sass-loader',
            },
          ],
          fallback: [
            {
              loader: 'style-loader',
            },
          ],
        }),
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/,
        loader: 'url-loader',
          options: { 
              limit: 8000, // Convert images < 8kb to base64 strings
              name: 'images/[hash]-[name].[ext]'
          } 
      },      
      {
        test: /\.html$/,
        loader: 'html-loader',
        options: {
          // otherwise inline SVG fails with a parse error!
          minimize: false
        }
      },
    ],
  },

  plugins: [

    // // this seems to take forever!! but needed for tree-shaking
    // new UglifyJSPlugin({
    //   uglifyOptions: {
    //     compress: {
    //       warnings: false,
    //     },
    //     output: {
    //       comments: false
    //     }
    //   },
    //   sourceMap: true
    // }),

    extractSass,

    new CompressionPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: /\.js$|\.css$|\.html$/,
      threshold: 10240,
      minRatio: 0,
    }),
    new ExtractTextPlugin('app.[hash].css'),
    new HtmlWebpackPlugin({
      template: './index.html'
    }),
  ],

};
