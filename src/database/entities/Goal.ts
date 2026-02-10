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

@Entity("goals")
@Index(["userId", "status"])
export class Goal {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column()
  name!: string

  @Column("real")
  targetAmount!: number

  @Column("real", { default: 0 })
  currentAmount!: number

  @Column({ type: "text" })
  currency!: Currency

  @Column({ type: "text", default: "ACTIVE" })
  status!: "ACTIVE" | "COMPLETED" | "PAUSED"

  @Column({ type: "datetime", nullable: true })
  deadline?: Date

  @Column({ type: "simple-json", nullable: true })
  autoDeposit?: {
    enabled: boolean
    amount: number
    accountId: string
    frequency: "WEEKLY" | "MONTHLY"
    dayOfMonth?: number
    dayOfWeek?: number
  }

  // Relations
  @ManyToOne(
    () => User,
    (user) => user.goals
  )
  @JoinColumn({ name: "userId" })
  user!: User
}
