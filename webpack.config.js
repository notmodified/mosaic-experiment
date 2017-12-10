
const config = {
  entry: './src/app.js',
  output: {
    filename: 'app.js',
    path: __dirname + '/dist',
  },
  devServer: {
    contentBase: __dirname + '/dist',
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loaders: ['babel-loader'],
      },
      {
        test: /\.scss?$/,
        exclude: /node_modules/,
        loaders: ['style-loader', 'css-loader', 'sass-loader'],
      }
    ],
  },
}

module.exports = config;
