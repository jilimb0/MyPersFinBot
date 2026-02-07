# 🏗 Architecture Overview

**Personal Finance Telegram Bot - System Architecture**

---

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TELEGRAM BOT API                        │
│                    (node-telegram-bot-api)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      MAIN BOT                               │
│                   (src/index.ts)                            │
│  • Event Routing                                            │
│  • Command Registration                                     │
│  • Error Handling                                           │
└──────┬───────────────┬────────────────┬─────────────────────┘
       │               │                │
       ▼               ▼                ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│  WIZARDS    │ │  HANDLERS   │ │   SERVICES      │
│             │ │             │ │                 │
│ • State Mgmt│ │ • Voice     │ │ • Scheduler     │
│ • Flows     │ │ • Balance   │ │ • AssemblyAI    │
│ • Validation│ │ • Debt      │ │ • NLP Parser    │
│             │ │ • Goal      │ │ • Reminders     │
│             │ │ • Recurring │ │ • Auto-managers │
└──────┬──────┘ └──────┬──────┘ └────────┬────────┘
       │               │                 │
       └───────────────┼─────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                           │
│                  (src/database/)                            │
│  • TypeORM                                                  │
│  • SQLite (WAL mode)                                        │
│  • 10 Entities                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                          │
│  • AssemblyAI (voice transcription)                         │
│  • freecurrencyapi.com (FX rates)                           │
│  • FFmpeg (audio conversion)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Components

### 1. **Main Entry Point** (`src/index.ts`)

**Responsibilities:**
- Initialize database connection
- Register bot commands
- Route incoming messages to appropriate handlers
- Manage wizard states
- Start scheduler for recurring tasks
- Handle graceful shutdown

**Flow:**
```typescript
Telegram Message → Message Router → Wizard Check → Handler → Database → Response
```

**Key Patterns:**
- Event-driven architecture
- State machine for wizards
- Middleware-like message processing

---

### 2. **Wizards** (`src/wizards/`)

**Purpose:** Multi-step conversation flows

**Architecture:**
```
WizardManager
├── State Storage (in-memory Map)
├── Step Handlers
└── Validation
```

**Wizard Flow Example:**
```
User: "💸 Expense"
  ↓
Wizard State: TX_AMOUNT
  ↓
User: "50"
  ↓
Wizard State: TX_CATEGORY
  ↓
User: "Food"
  ↓
Wizard State: TX_DATE
  ↓
User: "Today"
  ↓
Wizard State: TX_CONFIRM
  ↓
User: "✅ Confirm"
  ↓
Save to Database → Clear Wizard State
```

**Key Features:**
- Step-by-step data collection
- Validation at each step
- Back/Cancel support
- Context preservation
- Multiple concurrent wizards per user

**Supported Wizards:**
- Transaction creation (Expense/Income/Transfer)
- Balance creation
- Debt management
- Goal creation
- Recurring transaction setup

---

### 3. **Handlers** (`src/handlers/`)

**Purpose:** Business logic for specific features

**Structure:**
```
handlers/
├── balance-handlers.ts          # Balance CRUD
├── debt-handlers.ts             # Debt management
├── goal-handlers.ts             # Goals tracking
├── transaction-handlers.ts      # Transaction operations
├── voice-handler.ts             # Voice message processing
├── recurring-handlers.ts        # Recurring transactions
├── reminder-settings-handlers.ts # Reminder configuration
├── auto-deposit-handlers.ts     # Auto-deposit to goals
├── auto-debt-payment-handlers.ts # Auto-payment for debts
├── auto-income-handlers.ts      # Auto-income creation
├── upload-statement-handlers.ts # CSV import
├── notification-template-handlers.ts # Custom messages
├── template-handlers.ts         # Transaction templates
├── quick-actions-handlers.ts    # Quick shortcuts
└── date-handlers.ts             # Date selection
```

**Pattern:**
```typescript
export async function handleFeature(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  data?: any
) {
  // 1. Validate input
  // 2. Fetch from database
  // 3. Process business logic
  // 4. Update database
  // 5. Send response to user
}
```

---

### 4. **Services** (`src/services/`)

**Purpose:** Reusable business logic & external integrations

#### **Scheduler** (`scheduler.ts`)
- Based on `node-cron`
- Runs every minute
- Executes:
  - Recurring transactions
  - Reminders
  - Auto-deposits to goals
  - Auto-payments for debts
  - Auto-income creation

**Cron Jobs:**
```typescript
'* * * * *'  // Every minute
  ↓
Check: Recurring Transactions due?
  ↓
Check: Reminders to send?
  ↓
Check: Auto-deposits scheduled?
  ↓
Check: Auto-payments due?
  ↓
Check: Auto-income expected?
```

