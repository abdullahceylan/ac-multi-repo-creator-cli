import fs from 'fs';
import path from 'path';
import copy from 'copyfiles';

const assets = {
  copy: (from, to) => {
    const options = {
      up: from.split(path.sep).length - 2,
      all: true,
      flat: true,
    };
    return new Promise((resolve, reject) =>
      copy([from, to], options, (err) => (err ? reject(err) : resolve())),
    );
  },

  getDirectories: (path) =>
    fs.readdirSync(path).filter((file) => fs.statSync(path + '/' + file).isDirectory()),

  mkdirp: (pathToCreate) => {
    fs.mkdirpSync(pathToCreate);
  },
};

module.exports = assets;
module.exports.default = assets;
