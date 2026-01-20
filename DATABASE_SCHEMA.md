# 🗄️ Database Schema

**Personal Finance Telegram Bot - Database Structure**

---

## 📊 Overview

**Database:** SQLite 3  
**ORM:** TypeORM  
**Mode:** WAL (Write-Ahead Logging) for better concurrency  
**Location:** `data/database.db`

**Total Tables:** 10

---

## 🗓️ Entity Relationship Diagram

```
                           ┌───────────────────────┐
                           │        users         │
                           │───────────────────────│
                           │ id (PK)              │
                           │ defaultCurrency      │
                           │ createdAt            │
                           │ templates            │
                           │ reminderSettings     │
                           └──────────┬────────────┘
                                    │
                ┌────────────────┼────────────────────────────┐
                │                │                           │
       ┌────────┼──────┐    ┌───────┼──────┐    ┌────────┼──────┐
       │         │         │    │        │       │    │         │       │
       ▼         ▼         ▼    ▼        ▼       ▼    ▼         ▼       ▼
┌─────────┐ ┌───────────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────────┐
│balances │ │ transactions  │ │ debts   │ │ goals   │ │ income_sources     │
│─────────│ │───────────────│ │─────────│ │─────────│ │────────────────────│
│userId   │ │ userId         │ │ userId  │ │ userId  │ │ userId             │
│account │ │ type           │ │ type    │ │ name    │ │ name               │
│amount  │ │ amount         │ │ amount  │ │ target  │ │ expectedAmount     │
│currency│ │ category       │ │ paid    │ │ current │ │ frequency          │
└─────────┘ │ date           │ │ isPaid  │ │ status  │ │ autoCreate         │
           │ fromAccountId  │ │ dueDate │ │ deadline│ └────────────────────┘
           │ toAccountId    │ └─────────┘ │autoDepo│
           └───────────────┘           └─────────┘


     ┌──────────────────────────────────────┐
     │     recurring_transactions        │
     │──────────────────────────────────────│
     │ userId                            │
     │ type (EXPENSE/INCOME)             │
     │ frequency (DAILY/WEEKLY/MONTHLY)  │
     │ nextExecutionDate                 │
     │ autoExecute                       │
     └──────────────────────────────────────┘


     ┌──────────────────────────────────────┐
     │           reminders               │
     │──────────────────────────────────────│
     │ userId                            │
     │ type (DEBT/GOAL/INCOME/...)       │
     │ entityId                          │
     │ reminderDate                      │
     │ isProcessed                       │
     └──────────────────────────────────────┘


     ┌──────────────────────────────────────┐
     │      category_preferences         │
     │──────────────────────────────────────│
     │ userId                            │
     │ category                          │
     │ preferredAccountId                │
     │ useCount                          │
     └──────────────────────────────────────┘


     ┌──────────────────────────────────────┐
     │             budgets                │
     │──────────────────────────────────────│
     │ userId                            │
     │ category                          │
     │ amount                            │
     │ period (MONTHLY/WEEKLY/YEARLY)    │
     └──────────────────────────────────────┘
```

---

## 📝 Table Definitions

### 1. `users` - User Settings

**Purpose:** Store per-user configuration and preferences

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key (Telegram user ID mapped to UUID) |
| `defaultCurrency` | TEXT | No | "USD" | Default currency for transactions |
| `createdAt` | DATETIME | No | NOW() | Account creation timestamp |
| `templates` | JSON | Yes | null | Transaction templates (quick actions) |
| `reminderSettings` | JSON | Yes | null | Reminder preferences |

**Relationships:**
- One-to-Many with `balances`
- One-to-Many with `transactions`
- One-to-Many with `debts`
- One-to-Many with `goals`
- One-to-Many with `income_sources`

**Indexes:**
- Primary: `id`

**Example:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "defaultCurrency": "USD",
  "createdAt": "2026-01-15T10:00:00Z",
  "templates": [
    {"name": "Coffee", "amount": 5, "category": "Food"},
    {"name": "Taxi", "amount": 10, "category": "Transport"}
  ],
  "reminderSettings": {
    "enabled": true,
    "time": "09:00"
  }
}
```

---

### 2. `balances` - Account Balances

**Purpose:** Track user's account balances (Cash, Card, Savings, etc.)

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `accountId` | TEXT | No | - | Account identifier (e.g., "main_card", "cash") |
| `amount` | REAL | No | - | Current balance |
| `currency` | TEXT | No | - | Currency code (USD, EUR, etc.) |
| `lastUpdated` | DATETIME | No | NOW() | Last update timestamp |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`
- Unique: `(userId, accountId, currency)`

