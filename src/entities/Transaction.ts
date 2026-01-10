import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"
import { Currency, TransactionCategory, TransactionType } from "../types"

@Entity("transactions")
export class Transaction {
  @PrimaryColumn()
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
  currency: Currency

  @Column({ type: "text" })
  type: TransactionType

  @Column({ type: "text", nullable: true })
  category: TransactionCategory

  @Column({ nullable: true })
  description?: string

  @Column({ nullable: true })
  fromAccountId?: string

  @Column({ nullable: true })
  toAccountId?: string

  // Relations
  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: "userId" })
  user!: User
}
