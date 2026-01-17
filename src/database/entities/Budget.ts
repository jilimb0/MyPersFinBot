import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm"

export enum BudgetPeriod {
  MONTHLY = "MONTHLY",
  WEEKLY = "WEEKLY",
  YEARLY = "YEARLY",
}

@Entity("budgets")
@Index(["userId", "category"])
export class Budget {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  userId!: string

  @Column()
  category!: string

  @Column("decimal")
  amount!: number

  @Column({
    type: "varchar",
    length: 20,
    default: "MONTHLY",
    comment: "MONTHLY|WEEKLY|YEARLY",
  })
  period!: BudgetPeriod

  @Column({ default: "USD" })
  currency!: string

  @CreateDateColumn()
  createdAt!: Date

  @CreateDateColumn()
  updatedAt!: Date
}
