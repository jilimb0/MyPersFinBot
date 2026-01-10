const js = require("@eslint/js")
const tseslint = require("typescript-eslint")
const prettier = require("eslint-config-prettier")

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended, // Используем обычный recommended вместо recommendedTypeChecked
  prettier,
  {
    files: ["**/*.ts"],
    rules: {
      // Общие правила
      "no-console": "off",
      "no-unused-vars": "off",
      "prefer-const": "warn",
      "no-var": "error",

      // TypeScript правила - СМЯГЧЁННЫЕ ДЛЯ СУЩЕСТВУЮЩЕГО КОДА
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      // "@typescript-eslint/no-explicit-any": "off", // Выключено для существующего кода
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  // Специальные правила для конфиг файла
  {
    files: ["eslint.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off", // module и require глобальные в Node.js
    },
  },
  {
    ignores: [
      // Build output
      "dist/**",
      "build/**",

      // Dependencies
      "node_modules/**",

      // Database
      "data/**",
      "**/*.sqlite",

      // Environment
      ".env",
      ".env.local",

      // Logs
      "logs/**",
      "**/*.log",

      // OS
      "**/.DS_Store",

      // IDE
      ".vscode/**",
      ".idea/**",

      // Allow eslint.config.js
      "!eslint.config.js",
    ],
  }
)
