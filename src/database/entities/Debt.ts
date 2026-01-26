import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"
import { Currency } from "../../types"

@Entity("debts")
@Index(["userId", "isPaid"])
export class Debt {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column()
  name!: string

  @Column("real")
  amount!: number

  @Column({ type: "text" })
  currency!: Currency

  @Column()
  counterparty!: string

  @Column({ type: "text" })
  type!: "OWES_ME" | "I_OWE"

  @Column("real", { default: 0 })
  paidAmount!: number

  @Column("boolean", { default: false })
  isPaid!: boolean

  @Column({ nullable: true })
  description?: string

  @Column({ type: "datetime", nullable: true })
  dueDate?: Date

  @Column({ type: "integer", nullable: true })
  reminderDaysBefore?: number

  @Column({ type: "boolean", default: false })
  isRecurring?: boolean

  @Column({ type: "text", nullable: true })
  recurringFrequency?: "MONTHLY" | "WEEKLY"

  @Column({ type: "json", nullable: true })
  autoPayment?: {
    enabled: boolean
    amount: number
    accountId: string
    frequency: "MONTHLY"
    dayOfMonth: number
  }

  // Relations
  @ManyToOne(() => User, (user) => user.debts)
  @JoinColumn({ name: "userId" })
  user!: User
}
