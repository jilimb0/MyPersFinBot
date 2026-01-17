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

@Entity("income_sources")
export class IncomeSource {
  @PrimaryGeneratedColumn()
  id!: number

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

  // Relations
  @ManyToOne(() => User, (user) => user.incomeSources)
  @JoinColumn({ name: "userId" })
  user!: User
}
