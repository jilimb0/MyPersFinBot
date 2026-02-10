import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm"
import type {
  Currency,
  TransactionCategory,
  TransactionType,
} from "../../types"
import { User } from "./User"

@Entity("recurring_transactions")
export class RecurringTransaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column({ type: "text" })
  type!: TransactionType

  @Column("real")
  amount!: number

  @Column({ type: "text" })
  currency!: Currency

  @Column({ type: "text" })
  category!: TransactionCategory

  @Column()
  accountId!: string

  @Column({ type: "text" })
  frequency!: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"

  @Column({ type: "text", nullable: true })
  cronExpression?: string

  @Column("datetime")
  startDate!: Date

  @Column({ type: "datetime", nullable: true })
  endDate?: Date

  @Column("datetime")
  @Index()
  nextExecutionDate!: Date

  @Column({ type: "boolean", default: true })
  isActive!: boolean

  @Column({ type: "boolean", default: true })
  autoExecute!: boolean

  @Column({ nullable: true })
  description?: string

  @Column({ type: "integer", nullable: true })
  dayOfMonth?: number

  @Column({ type: "integer", nullable: true })
  dayOfWeek?: number

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User
}
