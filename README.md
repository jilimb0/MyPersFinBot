# 💰 Personal Finance Telegram Bot

<div align="center">

**Track your finances effortlessly via Telegram**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

[Features](#-features) • [Setup](#-quick-start) • [Documentation](#-documentation) • [Deployment](#-deployment)

</div>

---

## 🌟 Features

### 💸 **Transaction Management**
- ✅ Track expenses and income
- ✅ Multi-currency support (USD, EUR, GEL, UAH, etc.)
- ✅ Transfers between accounts
- ✅ Automatic category detection
- ✅ Date selection (today, yesterday, custom)
- ✅ Transaction history with filters

### 💳 **Account Balances**
- ✅ Multiple accounts (Cash, Card, Savings)
- ✅ Multi-currency balances
- ✅ Real-time balance updates
- ✅ Net worth calculation
- ✅ Edit/delete accounts

### 📉 **Debt Tracking**
- ✅ "I Owe" and "They Owe Me"
- ✅ Partial payments
- ✅ Payment reminders
- ✅ Mark as paid

### 🎯 **Savings Goals**
- ✅ Create savings targets
- ✅ Track progress with visual bars
- ✅ Add/withdraw funds
- ✅ Completed goals archive

### 📊 **Analytics & Reports**
- ✅ Monthly statistics
- ✅ Category breakdown
- ✅ Income vs Expense trends
- ✅ Export to CSV
- ✅ Top spending categories

### 🚀 **Advanced Features**
- ✅ **Voice Messages** 🎤 - Say "fifty on coffee" and bot creates transaction
- ✅ **Natural Language Processing** 🤖 - Type "100 taxi" or "потратил 200 на еду"
- ✅ **Multi-language Input** 🌍 - English, Russian, Ukrainian
- ✅ **Real-time FX Rates** 💱 - Auto-updated exchange rates
- ✅ **Recurring Transactions** 🔁 - Auto-create daily/weekly/monthly
- ✅ **Reminders** 🔔 - Get notified about upcoming payments
- ✅ **Bank Statement Import** 📥 - Upload CSV files
- ✅ **Auto-deposit to Goals** 💰 - Automatically save from income

---

## 🎬 Demo

```
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

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** ([Install](https://pnpm.io/installation))
- **FFmpeg** (for voice messages)
- **Telegram Bot Token** ([Get from @BotFather](https://t.me/botfather))

### Installation

```bash
# 1. Clone repository
git clone https://github.com/yourusername/MyPersFinBot.git
cd MyPersFinBot

# 2. Install dependencies
pnpm install

# 3. Install FFmpeg
# macOS:
brew install ffmpeg

# Linux:
sudo apt-get install ffmpeg

# 4. Create configuration
cp .env.example .env

# 5. Add your tokens
nano .env
```

### Configuration

Create `.env` file:

```env
# Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# AssemblyAI API Key (for voice transcription - optional)
# Get free key at https://www.assemblyai.com/
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# FX Rates API Key (optional - for exchange rates)
# Get free key at https://freecurrencyapi.com/
FX_API_KEY=your_fx_api_key_here
```

**Legacy:** Create `secure.json` (alternative to .env):

```json
{
  "API": "your_telegram_bot_token_here"
}
```

### Run

```bash
# Development
pnpm run dev

# Production
pnpm run build
pnpm start
```

---

## 📖 Documentation

### Core Documentation
- 📊 [**PROJECT_AUDIT.md**](PROJECT_AUDIT.md) - Complete project analysis
- 🚀 [**DEPLOYMENT.md**](DEPLOYMENT.md) - Production deployment guide
- 📝 [**NEXT_STEPS.md**](NEXT_STEPS.md) - Development roadmap

### Feature Guides
- 🎤 [**VOICE_QUICK_START.md**](VOICE_QUICK_START.md) - Voice message setup (5 min)
- 🎵 [**FFMPEG_SETUP.md**](FFMPEG_SETUP.md) - FFmpeg installation
- 📡 [**ASSEMBLYAI_SETUP.md**](ASSEMBLYAI_SETUP.md) - AssemblyAI configuration
- 🤖 [**NLP_INTEGRATION.md**](NLP_INTEGRATION.md) - Natural language processing

### Fixes & Troubleshooting
- ✅ [**FINAL_FIX.md**](FINAL_FIX.md) - Latest fixes (voice upload)
- 🔍 [**DEBUG_VOICE.md**](DEBUG_VOICE.md) - Voice debugging guide
- 📋 [**FIXES_SUMMARY.md**](FIXES_SUMMARY.md) - All applied fixes

### Future Plans
- 🌍 [**INTERNATIONALIZATION_PLAN.md**](INTERNATIONALIZATION_PLAN.md) - Multi-language UI (EN/RU/UK)

---

## 🏗️ Architecture

```
src/
├── commands.ts              # Bot commands (/start, /help)
├── constants.ts             # UI keyboards and constants
├── database/               
│   ├── entities/           # TypeORM entities
│   ├── data-source.ts      # Database connection
│   └── storage-db.ts       # Database operations
├── fx.ts                   # Exchange rates (FX API)
├── handlers/               # Feature handlers
│   ├── balance-handlers.ts
│   ├── debt-handlers.ts
│   ├── goal-handlers.ts
│   ├── transaction-handlers.ts
│   ├── voice-handler.ts
│   ├── recurring-handlers.ts
│   └── ... (10 more)
├── index.ts                # Main bot logic
├── menus.ts                # Menu builders
├── parsers/                # NLP text parsers
├── reports/                # Analytics & CSV export
├── services/              
│   ├── assemblyai-service.ts
│   ├── scheduler.ts
│   └── reminder-manager.ts
├── types/                  # TypeScript types
├── utils.ts                # Helper functions
├── validators.ts           # Input validation
└── wizards/                # Wizard state management
```

---

## 🛠️ Tech Stack

### Core
- **Node.js** 20+ - Runtime
- **TypeScript** 5.7 - Language
- **node-telegram-bot-api** - Telegram integration

### Database
- **TypeORM** - ORM
- **SQLite3** - Database (WAL mode for performance)

### APIs & Services
- **AssemblyAI** - Voice transcription
- **freecurrencyapi.com** - Exchange rates
- **FFmpeg** - Audio conversion

### Libraries
- **axios** / **undici** (HTTP/2) - HTTP requests
- **dayjs** - Date manipulation
- **node-cron** - Scheduling
- **dotenv** - Environment variables

### Dev Tools
- **ESLint** + **Prettier** - Code quality
- **ts-node** - Development runtime

---

## 🎯 Usage Examples

### Text Input

```
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

```
🎤 "fifty on coffee"
🎤 "потратил сто на такси" 
🎤 "витратив двісті на їжу"
```

### Keyboard

```
💸 Expense → 50 → Food → Today → ✅
💰 Income → 1000 → Salary → ✅
💳 Balances → View / Add / Edit
📊 Analytics → Reports / CSV / Trends
```

---

## 📊 Commands

| Command | Description |
|---------|-------------|
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

See [**DEPLOYMENT.md**](DEPLOYMENT.md) for:
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
sudo cp bot.service /etc/systemd/system/
sudo systemctl enable bot
sudo systemctl start bot
```

---

## 🧪 Testing

**Status:** ⚠️ No tests yet (planned)

**Planned:**
- Unit tests (Jest)
- Integration tests
- E2E tests

See [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for testing roadmap.

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
- [ ] Internationalization (i18n) - **HIGH PRIORITY**
- [ ] Testing setup
- [ ] Documentation improvements

### 📋 Planned
- [ ] Multi-language UI (EN, RU, UK)
- [ ] Search in transaction history
- [ ] Advanced filters
- [ ] Charts & graphs
- [ ] Mobile app (optional)
- [ ] Web dashboard (optional)

See [NEXT_STEPS.md](NEXT_STEPS.md) for detailed roadmap.

---

## 🐛 Known Issues

See [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for:
- 10 minor bugs (edge cases)
- Performance optimization opportunities
- Security hardening TODOs

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
- ESLint + Prettier
- Conventional commits
- Modular architecture

---

## 📄 License

ISC License

---

## 👨‍💻 Author

**Your Name**
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
- [PROJECT_AUDIT.md](PROJECT_AUDIT.md) - Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment help
- [VOICE_QUICK_START.md](VOICE_QUICK_START.md) - Voice setup
- [DEBUG_VOICE.md](DEBUG_VOICE.md) - Voice troubleshooting

**Still stuck?** Open an issue on GitHub.

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ and ☕

</div>
