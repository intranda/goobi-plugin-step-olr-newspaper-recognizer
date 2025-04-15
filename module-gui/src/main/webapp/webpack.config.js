const CopyPlugin = require("copy-webpack-plugin")
const path = require("path")
const webpack = require("webpack")
const fs = require("fs")
const homedir = require("os").homedir();

function loadConfig() {
  const fs = require("fs");
  const homedir = require("os").homedir();
  try {
    const config = fs.readFileSync(homedir + '/.config/gulp_userconfig.json')
    return config ? JSON.parse(config).tomcatLocation : '';
  } catch (err) {
    return '';
  }
};
let customLocation = loadConfig();

module.exports = (env, argv) => {
  return {
    entry: './main.js',
    output: {
        path: path.resolve(__dirname, 'resources/dist/intranda_step_newspaperRecognizer/js/'),
        //path: path.resolve(__dirname, '../GUI/META-INF/resources/uii/newspaperjs/'),
        filename: 'app.js'
    },
    module: {
      rules: [
        {
          test: /\.riot$/,
          exclude: /node_modules/,
          use: [{
            loader: '@riotjs/webpack-loader',
            options: {
              hot: false, // set it to true if you are using hmr
              // add here all the other @riotjs/compiler options riot.js.org/compiler
              // template: 'pug' for example
            }
          }]
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },
    plugins: [
      argv.mode == 'development' ? new CopyPlugin({
        patterns: [
          { from: 'resources/dist/intranda_step_newspaperRecognizer/js/',
            to: `${customLocation}dist/intranda_step_newspaperRecognizer/js/`,
          },
        ]
      }) : false,
    ]
  }
}
