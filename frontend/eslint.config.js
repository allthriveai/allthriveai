import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Enforce camelCase for interface/type properties to match API response transform
      // The axios interceptor in api.ts converts snake_case → camelCase automatically
      // Set to 'warn' to allow incremental fixing of existing violations
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'typeProperty',
          format: ['camelCase'],
          // Allow special properties that must use non-camelCase formats
          filter: {
            regex: '^(Content-Type|X-CSRFToken|__typename|__retryCount)$',
            match: false,
          },
        },
      ],
      // Allow 'any' type - disabled for now, will be gradually fixed in future refactoring
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Allow empty patterns (common in destructuring)
      'no-empty-pattern': 'off',
      // React Refresh - warn instead of error
      'react-refresh/only-export-components': 'off',
      // React hooks exhaustive deps - often suggests incorrect dependencies
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
