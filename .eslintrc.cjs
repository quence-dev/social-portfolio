module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ['airbnb', 'airbnb/hooks'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: true,
    },
    react: { version: 'detect' },
  },
  rules: {
    'import/extensions': ['error', 'ignorePackages', { ts: 'never', tsx: 'never' }],
    // The backdrop itself is not a keyboard control; Escape and the close button are.
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
  },
  overrides: [
    {
      files: ['scripts/**/*.mjs'],
      env: { node: true },
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        'no-await-in-loop': 'off',
        'no-console': 'off',
        'no-continue': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
