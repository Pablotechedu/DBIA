import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'jest.config.*'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