#### **AssemblyAI Service** (`assemblyai-service.ts`)
- Voice transcription
- Audio upload (binary)
- Polling for results
- Multi-language support

**Flow:**
```
Telegram Voice → Download OGA → FFmpeg Convert to WAV → Upload to AssemblyAI → Poll Status → Transcription Text
```

#### **NLP Parser** (`nlp-parser.ts`)
- Natural language processing
- Multi-language support (EN, RU, UK)
- Pattern matching for transactions

**Examples:**
```
"50 coffee"        → Amount: 50, Category: Food
"потратил 100"    → Type: Expense, Amount: 100
"зарплата 5000"   → Type: Income, Amount: 5000, Category: Salary
```

#### **Auto-Managers**
- `auto-deposit-manager.ts` - Auto-save to goals
- `auto-debt-payment.ts` - Auto-pay debts
- `auto-income-manager.ts` - Auto-create income
- `recurring-manager.ts` - Execute recurring transactions
- `reminder-manager.ts` - Send reminders

---

### 5. **Database Layer** (`src/database/`)

**ORM:** TypeORM  
**Database:** SQLite (WAL mode for concurrency)

**Structure:**
```
database/
├── data-source.ts    # TypeORM connection config
├── storage-db.ts     # Database operations (repository pattern)
└── entities/         # TypeORM entities (10 tables)
    ├── User.ts
    ├── Balance.ts
    ├── Transaction.ts
    ├── Debt.ts
    ├── Goal.ts
    ├── RecurringTransaction.ts
    ├── Reminder.ts
    ├── IncomeSource.ts
    ├── CategoryPreference.ts
    └── Budget.ts
```

**Pattern:** Repository + Service Layer

```typescript
// storage-db.ts - abstraction layer
export const dbStorage = {
  // Users
  getUserData(userId: string): Promise<UserData>
  setDefaultCurrency(userId: string, currency: Currency): Promise<void>
  
  // Balances
  getBalancesList(userId: string): Promise<Balance[]>
  createBalance(userId: string,  BalanceData): Promise<Balance>
  updateBalance(userId: string, accountId: string, amount: number): Promise<void>
  
  // Transactions
  createTransaction(userId: string,  TransactionData): Promise<Transaction>
  getTransactions(userId: string, filters?: Filters): Promise<Transaction[]>
  
  // ... more methods
}
```

