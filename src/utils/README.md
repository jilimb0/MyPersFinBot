# Security Utils - Input Sanitization

## 🔒 Overview

Комплексная система защиты от XSS, SQL Injection и других атак через валидацию и санитизацию входных данных.

## 📦 Installed Libraries

```json
"sanitize-html": "^2.17.0"  // HTML sanitization
"validator": "^13.15.26"    // Input validation
```

## 🛡️ Protection Layers

### 1. **SQL Injection Protection**

- ✅ TypeORM использует параметризованные запросы
- ✅ Валидация всех входных параметров
- ✅ Типизация через TypeScript

### 2. **XSS Protection**

- ✅ HTML escaping через `validator.escape()`
- ✅ Tag stripping через `sanitize-html`
- ✅ Двойная защита

### 3. **Input Validation**

- ✅ Проверка форматов (email, currency, etc.)
- ✅ Ограничение длины строк
- ✅ Валидация числовых значений

## 📚 Functions

### `sanitizeText(input: string): string`

Общая санитизация текста:

```typescript
import { sanitizeText } from './utils/sanitizer'

const safe = sanitizeText("<script>alert('xss')</script>")
// Result: ""

const safe2 = sanitizeText("Test & <test>")
// Result: "Test &amp; &lt;test&gt;"
```

### `sanitizeDescription(input: string): string`

Санитизация описаний (более мягкая):

```typescript
const desc = sanitizeDescription("Monthly rent payment")
// Max 500 characters, preserves basic formatting
```

### `sanitizeName(input: string): string`

Санитизация имён аккаунтов/контрагентов:

```typescript
const name = sanitizeName("Cash Account")
// Throws if no alphanumeric characters
// Max 100 characters
```

### `sanitizeUserId(userId: number | string): string`

Валидация Telegram User ID:

```typescript
const userId = sanitizeUserId(123456)
// Result: "123456"

sanitizeUserId(-1) // Throws: User ID must be positive
```

### `sanitizeAmount(amount: number | string): number`

Валидация денежных сумм:

```typescript
const amount = sanitizeAmount("100.556")
// Result: 100.56 (rounded to 2 decimals)

sanitizeAmount(1000000000) // Throws: Amount too large
```

### `sanitizeCurrency(currency: string): string`

Валидация валютных кодов:

```typescript
const curr = sanitizeCurrency("usd")
// Result: "USD"

sanitizeCurrency("$") // Throws: Invalid currency code
```

### `sanitizeDate(date: string | Date): Date`

Валидация дат:

```typescript
const date = sanitizeDate("2024-01-15T10:00:00Z")
// Must be ISO 8601 format
// Range: 2000-01-01 to (now + 10 years)
```

### `sanitizeTransactionInput(input): SanitizedTransactionInput`

Комплексная санитизация транзакции:

```typescript
const input = {
  userId: 123456,
  amount: "100.50",
  currency: "usd",
  description: "  Test <b>payment</b>  ",
  fromAccountId: "Cash",
}

const safe = sanitizeTransactionInput(input)
// {
//   userId: "123456",
//   amount: 100.5,
//   currency: "USD",
//   description: "Test payment",
//   fromAccountId: "Cash"
// }
```

### `detectMaliciousInput(input: string): boolean`

Обнаружение вредоносного ввода:

```typescript
if (detectMaliciousInput(userInput)) {
  logger.warn("Malicious input detected!")
  // Take action
}

// Detects:
// - <script> tags
// - javascript: URIs
// - Event handlers (onclick, etc.)
// - SQL injection patterns (UNION, DROP, etc.)
```

## 🎯 Usage Examples

### Example 1: Sanitize User Input in Bot Handler

```typescript
import { sanitizeText, detectMaliciousInput } from './utils/sanitizer'

bot.on('message', async (msg) => {
  const userInput = msg.text
  
  // Detect malicious input
  if (detectMaliciousInput(userInput)) {
    return bot.sendMessage(msg.chat.id, '⚠️ Invalid input detected')
  }
  
  // Sanitize before processing
  const safeInput = sanitizeText(userInput)
  
  // Now safe to use
  await processTransaction(safeInput)
})
```

### Example 2: Sanitize Before Database Save

```typescript
import { sanitizeTransactionInput } from './utils/sanitizer'

async function createTransaction(rawData: any) {
  // Sanitize all inputs
  const safeData = sanitizeTransactionInput({
    userId: rawData.userId,
    amount: rawData.amount,
    currency: rawData.currency,
    description: rawData.description,
  })
  
  // Now safe to save to database
  await transactionRepo.save(safeData)
}
```

### Example 3: Validate API Input

```typescript
import { sanitizeAmount, sanitizeCurrency } from './utils/sanitizer'

app.post('/api/transfer', async (req, res) => {
  try {
    const amount = sanitizeAmount(req.body.amount)
    const currency = sanitizeCurrency(req.body.currency)
    
    // Proceed with validated data
    await processTransfer(amount, currency)
    res.json({ success: true })
    
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

## 🧪 Testing

Все функции покрыты тестами:

```bash
pnpm test src/__tests__/unit/sanitizer.test.ts
```

Тесты проверяют:

- ✅ XSS защиту
- ✅ SQL injection защиту
- ✅ Валидацию форматов
- ✅ Ограничения длины
- ✅ Edge cases

## 🔐 Security Checklist

### Before Database Operations

- [ ] Sanitize user IDs
- [ ] Validate amounts
- [ ] Sanitize descriptions/notes
- [ ] Validate currency codes
- [ ] Check date ranges

### Before Displaying to Users

- [ ] Escape HTML entities
- [ ] Remove script tags
- [ ] Limit string length

### Logging

- [ ] Detect malicious patterns
- [ ] Log suspicious activity
- [ ] Don't log sensitive data

## 🚀 Best Practices

1. **Always sanitize at input boundaries**

   ```typescript
   // ✅ Good
   const safe = sanitizeText(userInput)
   await save(safe)
   
   // ❌ Bad
   await save(userInput)
   ```

2. **Use TypeORM query builders (already safe)**

   ```typescript
   // ✅ Good - TypeORM escapes automatically
   await repo.findOne({ where: { userId } })
   
   // ❌ Bad - Never do this
   await repo.query(`SELECT * FROM users WHERE id = ${userId}`)
   ```

3. **Validate early, sanitize always**

   ```typescript
   // Validate format
   if (!isValidFormat(input)) throw new Error('Invalid format')
   
   // Sanitize anyway
   const safe = sanitizeText(input)
   ```

4. **Log suspicious activity**

   ```typescript
   if (detectMaliciousInput(input)) {
     logger.warn('Malicious input', { userId, input: input.substring(0, 100) })
   }
   ```

## 📊 Coverage

| Function | XSS | SQL Injection | Length Limit | Type Validation |
| --------------------------------------------------------------- |
| sanitizeText | ✅ | ✅ | ✅ (1000) | ✅ |
| sanitizeDescription | ✅ | ✅ | ✅ (500) | ✅ |
| sanitizeName | ✅ | ✅ | ✅ (100) | ✅ |
| sanitizeUserId | ✅ | ✅ | N/A | ✅ |
| sanitizeAmount | N/A | ✅ | ✅ (1B) | ✅ |
| sanitizeCurrency | ✅ | ✅ | ✅ (3) | ✅ |
| sanitizeDate | N/A | ✅ | ✅ (range) | ✅ |

## 🎓 References

- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [sanitize-html docs](https://github.com/apostrophecms/sanitize-html)
- [validator.js docs](https://github.com/validatorjs/validator.js)
