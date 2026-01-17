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

@Entity("goals")
export class Goal {
  @PrimaryColumn()
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
  currency: Currency

  @Column({ type: "text", default: "ACTIVE" })
  status: "ACTIVE" | "COMPLETED" | "PAUSED"

  // Relations
  @ManyToOne(() => User, (user) => user.goals)
  @JoinColumn({ name: "userId" })
  user!: User
}
