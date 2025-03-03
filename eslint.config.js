// @ts-check

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import playwright from 'eslint-plugin-playwright';
import prettierConfigRecommended from 'eslint-plugin-prettier/recommended';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default tseslint.config(
  {
    ignores: ['dist/', 'pkg/', 'src/csl/', 'src/qrcodegen/'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.[jt]s'],
    languageOptions: {ecmaVersion: 2022},
    rules: {
      'no-undef': 'error',
      'no-var': 'error',
    },
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    ...jsdoc.configs['flat/recommended-typescript'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          checkConstructors: false,
          contexts: ['MethodDefinition', 'FunctionDeclaration'],
        },
      ],
      'jsdoc/check-syntax': 'error',
      'jsdoc/newline-after-description': 'off',
      'jsdoc/check-types': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-param-type': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    ...noUnsanitized.configs.recommended,
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-unsanitized/method': [
        'error',
        {
          escape: {methods: ['DOMPurify.sanitize']},
        },
      ],
      'no-unsanitized/property': [
        'error',
        {
          escape: {methods: ['DOMPurify.sanitize']},
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: {chrome: 'readonly'},
    },
  },
  {
    files: ['src/*.ts'],
    ignores: ['src/sw.ts'],
    languageOptions: {
      globals: {...globals.browser},
    },
  },
  {
    files: ['src/sw.ts', 'src/lib/*.ts'],
    languageOptions: {
      globals: {...globals.serviceworker},
    },
  },
  {
    files: ['build/**/*.ts'],
    languageOptions: {
      globals: {...globals.node},
    },
  },
  {
    files: ['playwright.config.ts', 'tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
  },
  {
    files: ['playwright.config.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {projectService: true},
    },
  },
  prettierConfigRecommended
);
