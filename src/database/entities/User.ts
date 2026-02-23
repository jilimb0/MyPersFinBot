import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm"
import type { Language } from "../../i18n"
import type {
  Currency,
  ReminderSettings,
  TransactionTemplate,
} from "../../types"
import { Balance } from "./Balance"
import { Debt } from "./Debt"
import { Goal } from "./Goal"
import { IncomeSource } from "./IncomeSource"
import { Transaction } from "./Transaction"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "text", default: "USD" })
  defaultCurrency!: Currency

  @Column({ type: "text", default: "en" })
  language!: Language

  @Column({ type: "text", default: "free" })
  subscriptionTier!: "free" | "trial" | "premium"

  @Column({ type: "datetime", nullable: true })
  premiumExpiresAt?: Date | null

  @Column({ type: "datetime", nullable: true })
  trialStartedAt?: Date | null

  @Column({ type: "datetime", nullable: true })
  trialExpiresAt?: Date | null

  @Column({ type: "boolean", default: false })
  trialUsed!: boolean

  @Column({ type: "integer", default: 0 })
  transactionsThisMonth!: number

  @Column({ type: "text", nullable: true })
  transactionsMonthKey?: string | null

  @Column({ type: "integer", default: 0 })
  voiceInputsToday!: number

  @Column({ type: "text", nullable: true })
  voiceDayKey?: string | null

  @Column({ type: "datetime", nullable: true })
  lastPaymentAt?: Date | null

  @Column({ type: "text", nullable: true })
  lastPaymentProvider?: string | null

  @Column({ type: "text", nullable: true })
  lastPaymentReference?: string | null

  @Column({ type: "boolean", default: false })
  subscriptionPaused!: boolean

  @Column({ type: "integer", default: 0 })
  pausedRemainingMs!: number

  @Column({ type: "text", nullable: true })
  pausedTier?: "trial" | "premium" | null

  @CreateDateColumn()
  createdAt!: Date

  @Column({ type: "simple-json", nullable: true })
  templates?: TransactionTemplate[]

  @Column({ type: "simple-json", nullable: true })
  reminderSettings?: ReminderSettings

  // Relations
  @OneToMany(
    () => Balance,
    (balance) => balance.user
  )
  balances!: Balance[]

  @OneToMany(
    () => Transaction,
    (transaction) => transaction.user
  )
  transactions!: Transaction[]

  @OneToMany(
    () => Debt,
    (debt) => debt.user
  )
  debts!: Debt[]

  @OneToMany(
    () => Goal,
    (goal) => goal.user
  )
  goals!: Goal[]

  @OneToMany(
    () => IncomeSource,
    (source) => source.user
  )
  incomeSources!: IncomeSource[]
}
