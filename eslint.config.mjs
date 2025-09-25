import mtwConfig from '@mytonwallet/eslint-config';
import { globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  mtwConfig.configs.backendRecommended,
  globalIgnores([
    'dist/',
    'coverage/',
    'node_modules/',
    '__tests__/',
    '*.js',
    'jest.config.js',
    'scripts/*.js',
  ]),
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'jest.config.js',
            'scripts/*.ts',
          ],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
    },
  },
);
