#!/usr/bin/env node
/* eslint-disable default-case */
import fs from 'fs';
import { join } from 'path';
import Listr from 'listr';
import execa from 'execa';
import program from 'commander';
import notifier from 'node-notifier';
import lineReader from 'line-reader';
import renderer from '@abdullahceylan/listr-aggregate-renderer';
import helpers from './helpers';

const log = [];

// Warn user if try to execute the app using `sudo`
helpers.view.teaser();

const githubCreate = ({ name, type, target }) => {
  return new Promise(
    async (resolve, reject) =>
      await execa('gh', [
        'repo',
        'create',
        `--${type || 'public'}`,
        '--confirm',
        `--init-base-dir=${target}`, // https://github.com/cli/cli/pull/2098
        name,
      ])
        .then((res) => resolve(res))
        .catch((err) => {
          //helpers.view.error(err, program.debug)
          reject(err);
        }),
  );
};

// CLI app version
program.version(helpers.info.getCliVersion());

// CLI Options
program
  .option('-D, --debug', 'output extra debugging')
  .option('-P, --private', 'creates private repos | Default `public`')
  .option('-O, --organization <organizationName>', 'organization name to be used as base for repos')
  .option(
    '-T, --target-dir <targetDir>',
    'target base dir for git initialization after creation. Default ./target',
  )
  .option('-S, --source-dir <sourceDir>', 'source base dir to be used for pushing to the remote')
  .option('-L, --list-file <listFile>', 'repo list file (.txt)')
  .option('-N, --no-push', 'no commit and push any content to newly created repo')
  .option(
    '-A, --auto-list',
    'creates the repo list automatically from the folders in the --auto-list-source dir. Default ./source',
  )
  .option(
    '-U, --auto-list-dir <autoListDir>',
    'directory to be used for creating automatic repo list',
  );

// catch uncaught exceptions so the api do not crash
// process.on('uncaughtException', () => {});

// CLI app commands
program
  .command('create')
  .alias('c')
  .description('Perform creating')
  .action(() => {
    const listrOptions = {
      renderer,
      collapse: false,
      aggregate: true,
      maxsubtasks: 10,
      showSubtasks: true,
    };

    const tasks = new Listr(
      [
        {
          title: 'Checking prerequisities',
          task: async (ctx, task) => {
            const ghCheck = await helpers.view.warnAboutGHVersion();

            return ghCheck;
          },
        },
        {
          title: 'Getting the repo list',
          task: async (ctx, task) => {
            ctx.repos = [];
            ctx.file = program.listFile || join(__dirname, '../list.txt');
            ctx.sourceDir = program.sourceDir || './source';
            ctx.targetDir = program.targetDir || './target';

            if (!fs.existsSync(ctx.targetDir)) {
              fs.mkdirSync(ctx.targetDir);
            }

            let createRepoList;

            if (program.autoList) {
              task.title = 'Creating the repo list automatically';

              // create the repo list from the folder list
              const dirList = await helpers.assets.getDirectories(
                program.autoListDir || ctx.sourceDir,
              );

              createRepoList = new Promise((resolve, reject) => {
                if (dirList) {
                  dirList.forEach((item) => {
                    ctx.repos.push({
                      name: program.organization ? `${program.organization}/${item}` : item,
                      type: program.private ? 'private' : 'public',
                    });
                  });
                  resolve();
                } else {
                  reject('err');
                }
              });

              return createRepoList;
            }

            createRepoList = new Promise((resolve, reject) => {
              try {
                lineReader.eachLine(ctx.file, function (line, last) {
                  const repo = line.split('|');
                  const repoType = program.private ? 'private' : repo?.[1];

                  ctx.repos.push({
                    name: repo[0],
                    type: repoType || 'public',
                  });
                  if (last) {
                    resolve(line);
                  }
                });
              } catch (err) {
                //helpers.view.error(err, program.debug);
                //reject('Error');
              }
            });

            return createRepoList;
          },
        },
        {
          title: 'Bulk creation',
          task: (ctx) => {
            console.log('repos', ctx.repos);
            const repoTasks = ctx.repos.map((repo) => ({
              title: repo?.name,
              task: (ctx) => {
                return new Listr([
                  {
                    title: 'Create and initialize',
                    task: (ctx, task) => {
                      let processStepError;

                      return githubCreate({ ...repo, target: ctx.targetDir })
                        .then(() => {
                          const split = repo?.name.split('/');
                          const repoName = split[1] ? split[1] : repo?.name;
                          // task.title = `Copy existing files from source`;

                          const targetWithRepo = `${ctx.targetDir}/${repoName}`;

                          if (!program.noPush) {
                            return helpers.assets
                              .copy(
                                join(`${ctx.sourceDir}/${repoName}`, '**', '*.*'),
                                targetWithRepo,
                              )
                              .then(() => {
                                task.title = `Stage files for the initial commits`;
                                processStepError = 'Stage process failed';
                                return execa('git', ['-C', targetWithRepo, 'add', '.']);
                              })
                              .then(() => {
                                task.title = `Commit the staged files`;
                                processStepError = 'Staged files couldnt commit';
                                return execa('git', [
                                  '-C',
                                  targetWithRepo,
                                  'commit',
                                  '-m',
                                  'Initial commit',
                                ]);
                              })
                              .then(() => {
                                task.title = `Push the changes`;
                                processStepError = 'Commited changes couldnt push';
                                return execa('git', [
                                  '-C',
                                  targetWithRepo,
                                  'push',
                                  'origin',
                                  '-f',
                                  'master',
                                ]);
                              });
                          }
                        })
                        .catch((err) => {
                          //helpers.view.error(err, program.debug);
                        });
                    },
                  },
                ]);
              },
            }));

            return new Listr(repoTasks, {
              concurrent: 10, // true is too slow when there are a lot of repos
              exitOnError: false,
            });
          },
        },
      ],
      listrOptions,
    );

    tasks
      .run({
        data: {},
      })
      .then((ctx) => {
        return ctx;
        //console.log('ctx', ctx);
      })
      .catch((err) => {
        helpers.view.error(err, program.debug);
        log.push({
          ts: new Date().toJSON(),
          level: 'error',
          error: err,
        });
      })
      .then((ctx) => {
        const errorLog = log.filter(
          (logMessage) => logMessage.level !== 'info' && logMessage.level !== 'warning',
        );
        //const displayLog = log.filter((logMessage) => logMessage.level !== 'info');
        //displayErrorLog(displayLog);

        if (errorLog.length) {
          const multiError = new Error('Errors occured');
          multiError.name = 'AC-Env-Patcher MultiError';
          multiError.errors = errorLog;
          // notify
          notifier.notify({
            title: 'Repo creation has failed!',
            message: 'During the repo creation process, an error occured!',
          });
          throw multiError;
        }

        const successMessage = 'The repo creation process has been done!';

        notifier.notify({
          title: 'Repo creation successful!',
          message: successMessage,
        });
      });
    // });
  });

program.parse(process.argv);

// if (program.debug) {
//   console.log(program.opts());
//   process.exit(1);
// }

// Assert that a VALID command is provided
if (!process.argv.slice(2).length || !/[arudl]/.test(process.argv.slice(2))) {
  program.outputHelp();
  process.exit();
}
