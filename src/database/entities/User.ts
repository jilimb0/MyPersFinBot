import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from "typeorm"
import { Balance } from "./Balance"
import { Transaction } from "./Transaction"
import { Debt } from "./Debt"
import { Goal } from "./Goal"
import { IncomeSource } from "./IncomeSource"
import { Currency, TransactionTemplate, ReminderSettings } from "../../types"
import { Language } from "../../i18n"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "text", default: "USD" })
  defaultCurrency: Currency

  @Column({ type: "text", default: "en" })
  language!: Language

  @CreateDateColumn()
  createdAt!: Date

  @Column({ type: "simple-json", nullable: true })
  templates?: TransactionTemplate[]

  @Column({ type: "simple-json", nullable: true })
  reminderSettings?: ReminderSettings

  // Relations
  @OneToMany(() => Balance, (balance) => balance.user)
  balances!: Balance[]

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions!: Transaction[]

  @OneToMany(() => Debt, (debt) => debt.user)
  debts!: Debt[]

  @OneToMany(() => Goal, (goal) => goal.user)
  goals!: Goal[]

  @OneToMany(() => IncomeSource, (source) => source.user)
  incomeSources!: IncomeSource[]
}
