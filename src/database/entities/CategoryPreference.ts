import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm"
import { User } from "./User"

@Entity("category_preferences")
@Index(["userId", "category"], { unique: true })
export class CategoryPreference {
  @PrimaryGeneratedColumn("uuid")
  userId!: string

  @PrimaryGeneratedColumn("uuid")
  category!: string

  @Column()
  preferredAccountId!: string

  @Column({ type: "int", default: 0 })
  useCount!: number

  @UpdateDateColumn()
  lastUsed!: Date

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User
}
