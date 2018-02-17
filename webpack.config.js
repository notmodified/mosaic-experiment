
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
      },
      {
        test: /\.(png|jpg|gif)$/,
        loader: 'file-loader',
      },
      {
        test: /\.worker\.js$/,
        exclude: /node_modules/,
        loaders: ['worker-loader', 'babel-loader'],
      }
    ],
  },
}

module.exports = config;
