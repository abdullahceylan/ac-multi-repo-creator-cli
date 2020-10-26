import path from 'path';

const packageJson = require(path.resolve(__dirname, '..', '..', 'package.json'));

module.exports = {
  getCliVersion: () => packageJson.version,

  getNodeVersion: () => process.version.replace('v', ''),

  getApplicationName: () => 'AC Multi Repo Creator CLI',

  getProjectName: () => packageJson.name,

  getUserHomeDir: () => require('os').homedir(),

  getAppRoot: () => path.resolve(__dirname, '..'),

  getCurrentDir: () => process.cwd(),
};
