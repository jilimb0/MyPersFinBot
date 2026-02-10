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

@Entity("transactions")
@Index(["userId", "date"])
@Index(["userId", "type", "date"])
@Index(["userId", "category"])
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column("datetime")
  @Index()
  date!: Date

  @Column("real")
  amount!: number

  @Column({ type: "text" })
  currency!: Currency

  @Column({ type: "text" })
  type!: TransactionType

  @Column({ type: "text", nullable: true })
  category!: TransactionCategory

  @Column({ nullable: true })
  description?: string

  @Column({ nullable: true })
  fromAccountId?: string

  @Column({ nullable: true })
  toAccountId?: string

  // Relations
  @ManyToOne(
    () => User,
    (user) => user.transactions
  )
  @JoinColumn({ name: "userId" })
  user!: User
}
