# 📚 MyPersFinBot Documentation

Welcome to the MyPersFinBot documentation! This directory contains all project documentation.

---

## 📋 Contents

### 🔧 Development

- **[CODE_QUALITY.md](./CODE_QUALITY.md)** - Code quality tools and standards
  - Biome configuration
  - TypeScript strict mode
  - Linter rules
  - Formatter settings
  - Testing requirements

- **[JSDOC_EXAMPLES.md](./JSDOC_EXAMPLES.md)** - JSDoc documentation examples
  - Function documentation
  - Class documentation
  - Type definitions
  - Best practices

---

## 🚀 Quick Start

### For Contributors

1. Follow [JSDOC_EXAMPLES.md](./JSDOC_EXAMPLES.md) for code documentation
2. Check [CODE_QUALITY.md](./CODE_QUALITY.md) for code standards
3. Review [TESTING.md](./TESTING.md) before submitting PRs

### For Maintainers

1. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployments
2. Use [RUNBOOK.md](./RUNBOOK.md) for operational guidance
3. Check [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) before releases

---

## 📚 API Documentation

### Generate API Docs

```bash
# Install dependencies
pnpm install

# Generate documentation
pnpm run docs:generate

# Serve locally
pnpm run docs:serve
```

### View API Docs

After generation, open:

- **Local:** `http://localhost:3000`
- **File:** `docs/api/index.html`

### Clean API Docs

```bash
pnpm run docs:clean
```

---

## 📄 Documentation Structure

```text
docs/
├── README.md                    # This file
├── ARCHITECTURE.md              # System architecture
├── CODE_QUALITY.md              # Code standards
├── DATABASE_SCHEMA.md           # Database structure
├── DEBUGGING.md                 # Debugging guide
├── DEPLOYMENT.md                # Deployment guide
├── DEV.md                       # Development setup
├── ENV.md                       # Environment variables
├── JSDOC_EXAMPLES.md            # JSDoc examples
├── LOGGING.md                   # Logging configuration
├── RELEASE_CHECKLIST.md         # Release process
├── RUNBOOK.md                   # Operations runbook
├── TESTING.md                   # Testing guide
└── api/                         # Generated API docs (gitignored)
    ├── index.html
    ├── modules/
    └── classes/
```

---

## ✨ Documentation Standards

### Code Documentation

- **All exported functions** must have JSDoc comments
- **All classes** must have JSDoc comments
- **All public interfaces** must have JSDoc comments
- **Complex logic** should have inline comments

### Markdown Documentation

- Use **clear headings** (H1, H2, H3)
- Include **code examples** where appropriate
- Add **emojis** for visual clarity (🚀, ✅, ❌, etc.)
- Use **tables** for comparisons
- Include **links** to related documents

### Examples

See [JSDOC_EXAMPLES.md](./JSDOC_EXAMPLES.md) for detailed examples.

---

## 🔄 Update Process

### When to Update Docs

- **New features** → Add JSDoc, update ARCHITECTURE.md
- **Breaking changes** → Update RELEASE_CHECKLIST.md
- **Configuration changes** → Update ENV.md or DEPLOYMENT.md
- **API changes** → Regenerate API docs

### How to Update

1. Edit relevant markdown files
2. Add JSDoc comments to code
3. Regenerate API docs:

   ```bash
   pnpm run docs:generate
   ```

4. Commit changes:

   ```bash
   git add docs/
   git commit -m "docs: update documentation"
   ```

---

## 👥 Audience

### Contributors

- Follow [CODE_QUALITY.md](./CODE_QUALITY.md) for code standards
- Review [TESTING.md](./TESTING.md) for testing guidelines
- Check [JSDOC_EXAMPLES.md](./JSDOC_EXAMPLES.md) for documentation format

### Users

- Check README.md in project root
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for self-hosting

### Maintainers

- Use [RUNBOOK.md](./RUNBOOK.md) for daily operations
- Follow [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) before releases
- Ensure API docs are regenerated after major changes

---

## 🔗 External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeORM Documentation](https://typeorm.io/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [TypeDoc](https://typedoc.org/)
- [JSDoc](https://jsdoc.app/)

---

## 📝 License

All documentation is part of the MyPersFinBot project and follows the same license (ISC).

---

## ❓ Questions?

If you have questions about the documentation:

1. Check if your question is answered in existing docs
2. Open an issue on GitHub
3. Contact the maintainers

---

**Last Updated:** February 11, 2026

**Maintained by:** MyPersFinBot Team
