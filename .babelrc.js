const plugins = [
  '@babel/plugin-proposal-object-rest-spread',
  'add-module-exports',
  '@babel/plugin-proposal-nullish-coalescing-operator',
  '@babel/plugin-proposal-optional-chaining',
];

const ignore = [
  /node_modules/,
  'src/**/temp*.js',
  'src/**/test*.js',
  'src/**/*.test.js',
  '**/env*.js',
  'src/**/*-copy.js',
];

const config = {
  env: {
    development: {
      presets: [
        [
          '@babel/env',
          {
            targets: {
              node: '10.0',
            },
            shippedProposals: true,
          },
        ],
      ],
      ignore,
      plugins,
    },
    production: {
      presets: [
        '@babel/env',
        [
          'minify',
          {
            removeDebugger: true,
            removeConsole: true,
          },
        ],
      ],

      comments: false,
      ignore,
      plugins,
    },
  },
};

module.exports = config;
