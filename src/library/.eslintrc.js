module.exports = {
  root: true,
  env: {
    es2020: true,
    node: true,
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      extends: ['plugin:@magicspace/default'],
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  ],
};
