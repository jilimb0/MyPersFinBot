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
