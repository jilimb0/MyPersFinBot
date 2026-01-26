const js = require("@eslint/js")
const tseslint = require("typescript-eslint")

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended, // Используем обычный recommended вместо recommendedTypeChecked
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
      "@typescript-eslint/no-explicit-any": "off",
      "no-case-declarations": "off",
      "no-useless-escape": "warn",
    },
  },

  // CommonJS files (Node.js scripts and configs)
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
  // Global ignores
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "data/**",
      "**/*.sqlite",
      ".env",
      ".env.local",
      "logs/**",
      "**/*.log",
      "**/.DS_Store",
      ".vscode/**",
      ".idea/**",
    ],
  }
)
