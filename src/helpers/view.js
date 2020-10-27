import semver from 'semver';
import boxen from 'boxen';
import { white, red, yellow } from 'kleur';
import updater from 'update-notifier';
import notifier from 'node-notifier';
import execa from 'execa';
import helpers from './index';

// Info box options
const boxOptions = {
  padding: 1,
  margin: 1,
  borderStyle: 'round',
  borderColor: 'gray',
};

module.exports = {
  teaser() {
    const versions = [
      `Node: ${helpers.info.getNodeVersion()}`,
      `CLI: ${helpers.info.getCliVersion()}`,
    ];

    // Check if update is available
    updater({
      pkg: { name: helpers.info.getProjectName(), version: helpers.info.getCliVersion() },
    }).notify({ isGlobal: true });

    this.log();
    this.log(
      boxen(white(`${helpers.info.getApplicationName()} [${versions.join(', ')}]`), boxOptions),
    );

    // Warn user if try to execute the app using `sudo`
    this.warnAboutSudoUsage();

    // Warn user if node version is old
    this.warnAboutNodeVersion();
  },

  log() {
    console.log.apply(this, arguments);
  },

  error(error, debug = false) {
    let message = error;
    const extraMessages = [];

    if (error instanceof Error) {
      message = !debug ? error.message : error.stack;
    }

    if (debug && error.original) {
      extraMessages.push(error.original.message);
    }

    this.log();
    console.error(`${red('ERROR:')} ${message}`);
    extraMessages.forEach((message) => console.error(`${red('EXTRA MESSAGE:')} ${message}`));
    this.log();

    notifier.notify({
      title: 'Repo creation has failed!',
      message: message,
    });

    process.exit(1);
  },

  warn(message) {
    this.log(`${yellow('WARNING:')} ${message}`);
  },

  async warnAboutGHVersion() {
    const MIN_GH_VERSION = '1.1.0';
    return new Promise(async (resolve, reject) => {
      const { stdout } = await execa('gh', ['--version']);

      const output = stdout.split(' ');
      const version = output?.[2] || 0;

      if (semver.satisfies(version, `>=${MIN_GH_VERSION}`) === false) {
        reject(new Error(`Please upgrade your GitHub CLI to ${MIN_GH_VERSION}. Yours ${version}`));
      } else {
        resolve(true);
      }
    });
  },

  warnAboutNodeVersion() {
    // Required min version of node.js
    // To able to use `copyFile` method we need
    // minimun 8.5.0 version
    const MIN_NODE_VERSION = '10.0.0';
    // if node.js version doesn't meet the required version
    // give an error.
    if (semver.satisfies(process.version, `>=${MIN_NODE_VERSION}`) === false) {
      this.log();
      this.error(
        `${helpers.info.getApplicationName()} requires at least Node.js ${MIN_NODE_VERSION} or higher (you have ${
          process.version
        }), please upgrade your Node to the latest stable version.`,
      );
    }
  },

  warnAboutSudoUsage() {
    // if user try to execute the app using `sudo` then display a warning
    if (process.getuid && process.getuid() === 0) {
      this.log();
      this.warn(
        `${helpers.info.getApplicationName()} doesn't need superuser privileges. Don't run it under root!`,
      );
    }
  },
};
