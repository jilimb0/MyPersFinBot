import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm"
import { User } from "./User"

@Entity("reminders")
export class Reminder {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column({ type: "text" })
  type!: "DEBT" | "GOAL" | "INCOME" | "RECURRING_TX"

  @Column()
  entityId!: string

  @Column("datetime")
  @Index()
  reminderDate!: Date

  @Column({ type: "text" })
  message!: string

  @Column({ type: "boolean", default: false })
  @Index()
  isProcessed!: boolean

  @Column("datetime")
  createdAt!: Date

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User
}
