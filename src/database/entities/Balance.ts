import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm"
import type { Currency } from "../../types"
import { User } from "./User"

@Entity("balances")
@Index(["userId", "accountId", "currency"], { unique: true })
export class Balance {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column()
  accountId!: string

  @Column("real")
  amount!: number

  @Column({ type: "text" })
  currency!: Currency

  @UpdateDateColumn()
  lastUpdated!: Date

  // Relations
  @ManyToOne(
    () => User,
    (user) => user.balances
  )
  @JoinColumn({ name: "userId" })
  user!: User
}
