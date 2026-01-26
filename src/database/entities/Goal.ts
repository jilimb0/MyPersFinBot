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
  @ManyToOne(() => User, (user) => user.goals)
  @JoinColumn({ name: "userId" })
  user!: User
}