**Example:**
```json
{
  "id": "a1b2c3d4-...",
  "userId": "550e8400-...",
  "accountId": "main_card",
  "amount": 1234.56,
  "currency": "USD",
  "lastUpdated": "2026-01-19T14:00:00Z"
}
```

---

### 3. `transactions` - Financial Transactions

**Purpose:** Record all income, expense, and transfer transactions

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `date` | DATETIME | No | - | Transaction date |
| `amount` | REAL | No | - | Transaction amount |
| `currency` | TEXT | No | - | Currency code |
| `type` | TEXT | No | - | EXPENSE, INCOME, or TRANSFER |
| `category` | TEXT | Yes | null | Transaction category |
| `description` | TEXT | Yes | null | Optional description |
| `fromAccountId` | TEXT | Yes | null | Source account (for EXPENSE/TRANSFER) |
| `toAccountId` | TEXT | Yes | null | Destination account (for INCOME/TRANSFER) |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`
- Index: `date`

**Transaction Types:**
- `EXPENSE`: Money out (fromAccountId required)
- `INCOME`: Money in (toAccountId required)
- `TRANSFER`: Between accounts (both required)

**Example:**
```json
{
  "id": "b2c3d4e5-...",
  "userId": "550e8400-...",
  "date": "2026-01-19T12:00:00Z",
  "amount": 50.00,
  "currency": "USD",
  "type": "EXPENSE",
  "category": "Food",
  "description": "coffee",
  "fromAccountId": "main_card",
  "toAccountId": null
}
```

---

### 4. `debts` - Debt Tracking

**Purpose:** Track money owed to/from others

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `name` | TEXT | No | - | Debt name/title |
| `amount` | REAL | No | - | Total debt amount |
| `currency` | TEXT | No | - | Currency code |
| `counterparty` | TEXT | No | - | Person/entity name |
| `type` | TEXT | No | - | "I_OWE" or "OWES_ME" |
| `paidAmount` | REAL | No | 0 | Amount already paid |
| `isPaid` | BOOLEAN | No | false | Is debt fully paid? |
| `description` | TEXT | Yes | null | Optional notes |
| `dueDate` | DATETIME | Yes | null | Payment deadline |
| `reminderDaysBefore` | INTEGER | Yes | null | Days before due date to remind |
| `isRecurring` | BOOLEAN | No | false | Is this a recurring debt? |
| `recurringFrequency` | TEXT | Yes | null | "MONTHLY" or "WEEKLY" |
| `autoPayment` | JSON | Yes | null | Auto-payment configuration |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`

**Auto-Payment Structure:**
```json
{
  "enabled": true,
  "amount": 100,
  "accountId": "main_card",
  "frequency": "MONTHLY",
  "dayOfMonth": 1
}
```

**Example:**
```json
{
  "id": "c3d4e5f6-...",
  "userId": "550e8400-...",
  "name": "Loan from John",
  "amount": 1000.00,
  "currency": "USD",
  "counterparty": "John Smith",
  "type": "I_OWE",
  "paidAmount": 300.00,
  "isPaid": false,
  "dueDate": "2026-02-01T00:00:00Z",
  "reminderDaysBefore": 3
}
```

---

### 5. `goals` - Savings Goals

**Purpose:** Track savings targets and progress

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `name` | TEXT | No | - | Goal name |
| `targetAmount` | REAL | No | - | Target amount to save |
| `currentAmount` | REAL | No | 0 | Current savings |
| `currency` | TEXT | No | - | Currency code |
| `status` | TEXT | No | "ACTIVE" | "ACTIVE", "COMPLETED", or "PAUSED" |
| `deadline` | DATETIME | Yes | null | Target completion date |
| `autoDeposit` | JSON | Yes | null | Auto-deposit configuration |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`

**Auto-Deposit Structure:**
```json
{
  "enabled": true,
  "amount": 100,
  "accountId": "main_card",
  "frequency": "MONTHLY",
  "dayOfMonth": 1
}
```

**Example:**
```json
{
  "id": "d4e5f6g7-...",
  "userId": "550e8400-...",
  "name": "Vacation Fund",
  "targetAmount": 2000.00,
  "currentAmount": 500.00,
  "currency": "USD",
  "status": "ACTIVE",
  "deadline": "2026-06-01T00:00:00Z"
}
```

---

### 6. `recurring_transactions` - Scheduled Transactions

**Purpose:** Automatically create recurring expenses/income

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `type` | TEXT | No | - | "EXPENSE" or "INCOME" |
| `amount` | REAL | No | - | Transaction amount |
| `currency` | TEXT | No | - | Currency code |
| `category` | TEXT | No | - | Transaction category |
| `accountId` | TEXT | No | - | Account ID |
| `frequency` | TEXT | No | - | "DAILY", "WEEKLY", "MONTHLY", "YEARLY" |
| `startDate` | DATETIME | No | - | Start date |
| `endDate` | DATETIME | Yes | null | Optional end date |
| `nextExecutionDate` | DATETIME | No | - | Next scheduled execution |
| `isActive` | BOOLEAN | No | true | Is active? |
| `autoExecute` | BOOLEAN | No | true | Auto-create transaction? |
| `description` | TEXT | Yes | null | Optional description |
| `dayOfMonth` | INTEGER | Yes | null | Day of month (for MONTHLY) |
| `dayOfWeek` | INTEGER | Yes | null | Day of week (for WEEKLY, 0=Sunday) |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`
- Index: `nextExecutionDate`

