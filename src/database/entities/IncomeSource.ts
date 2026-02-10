import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm"
import type { Currency } from "../../types"
import { User } from "./User"

@Entity("income_sources")
export class IncomeSource {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column()
  name!: string

  @Column("real", { nullable: true })
  expectedAmount?: number

  @Column({ type: "text", nullable: true })
  currency?: Currency

  @Column({ type: "text", nullable: true })
  frequency?: "MONTHLY" | "ONE_TIME"

  @Column({ type: "integer", nullable: true })
  expectedDate?: number

  @Column({ nullable: true })
  accountId?: string

  @Column({ type: "json", nullable: true })
  autoCreate?: {
    enabled: boolean
    amount: number
    accountId: string
    frequency: "MONTHLY"
    dayOfMonth: number
  }

  @Column({ type: "boolean", default: false })
  reminderEnabled?: boolean

  // Relations
  @ManyToOne(
    () => User,
    (user) => user.incomeSources
  )
  @JoinColumn({ name: "userId" })
  user!: User
}
