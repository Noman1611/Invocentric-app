import js from '@eslint/js';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'android/**',
      'electron/**',
      'tests/**',
      'scripts/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      ...js.configs.recommended.rules
    }
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
