import { Composer } from 'telegraf';
import { MyContext } from '../types/context';
import { db } from '../database/storage-db';
import { TransactionType } from '../types';
import { COMMANDS } from '../commands';

export const periodReportHandlers = new Composer<MyContext>();

// Helper функция для форматирования отчета
function formatPeriodReport(
  transactions: any[],
  startDate: Date,
  endDate: Date,
  type?: TransactionType
): string {
  if (transactions.length === 0) {
    return `📊 Нет транзакций за период\n${startDate.toLocaleDateString('ru')} - ${endDate.toLocaleDateString('ru')}`;
  }

  const typeEmoji = {
    [TransactionType.INCOME]: '💰',
    [TransactionType.EXPENSE]: '💸',
    [TransactionType.TRANSFER]: '↔️',
  };

  let report = `📊 *Отчет за период*\n`;
  report += `📅 ${startDate.toLocaleDateString('ru')} - ${endDate.toLocaleDateString('ru')}\n`;
  
  if (type) {
    report += `📌 Тип: ${typeEmoji[type]} ${type}\n`;
  }
  report += `\n`;

  // Группировка по валюте
  const byCurrency: Record<string, { total: number; count: number }> = {};
  
  transactions.forEach(tx => {
    if (!byCurrency[tx.currency]) {
      byCurrency[tx.currency] = { total: 0, count: 0 };
    }
    byCurrency[tx.currency].total += tx.amount;
    byCurrency[tx.currency].count++;
  });

  report += `*Итого:*\n`;
  Object.entries(byCurrency).forEach(([currency, data]) => {
    report += `${currency}: ${data.total.toFixed(2)} (${data.count} тр.)\n`;
  });

  // Группировка по категориям (топ-5)
  const byCategory: Record<string, number> = {};
  transactions.forEach(tx => {
    if (!byCategory[tx.category]) {
      byCategory[tx.category] = 0;
    }
    byCategory[tx.category] += tx.amount;
  });

  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topCategories.length > 0) {
    report += `\n*Топ категории:*\n`;
    topCategories.forEach(([category, amount]) => {
      report += `${category}: ${amount.toFixed(2)}\n`;
    });
  }

  return report;
}

// Команда: Отчет за произвольный период
periodReportHandlers.command(COMMANDS.REPORT_PERIOD, async (ctx) => {
  await ctx.reply(
    '📊 *Отчет за период*\n\n' +
    'Введите даты в формате:\n' +
    '`ГГГГ-ММ-ДД ГГГГ-ММ-ДД`\n\n' +
    'Пример: `2024-01-01 2024-03-31`\n\n' +
    'Опционально добавьте тип:\n' +
    '`2024-01-01 2024-03-31 EXPENSE`\n' +
    '`2024-01-01 2024-03-31 INCOME`\n' +
    '`2024-01-01 2024-03-31 TRANSFER`',
    { parse_mode: 'Markdown' }
  );
});

// Обработчик ввода дат для периода
periodReportHandlers.hears(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})(\s+(INCOME|EXPENSE|TRANSFER))?$/i, async (ctx) => {
  const userId = ctx.from!.id.toString();
  const match = ctx.message.text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})(\s+(INCOME|EXPENSE|TRANSFER))?$/i)!;
  
  const startDate = new Date(match[1]);
  const endDate = new Date(match[2]);
  endDate.setHours(23, 59, 59, 999); // Включаем конец дня
  const type = match[4] as TransactionType | undefined;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return ctx.reply('❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД');
  }

  if (startDate > endDate) {
    return ctx.reply('❌ Начальная дата не может быть позже конечной');
  }

  try {
    const transactions = await db.getTransactionsByDateRange(
      userId,
      startDate,
      endDate,
      type
    );

    const report = formatPeriodReport(transactions, startDate, endDate, type);
    await ctx.reply(report, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating period report:', error);
    await ctx.reply('❌ Ошибка при создании отчета');
  }
});

// Команда: Отчет за квартал
periodReportHandlers.command(COMMANDS.REPORT_QUARTER, async (ctx) => {
  const userId = ctx.from!.id.toString();
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const startMonth = currentQuarter * 3;
  
  const startDate = new Date(now.getFullYear(), startMonth, 1);
  const endDate = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59);

  try {
    const transactions = await db.getTransactionsByDateRange(
      userId,
      startDate,
      endDate
    );

    let report = `📊 *Отчет за Q${currentQuarter + 1} ${now.getFullYear()}*\n\n`;
    report += formatPeriodReport(transactions, startDate, endDate);
    
    await ctx.reply(report, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating quarter report:', error);
    await ctx.reply('❌ Ошибка при создании отчета');
  }
});

// Команда: Отчет за год
periodReportHandlers.command(COMMANDS.REPORT_YEAR, async (ctx) => {
  const userId = ctx.from!.id.toString();
  const now = new Date();
  
  const startDate = new Date(now.getFullYear(), 0, 1);
  const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  try {
    const transactions = await db.getTransactionsByDateRange(
      userId,
      startDate,
      endDate
    );

    let report = `📊 *Отчет за ${now.getFullYear()} год*\n\n`;
    report += formatPeriodReport(transactions, startDate, endDate);
    
    // Добавляем сравнение по месяцам
    const byMonth: Record<number, number> = {};
    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      byMonth[month] = (byMonth[month] || 0) + tx.amount;
    });

    report += `\n*По месяцам:*\n`;
    Object.entries(byMonth)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([month, amount]) => {
        const monthName = new Date(2024, Number(month)).toLocaleString('ru', { month: 'long' });
        report += `${monthName}: ${amount.toFixed(2)}\n`;
      });
    
    await ctx.reply(report, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating year report:', error);
    await ctx.reply('❌ Ошибка при создании отчета');
  }
});
