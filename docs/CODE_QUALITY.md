# 🎨 Code Quality Tools

This document describes the code quality tools and configurations used in MyPersFinBot.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Biome Configuration](#-biome-configuration)
- [TypeScript Configuration](#-typescript-configuration)
- [Testing](#-testing)
- [Pre-commit Checks](#-pre-commit-checks)
- [CI/CD Validation](#-cicd-validation)

---

## 🎯 Overview

### Tools Stack

| Tool | Version | Purpose | Rating |
| --------------------------------- |
| **Biome** | 2.3.14 | Linter + Formatter | ⭐️⭐️⭐️⭐️⭐️ 9/10 |
| **TypeScript** | 5.9.3 | Type checking | ⭐️⭐️⭐️⭐️⭐️ 10/10 |
| **Jest** | 30.2.0 | Unit testing | ⭐️⭐️⭐️⭐️⭐️ 9/10 |
| **ts-jest** | 29.4.6 | TS support for Jest | ⭐️⭐️⭐️⭐️⭐️ 9/10 |

### Why Biome?

**Traditional approach:**

```text
ESLint + Prettier + Multiple plugins = Complex, slow setup
```

**Modern approach with Biome:**

```text
Biome = Linter + Formatter in one tool = Fast, simple, powerful
```

**Benefits:**

- 🚀 **20-100x faster** than ESLint
- 🎯 Single tool (no conflicts between linter/formatter)
- 🔧 Zero configuration needed (works out of the box)
- ⚡ Written in Rust (native performance)
- 🎨 Better error messages
- 🔄 Auto-fix capabilities

---

## 🎨 Biome Configuration

### File: `biome.json`

### Formatter Settings

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "asNeeded",
      "trailingCommas": "es5",
      "arrowParentheses": "always"
    }
  }
}
```

**Result:**

```typescript
// Before
const foo = (x) => { return x * 2; };
const bar = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };

// After (formatted)
const foo = (x) => x * 2
const bar = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  h: 8,
}
```

---

### Linter Rules

#### Recommended Rules (Enabled by Default)

```json
{
  "linter": {
    "rules": {
      "recommended": true
    }
  }
}
```

Includes:

- No unused variables
- No unreachable code
- No duplicate imports
- No constant conditions
- And 50+ more rules

---

#### Correctness Rules

**Strict variable/import checking:**

```json
"correctness": {
  "noUnusedVariables": "error",
  "noUnusedImports": "error",
  "useExhaustiveDependencies": "warn",
  "useHookAtTopLevel": "error"
}
```

**Examples:**

```typescript
// ❌ Error: Unused variable
import { foo } from "./utils"  // foo is imported but never used
const bar = 123  // bar is declared but never used

// ✅ Fixed
import { foo } from "./utils"
console.log(foo)
```

---

#### Suspicious Rules

**Prevent common bugs:**

```json
"suspicious": {
  "noExplicitAny": "warn",
  "noConsole": "off",
  "noDoubleEquals": "error",
  "useAwait": "error"
}
```

**Examples:**

```typescript
// ❌ Error: Using == instead of ===
if (value == null) { }

// ✅ Fixed
if (value === null) { }

// ❌ Error: async function without await
async function fetchData() {
  return data  // No await!
}

// ✅ Fixed
function fetchData() {  // Remove async
  return data
}
// OR
async function fetchData() {
  return await getData()  // Add await
}

// ⚠️ Warning: Explicit any
function process( any) { }  // Avoid any

// ✅ Better
function process( unknown) { }  // Use unknown
```

---

#### Style Rules

**Enforce consistent style:**

```json
"style": {
  "useConst": "error",
  "useTemplate": "warn",
  "noUnusedTemplateLiteral": "warn"
}
```

**Examples:**

```typescript
// ❌ Error: Use const instead of let
let name = "John"  // Never reassigned

// ✅ Fixed
const name = "John"

// ⚠️ Warning: Use template literal
const message = "Hello " + name + "!"

// ✅ Better
const message = `Hello ${name}!`
```

---

#### Performance Rules

**Optimize code performance:**

```json
"performance": {
  "noAccumulatingSpread": "warn",
  "noDelete": "warn"
}
```

**Examples:**

```typescript
// ⚠️ Warning: Accumulating spread (O(n²) complexity)
let result = []
for (const item of items) {
  result = [...result, item]  // Creates new array every iteration
}

// ✅ Better (O(n) complexity)
const result = []
for (const item of items) {
  result.push(item)  // Mutates existing array
}

// ⚠️ Warning: Using delete
delete obj.property  // Slow and breaks V8 optimizations

// ✅ Better
obj.property = undefined  // Fast
// OR
const { property, ...rest } = obj  // Create new object without property
```

---

### Overrides

#### Test Files

**Relax rules for test code:**

```json
{
  "includes": ["**/__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off",
        "useAwait": "off"
      },
      "correctness": {
        "noUnusedVariables": "off"
      }
    }
  }
}
```

**Why?**

- Tests often need `any` for mocking
- Test utilities may not be used in all tests
- Test helpers can be async without await

**Example:**

```typescript
// ✅ Allowed in tests
const mockData: any = { foo: "bar" }  // OK for mocking

const unusedHelper = () => {}  // OK if not used in this test

