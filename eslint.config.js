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
      "no-console": "off",
      "no-unused-vars": "off",
      "prefer-const": "warn",
      "no-var": "error",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    files: ["eslint.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "data/**",
      "**/*.sqlite",
      ".env",
      ".env.local",
      "logs/**",
      "**/*.log",
      "**/.DS_Store",
      ".vscode/**",
      ".idea/**",
      "!eslint.config.js",
    ],
  }
)
