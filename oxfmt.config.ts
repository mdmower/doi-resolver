import {defineConfig} from 'oxfmt';

export default defineConfig({
  bracketSpacing: false,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100,
  sortPackageJson: false,
  ignorePatterns: [
    'csl-styles/**',
    'dist/**',
    'package-lock.json',
    'pkg/**',
    'resources/**',
    'src/csl/**',
    'src/qrcodegen/**',
    'static/icons/**',
    'static/img/**',
  ],
});
