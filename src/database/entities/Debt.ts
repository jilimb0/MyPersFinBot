import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"
import { Currency } from "../../types"

@Entity("debts")
export class Debt {
  @PrimaryColumn()
  id!: string

  @Column()
  @Index()
  userId!: string

  @Column()
  name!: string

  @Column("real")
  amount!: number

  @Column({ type: "text" })
  currency: Currency

  @Column()
  counterparty!: string

  @Column({ type: "text" })
  type: "OWES_ME" | "I_OWE"

  @Column("real", { default: 0 })
  paidAmount!: number

  @Column("boolean", { default: false })
  isPaid!: boolean

  @Column({ nullable: true })
  description?: string

  // Relations
  @ManyToOne(() => User, (user) => user.debts)
  @JoinColumn({ name: "userId" })
  user!: User
}