async function testHelper() {  // OK without await
  return mockData
}
```

---

#### Config Files

**Allow CommonJS in config files:**

```json
{
  "includes": ["**/*.config.js", "**/*.config.ts", "ecosystem.config.js"],
  "linter": {
    "rules": {
      "style": {
        "useNodejsImportProtocol": "off"
      }
    }
  }
}
```

---

#### Wizards (Complex State Management)

**Allow flexibility for wizard patterns:**

```json
{
  "includes": ["src/wizards/**"],
  "linter": {
    "rules": {
      "suspicious": { "noExplicitAny": "off" },
      "performance": { "noDelete": "off" }
    }
  }
}
```

**Why?**

- Wizard state can be dynamic (any)
- State cleanup often uses `delete`

---

#### Service Files

**Pragmatic rules for service layer:**

```json
{
  "includes": [
    "src/services/**",
    "src/handlers/**",
    "src/database/**",
    "src/export/**"
  ],
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off",
        "useAwait": "off"
      }
    }
  }
}
```

**Why?**

- External APIs may return `any`
- Some async wrappers don't need await
- TypeORM types can be complex

---

## 📝 Usage

### Commands

```bash
# Check code quality (lint + format check + type check)
pnpm run check

# Auto-fix issues
pnpm run fix

# Format code
pnpm run format

# Format check only
pnpm run format:check

# Lint only
pnpm run lint

# Type check only
pnpm run type-check
```

---

### VSCode Integration

**Install extension:**

- [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)

**Settings (`.vscode/settings.json`):**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

**Result:**

- ✅ Auto-format on save
- ✅ Auto-fix lint issues
- ✅ Auto-organize imports

---

## 🔍 TypeScript Configuration

### File: `tsconfig.json`

**Strict mode enabled:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Benefits:**

- 🛡️ Catch bugs at compile time
- 🎯 Better IDE autocomplete
- 📚 Self-documenting code
- 🔒 Type safety

---

## 🧪 Testing

### Jest Configuration

**File:** `jest.config.js`

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
}
```

**Coverage Requirements:**

- ✅ Functions: 70%
- ✅ Lines: 70%
- ⚠️ Branches: 60% (target: 70%)

---

## 🔄 Pre-commit Checks

### Recommended: Use Husky + lint-staged

### Setup (Optional)

```bash
pnpm add -D husky lint-staged
```

**`.husky/pre-commit`:**

```bash
#!/bin/sh
pnpm run check
pnpm test
```

**`package.json`:**

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "biome check --write",
      "biome format --write"
    ]
  }
}
```

---

## 🚀 CI/CD Validation

### GitHub Actions (`.github/workflows/ci.yml`)

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm run check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test
```

**Result:** All PRs must pass:

1. ✅ Linting
2. ✅ Formatting
3. ✅ Type checking
4. ✅ Tests

---

## 📊 Metrics

### Current Code Quality

| Metric | Score | Status |
| ----------------------- |
| **Test Coverage** | 70% | ✅ Meets target |
| **Type Safety** | Strict | ✅ Excellent |
| **Lint Errors** | 0 | ✅ Perfect |
| **Format Issues** | 0 | ✅ Perfect |
| **Build Errors** | 0 | ✅ Perfect |

### Performance

| Tool | Speed | vs ESLint+Prettier |
| --------------------------------- |
| **Biome check** | ~200ms | 🚀 20-100x faster |
| **Biome format** | ~100ms | 🚀 30x faster |
| **TypeScript** | ~3s | ⚡ Normal |

---

## 🎯 Best Practices

### Do's ✅

- Run `pnpm run check` before committing
- Fix all lint errors (don't suppress)
- Use `unknown` instead of `any` when possible
- Write tests for new features
- Keep functions small (<50 lines)
- Use TypeScript strict mode
- Document complex logic

### Don'ts ❌

- Don't use `// @ts-ignore` (use `// @ts-expect-error` with comment)
- Don't use `any` without reason
- Don't disable lint rules globally
- Don't commit with lint errors
- Don't skip tests
- Don't use `==` (use `===`)
- Don't use `delete` (use alternatives)

---

## 🔧 Troubleshooting

### "Biome command not found"

```bash
pnpm install
```

### "Lint errors not showing in VSCode"

1. Install Biome extension
2. Reload VSCode
3. Check `.vscode/settings.json`

### "Format on save not working"

**Add to `.vscode/settings.json`:**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome"
}
```

### "Type errors but build succeeds"

Run type check explicitly:

```bash
pnpm run type-check
```

---

## 📚 Resources

- [Biome Documentation](https://biomejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 🎉 Summary

### Tool Rating: ⭐️⭐️⭐️⭐️⭐️ 9/10

**Why 9/10?**

**Pros:**

- 🚀 Blazing fast (20-100x faster than ESLint)
- 🎯 Single tool for lint + format
- 🔧 Zero config (works out of box)
- 🎨 Great error messages
- ⚡ Auto-fix capabilities
- 🔄 VSCode integration

**Cons (minor):**

- Still evolving (v2.3, not v3 yet)
- Some ESLint plugins not yet available
- Learning curve for migration

**Verdict:** Excellent choice for modern TypeScript projects! 🎉

---

**Last Updated:** February 11, 2026  
**Maintained by:** MyPersFinBot Team
