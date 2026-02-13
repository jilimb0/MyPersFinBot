# 💰 Personal Finance Telegram Bot

<div align="center">

Track your finances effortlessly via Telegram

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

[Features](#-features) • [Setup](#-quick-start) • [Documentation](#-documentation)

</div>

---

## 🌟 Features

- Track expenses, income, and transfers
- Multi-currency balances with FX rates
- Debts and goals with reminders
- Analytics, reports, and CSV export
- NLP + voice input
- Recurring transactions and notifications
- Templates and custom notifications
- Bank statement import

---

## 🎬 Demo

```text
User: 50 coffee ☕
Bot: 💸 Confirm Expense
     Amount: -50.00 USD
     Category: Food
     Balance: Card (1,234.56 USD)
     [✅ Confirm] [✏️ Edit]

User: [voice] "потратил сто на такси"
Bot: 🎤 Processing voice message...
     📝 Recognized: "потратил сто на такси"
     💸 Confirm Expense
     Amount: -100.00 USD
     Category: Transport
```

---

## 🚀 Quick Start

See `docs/DEV.md`.

---

## 📖 Documentation

- 📚 [**Docs Index**](docs/README.md)
- 🏗️ [**Architecture**](docs/ARCHITECTURE.md)
- 🚀 [**Deployment**](docs/DEPLOYMENT.md)
- ✅ [**Testing**](docs/TESTING.md)
- 🧪 [**Debugging**](docs/DEBUGGING.md)
- ⚙️ [**Environment**](docs/ENV.md)
- 📦 [**Release Checklist**](docs/RELEASE_CHECKLIST.md)
- 🧭 [**Operational Runbook**](docs/RUNBOOK.md)

---

## 🏗️ Architecture

- `src/handlers` – bot flows and menus
- `src/wizards` – state machine
- `src/database` – TypeORM entities + storage
- `src/services` – scheduler, reminders, FX, voice
- `src/reports` – analytics and export

---

## 🛠️ Tech Stack

### Core

- **Node.js** 20+ - Runtime
- **TypeScript** 5.8 - Language
- **node-telegram-bot-api** - Telegram integration

### Database

- **TypeORM** - ORM
- **SQLite3** - Database (WAL mode for performance)

### APIs & Services

- **AssemblyAI** - Voice transcription
- **freecurrencyapi.com** - Exchange rates
- **FFmpeg** - Audio conversion

### Libraries

- **undici** (HTTP/2) - HTTP requests
- **dayjs** - Date manipulation
- **node-cron** - Scheduling
- **dotenv** - Environment variables

### Dev Tools

- **Biome** - Code quality & formatting
- **ts-node** - Development runtime

---

## 🎯 Usage Examples

### Text Input

```text
# Simple
50 coffee
100 taxi

# Multi-language
потратил 200 на еду
витратив 150 на каву
спent 75 on groceries

# Income
зарплата 5000
зарплата пришла 3000 USD
salary 4000
```

### Voice Input

```text
🎤 "fifty on coffee"
🎤 "потратил сто на такси" 
🎤 "витратив двісті на їжу"
```

### Keyboard

```text
💸 Expense → 50 → Food → Today → ✅
💰 Income → 1000 → Salary → ✅
💳 Balances → View / Add / Edit
📊 Analytics → Reports / CSV / Trends
```

---

## 📊 Commands

| Command | Description |
| ---------------------- |
| `/start` | Start bot / Show main menu |
| `/help` | Show help & features |
| `/stats` | Quick statistics |
| `/export` | Export data to CSV |

---

## 🔒 Security

### Best Practices

✅ **DO:**

- Keep `.env` and `secure.json` in `.gitignore`
- Use environment variables for secrets
- Regularly update dependencies
- Set up user whitelist (if needed)

❌ **DON'T:**

- Commit tokens to git
- Share bot link publicly (anyone can use it)
- Store unencrypted sensitive data

### User Access Control

Currently, **anyone with bot link can use it**. To restrict:

```typescript
// In src/index.ts
const ALLOWED_USERS = ['123456789', '987654321']

bot.on('message', (msg) => {
  if (!ALLOWED_USERS.includes(msg.from.id.toString())) {
    bot.sendMessage(msg.chat.id, '🚫 Access denied')
    return
  }
  // ... rest of logic
})
```

---

## 🚀 Deployment

See [**docs/DEPLOYMENT.md**](docs/DEPLOYMENT.md) for:

- Production setup
- PM2 process manager
- Docker containerization
- Systemd service
- Backup strategy
- Monitoring

**Quick deploy:**

```bash
# PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Or systemd
sudo cp systemd/my-pers-fin-bot.service /etc/systemd/system/
sudo systemctl enable bot
sudo systemctl start bot
```

---

## 🧪 Testing

**Status:** ✅ Unit + E2E coverage in place (Jest)

**Commands:**

- `pnpm test`
- `pnpm test:coverage`
- `pnpm test:coverage:ci`

---

## 🗺️ Roadmap

### ✅ Completed

- [x] Core transaction tracking
- [x] Multi-currency support
- [x] Voice messages
- [x] NLP parsing
- [x] Debts & Goals
- [x] Analytics & CSV export
- [x] Recurring transactions
- [x] Reminders

### 🚧 In Progress

- [ ] Coverage thresholds tuning
- [ ] Documentation cleanup

### 📋 Planned

- [ ] Multi-language UI (EN, RU, UK, ES, PL)
- [ ] Search in transaction history
- [ ] Advanced filters
- [ ] Charts & graphs
- [ ] Mobile app (optional)
- [ ] Web dashboard (optional)

---

## 🐛 Known Issues

**Critical bugs:** None! ✅

---

## 🤝 Contributing

### Development Setup

```bash
# Install
pnpm install

# Lint
pnpm run lint
pnpm run lint:fix

# Format
pnpm run format
pnpm run format:check

# Type check
pnpm run type-check

# All checks
pnpm run check
```

### Code Style

- TypeScript strict mode
- Biome
- Conventional commits
- Modular architecture

---

## 📄 License

ISC License

---

## 👨‍💻 Author

Your Name

- Telegram: [@yourusername](https://t.me/yourusername)
- GitHub: [@yourusername](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [AssemblyAI](https://www.assemblyai.com/) - Voice transcription
- [freecurrencyapi.com](https://freecurrencyapi.com/) - Exchange rates
- [FFmpeg](https://ffmpeg.org/) - Audio processing

---

## 📞 Support

**Issues?** Check documentation:

- [docs/README.md](docs/README.md) - Docs index
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment help
- [docs/DEBUGGING.md](docs/DEBUGGING.md) - Debugging

**Still stuck?** Open an issue on GitHub.

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ and ☕

</div>