**See:** [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for detailed schema.

---

### 6. **Parsers** (`src/parsers/`)

**Purpose:** Parse user input into structured data

**Types:**
- **NLP Parser:** Natural language → Transaction data
- **Amount Parser:** Text → Number + Currency
- **Date Parser:** Text → Date object
- **CSV Parser:** Bank statement → Transactions

**Example:**
```typescript
parseNLPInput("потратил 50 на кофе")
  ↓
{
  type: "EXPENSE",
  amount: 50,
  category: "Food",
  description: "кофе"
}
```

---

### 7. **Reports** (`src/reports/`)

**Purpose:** Analytics & data export

**Features:**
- Monthly statistics
- Category breakdown
- CSV export
- Trends analysis
- Progress bars for goals

**Example:**
```typescript
generateMonthlyReport(userId)
  ↓
{
  income: 5000,
  expenses: 3500,
  balance: +1500,
  categories: {
    Food: 800,
    Transport: 500,
    ...
  }
}
```

---

### 8. **Utilities** (`src/utils.ts`)

**Common helpers:**
- `formatMoney()` - Format currency
- `safeAnswerCallback()` - Safe callback responses
- `parseAmount()` - Parse user input amounts
- Date utilities

---

### 9. **Validators** (`src/validators.ts`)

**Input validation:**
- Amount validation
- Currency validation
- Date validation
- Account ID validation

---

### 10. **FX Rates** (`src/fx.ts`)

**Purpose:** Exchange rate management

**Features:**
- Real-time rates from freecurrencyapi.com
- HTTP/2 (undici) for performance
- Auto-refresh every 24 hours
- In-memory cache
- Fallback to default rates

**Flow:**
```
Bot Start → Preload Rates → Cache in Memory → Auto-refresh (24h) → Use in Transactions
```

---

## 🔄 Data Flow

### Example: Creating an Expense

```
1. USER
   "💸 Expense" button
   ↓

2. INDEX.TS (Main Router)
   Detects button press
   ↓

3. WIZARD MANAGER
   Creates wizard state: TX_AMOUNT
   ↓

4. USER INPUT
   "50"
   ↓

5. WIZARD (TX_AMOUNT step)
   Validates amount
   Moves to: TX_CATEGORY
   ↓

6. USER INPUT
   "Food"
   ↓

7. WIZARD (TX_CATEGORY step)
   Saves category
   Moves to: TX_DATE
   ↓

8. USER INPUT
   "Today"
   ↓

9. WIZARD (TX_DATE step)
   Saves date
   Moves to: TX_CONFIRM
   Shows preview
   ↓

10. USER INPUT
    "✅ Confirm"
    ↓

11. TRANSACTION HANDLER
    createTransaction()
    ↓

12. DATABASE (storage-db.ts)
    Save transaction to DB
    Update balance
    ↓

13. RESPONSE
    Send confirmation to user
    Clear wizard state
```

---

### Example: Voice Message Processing

```
1. USER
   Sends voice message 🎤
   ↓

2. VOICE HANDLER
   Download voice file (OGA)
   ↓

3. FFMPEG
   Convert OGA → WAV
   ↓

4. ASSEMBLYAI SERVICE
   Upload WAV (binary)
   ↓

5. ASSEMBLYAI API
   Transcribe audio
   ↓

6. ASSEMBLYAI SERVICE
   Poll for result
   Return: "fifty on coffee"
   ↓

7. NLP PARSER
   Parse: "fifty on coffee"
   Extract: {amount: 50, category: "Food"}
   ↓

8. TRANSACTION HANDLER
   Create transaction from NLP data
   ↓

9. DATABASE
   Save transaction
   Update balance
   ↓

10. RESPONSE
    Send confirmation
```

---

### Example: Recurring Transaction Execution

```
1. SCHEDULER (every minute)
   Check: recurring transactions due?
   ↓

2. RECURRING MANAGER
   Query: nextExecutionDate <= NOW
   ↓

3. DATABASE
   Returns: [RecurringTransaction1, RecurringTransaction2, ...]
   ↓

4. FOR EACH RecurringTransaction:
   ↓
   
5. TRANSACTION HANDLER
   createTransaction()
   ↓

6. DATABASE
   Save transaction
   Update balance
   Update: nextExecutionDate
   ↓

7. NOTIFICATION
   Send message to user:
   "✅ Recurring expense created: Rent -1000 USD"
```

---

## 🧠 Design Patterns

### 1. **State Machine (Wizards)**

Wizards implement finite state machines:

```typescript
WizardState {
  step: 'TX_AMOUNT' | 'TX_CATEGORY' | 'TX_DATE' | 'TX_CONFIRM'
   { amount?, category?, date?, ... }
  returnTo: 'main' | 'balances' | ...
}
```

### 2. **Repository Pattern (Database)**

`storage-db.ts` acts as repository layer:

```typescript
// Abstract database operations
dbStorage.createTransaction() // Don't care about TypeORM internals
```

### 3. **Service Layer**

Services encapsulate business logic:

```typescript
AssemblyAIService.transcribe()
NLPParser.parse()
Scheduler.start()
```

### 4. **Event-Driven Architecture**

Main bot listens to Telegram events:

```typescript
bot.on('message', handler)
bot.on('callback_query', handler)
```

### 5. **Dependency Injection (Partial)**

Handlers receive dependencies:

```typescript
handleBalance(bot, chatId, userId) // bot injected
```

---

## 📦 Module Dependencies

```
index.ts
├── wizards/
├── handlers/
│   ├── services/ (NLP, AssemblyAI)
│   └── database/
├── services/
│   ├── database/
│   └── handlers/ (cross-dependency)
├── database/
│   └── entities/
├── parsers/
├── reports/
│   └── database/
├── utils/
├── validators/
└── fx/
```

**Note:** Some circular dependencies exist (handlers ↔ services)

---

## 🔒 Security Considerations

### Current:
- ✅ Secrets in `.env` (gitignored)
- ✅ Input validation
- ✅ SQL injection protection (TypeORM)
- ✅ File permissions documented

### Missing:
- ❌ User authentication (anyone with bot link can use)
- ❌ Rate limiting
- ❌ Data encryption at rest
- ❌ Audit logs

**See:** [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for security TODOs

---

## ⚡ Performance

### Optimizations:
- ✅ SQLite WAL mode (better concurrency)
- ✅ In-memory wizard state (fast)
- ✅ FX rates cached (no API call per transaction)
- ✅ HTTP/2 for FX API (faster)

### Potential Bottlenecks:
- ⚠️ No database indexes (except default)
- ⚠️ Loading all transactions for analytics
- ⚠️ Single SQLite file (fine for single user)

**See:** [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for performance TODOs

---

## 🧪 Testing Strategy (Planned)

**Unit Tests:**
- Parsers (NLP, amount, date)
- Validators
- Utilities
- FX rate calculations

**Integration Tests:**
- Database operations
- Services (with mocks)

**E2E Tests:**
- Wizard flows
- Handler scenarios

**Status:** ❌ Not implemented yet

---

## 🚀 Deployment Architecture

### Production Setup:

```
┌─────────────────────────────────────┐
│         LINUX SERVER                │
│   (Ubuntu 22.04 / Debian 11)        │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   PM2 Process Manager         │  │
│  │   (or Docker / systemd)       │  │
│  │                               │  │
│  │  ┌────────────────────────┐  │  │
│  │  │  Node.js 20+           │  │  │
│  │  │  finance-bot           │  │  │
│  │  │  (dist/index.js)       │  │  │
│  │  └────────────────────────┘  │  │
│  │                               │  │
│  │  ┌────────────────────────┐  │  │
│  │  │  SQLite Database       │  │  │
│  │  │  data/database.db      │  │  │
│  │  └────────────────────────┘  │  │
│  │                               │  │
│  │  ┌────────────────────────┐  │  │
│  │  │  FFmpeg                │  │  │
│  │  │  (system binary)       │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
│                                     │
│  External APIs:                     │
│  • Telegram Bot API                 │
│  • AssemblyAI                       │
│  • freecurrencyapi.com              │
└─────────────────────────────────────┘
```

**See:** [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guide

---

## 📈 Scalability

### Current:
- **Single user:** Perfect ✅
- **Multiple users:** Works ✅
- **High traffic:** Not optimized ⚠️

### To Scale:
1. Add database indexes
2. Switch to PostgreSQL
3. Add Redis for wizard state
4. Add rate limiting
5. Implement pagination
6. Add monitoring (Prometheus/Grafana)

---

## 🎯 Future Architecture Improvements

### Planned:
1. **i18n Layer** - Multi-language UI (EN, RU, UK)
2. **Testing Framework** - Jest + mocks
3. **Structured Logging** - Winston/Pino
4. **Error Tracking** - Sentry (optional)
5. **Monitoring** - Health checks

### Nice to Have:
1. **Microservices** - Split into voice-service, transaction-service, etc.
2. **Message Queue** - Bull/RabbitMQ for async tasks
3. **Caching Layer** - Redis for sessions
4. **Web Dashboard** - React/Next.js admin panel
5. **GraphQL API** - Unified data layer

---

## 📚 Related Documentation

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Detailed database schema
- [README.md](README.md) - Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [PROJECT_AUDIT.md](PROJECT_AUDIT.md) - Full project analysis
- [INTERNATIONALIZATION_PLAN.md](INTERNATIONALIZATION_PLAN.md) - i18n implementation

---

## 🤝 Contributing to Architecture

When adding new features:

1. **Handler** - Create in `src/handlers/`
2. **Service** - Add to `src/services/` if reusable
3. **Entity** - Add to `src/database/entities/` if new data
4. **Parser** - Add to `src/parsers/` if parsing logic
5. **Wizard** - Extend `WizardManager` for multi-step flows

**Keep:**
- Single Responsibility Principle
- Clear separation of concerns
- TypeScript strict mode
- Descriptive naming

---

**Architecture Last Updated:** January 19, 2026

## Testing Architecture

### Test Layout
- Unit tests: `src/__tests__/unit/*.test.ts`
- Integration tests: `src/__tests__/integration/*.test.ts`

### E2E Scenarios
1. Expense flow: amount -> category (inline) -> account
2. Income flow: amount -> category (inline) -> account
3. Transfer flow: amount -> from account
4. Analytics flow: menu -> net worth/history
5. Export flow: analytics reports -> export CSV

### Mocks and Dependencies
- Database layer is mocked in unit/integration tests.
- Telegram bot API is mocked with in-memory handlers.
- Callback query handling (`tx_cat|`) is covered by unit tests.

## Monitoring

### Health Checks
- HTTP server provides `/healthz` and `/readyz`
- Configurable via `HEALTH_HOST` and `HEALTH_PORT`

### Error Tracking (Sentry)
- Initialized at startup when `SENTRY_DSN` is set
- Optional: `SENTRY_ENV`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_RELEASE`


## Deployment

### systemd
- Unit file: `systemd/my-pers-fin-bot.service`
- Runs as non-root user `bot`
- Logs: `/var/log/my-pers-fin-bot/`

### Health Checks
- Endpoints: `/healthz`, `/readyz`

### Monitoring
- Sentry initialized when `SENTRY_DSN` is provided

## Bootstrap Flow

### Startup Sequence
1. `initObservability()` (Sentry + health server)
2. `initializeApp()` (DB, cache, bot)
3. `registerAppServices()` (scheduler, commands, period reports)
4. `WizardManager` init
5. `registerRouters()` (message + callback routers)
6. `setupShutdownHandlers()`

### Bootstrap Modules
- `src/bootstrap/observability.ts`
- `src/bootstrap/app-services.ts`
- `src/bootstrap/routers.ts`

### Health & Monitoring
- `/healthz` and `/readyz` endpoints
- Sentry enabled when `SENTRY_DSN` provided