**Example:**
```json
{
  "id": "e5f6g7h8-...",
  "userId": "550e8400-...",
  "type": "EXPENSE",
  "amount": 1000.00,
  "currency": "USD",
  "category": "Housing",
  "accountId": "main_card",
  "frequency": "MONTHLY",
  "startDate": "2026-01-01T00:00:00Z",
  "nextExecutionDate": "2026-02-01T00:00:00Z",
  "isActive": true,
  "autoExecute": true,
  "description": "Rent",
  "dayOfMonth": 1
}
```

---

### 7. `reminders` - Notification Queue

**Purpose:** Queue reminders for debts, goals, income

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `type` | TEXT | No | - | "DEBT", "GOAL", "INCOME", "RECURRING_TX" |
| `entityId` | TEXT | No | - | ID of related entity |
| `reminderDate` | DATETIME | No | - | When to send reminder |
| `message` | TEXT | No | - | Reminder message |
| `isProcessed` | BOOLEAN | No | false | Has been sent? |
| `createdAt` | DATETIME | No | NOW() | Creation timestamp |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`
- Index: `reminderDate`
- Index: `isProcessed`

**Example:**
```json
{
  "id": "f6g7h8i9-...",
  "userId": "550e8400-...",
  "type": "DEBT",
  "entityId": "c3d4e5f6-...",
  "reminderDate": "2026-01-29T09:00:00Z",
  "message": "🔔 Reminder: Loan from John due in 3 days (1000 USD)",
  "isProcessed": false,
  "createdAt": "2026-01-19T14:00:00Z"
}
```

---

### 8. `income_sources` - Expected Income

**Purpose:** Track expected income sources (salary, freelance, etc.)

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | Foreign key to `users.id` |
| `name` | TEXT | No | - | Income source name |
| `expectedAmount` | REAL | Yes | null | Expected amount |
| `currency` | TEXT | Yes | null | Currency code |
| `frequency` | TEXT | Yes | null | "MONTHLY" or "ONE_TIME" |
| `expectedDate` | INTEGER | Yes | null | Day of month (1-31) |
| `accountId` | TEXT | Yes | null | Destination account |
| `autoCreate` | JSON | Yes | null | Auto-create transaction config |
| `reminderEnabled` | BOOLEAN | No | false | Send reminder? |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `id`
- Index: `userId`

**Auto-Create Structure:**
```json
{
  "enabled": true,
  "amount": 5000,
  "accountId": "main_card",
  "frequency": "MONTHLY",
  "dayOfMonth": 1
}
```

**Example:**
```json
{
  "id": "g7h8i9j0-...",
  "userId": "550e8400-...",
  "name": "Salary",
  "expectedAmount": 5000.00,
  "currency": "USD",
  "frequency": "MONTHLY",
  "expectedDate": 1,
  "accountId": "main_card",
  "reminderEnabled": true
}
```

---

### 9. `category_preferences` - User Preferences

**Purpose:** Remember user's preferred account for each category

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `userId` | UUID | No | - | Foreign key to `users.id` (part of PK) |
| `category` | TEXT | No | - | Transaction category (part of PK) |
| `preferredAccountId` | TEXT | No | - | Preferred account for this category |
| `useCount` | INTEGER | No | 0 | How many times used |
| `lastUsed` | DATETIME | No | NOW() | Last usage timestamp |

**Relationships:**
- Many-to-One with `users`

**Indexes:**
- Primary: `(userId, category)` (composite)
- Unique: `(userId, category)`

**Example:**
```json
{
  "userId": "550e8400-...",
  "category": "Food",
  "preferredAccountId": "main_card",
  "useCount": 45,
  "lastUsed": "2026-01-19T12:00:00Z"
}
```

---

### 10. `budgets` - Budget Limits

**Purpose:** Set spending limits per category

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | No | Auto | Primary key |
| `userId` | UUID | No | - | User ID |
| `category` | TEXT | No | - | Category name |
| `amount` | DECIMAL | No | - | Budget limit |
| `period` | VARCHAR(20) | No | "MONTHLY" | "MONTHLY", "WEEKLY", "YEARLY" |
| `currency` | TEXT | No | "USD" | Currency code |
| `createdAt` | DATETIME | No | NOW() | Creation timestamp |
| `updatedAt` | DATETIME | No | NOW() | Last update timestamp |

**Indexes:**
- Primary: `id`
- Index: `(userId, category)`

**Example:**
```json
{
  "id": "h8i9j0k1-...",
  "userId": "550e8400-...",
  "category": "Food",
  "amount": 500.00,
  "period": "MONTHLY",
  "currency": "USD",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-19T14:00:00Z"
}
```

---

## 🔗 Relationships Summary

### One-to-Many

```
users (1) → (*) balances
users (1) → (*) transactions
users (1) → (*) debts
users (1) → (*) goals
users (1) → (*) income_sources
users (1) → (*) recurring_transactions
users (1) → (*) reminders
users (1) → (*) category_preferences
users (1) → (*) budgets
```

### Foreign Keys

All tables (except `users`) have `userId` as foreign key.

**TypeORM handles cascading:**
- Delete user → delete all related records (cascade)

---

## 📊 Indexes

### Performance Indexes

**Current:**
- `transactions.userId` - Fast user queries
- `transactions.date` - Date range queries
- `recurring_transactions.nextExecutionDate` - Scheduler queries
- `reminders.isProcessed` - Find pending reminders
- `reminders.reminderDate` - Scheduled reminders

**Recommended (TODO):**
```sql
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_user_date ON transactions(userId, date);
```

---

## 📦 Data Types

### SQLite Type Mapping

| TypeORM | SQLite | Description |
|---------|--------|-------------|
| `@PrimaryGeneratedColumn('uuid')` | TEXT | UUID as string |
| `@Column()` | TEXT | String |
| `@Column('real')` | REAL | Floating point (amount) |
| `@Column('integer')` | INTEGER | Whole numbers |
| `@Column('boolean')` | INTEGER | 0 or 1 |
| `@Column('datetime')` | TEXT | ISO 8601 string |
| `@Column('simple-json')` | TEXT | JSON string |
| `@Column('decimal')` | TEXT | Precise decimal |

### Currency Amounts

**Stored as:** `REAL` (floating point)  
**Precision:** ~15 decimal digits  

**Note:** For financial precision, consider using `INTEGER` (cents) in future.

---

## 🔒 Constraints

### Unique Constraints

1. `balances`: `(userId, accountId, currency)` - One balance per account per currency
2. `category_preferences`: `(userId, category)` - One preference per category

### Check Constraints

**Not implemented** (SQLite limited support)

**Validated in code:**
- Amount > 0
- Valid currency codes
- Valid date formats
- Valid enum values (type, status, etc.)

---

## 🔄 Migration Strategy

### Current Approach

**TypeORM automatic synchronization:**
```typescript
// data-source.ts
synchronize: true  // Auto-create/update tables
```

⚠️ **Development only!**

### Production Approach (Recommended)

```bash
# Generate migration
pnpm run migration:generate -- -n AddIndexes

# Run migrations
pnpm run migration:run

# Revert if needed
pnpm run migration:revert
```

**Set:** `synchronize: false` in production

---

## 💾 Backup Strategy

See [DEPLOYMENT.md](DEPLOYMENT.md) for backup procedures.

**What to backup:**
- `data/database.db` - Main database
- `data/database.db-shm` - Shared memory (WAL)
- `data/database.db-wal` - Write-ahead log (WAL)

**Frequency:** Daily (automated via cron + `backup.sh`)

---

## 📈 Scalability Considerations

### Current Limits

**Single SQLite file:**
- ✅ Perfect for 1 user
- ✅ Works for multiple users (thousands)
- ⚠️ Concurrent writes limited by WAL mode

### To Scale

1. **Add indexes** (see above)
2. **Partition data** (archive old transactions)
3. **Switch to PostgreSQL** (if >10k users)
4. **Add read replicas** (for analytics)
5. **Shard by userId** (extreme scale)

---

## 📚 Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [README.md](README.md) - Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [PROJECT_AUDIT.md](PROJECT_AUDIT.md) - Full project analysis

---

**Database Schema Last Updated:** January 19, 2026
