import {
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm"
import { resolveDbType } from "@ocular/utils"

/**
 * Base abstract entity for all entities
 */
export abstract class BaseEntity {
  @PrimaryColumn()
  id: string

  @CreateDateColumn({ type: resolveDbType("timestamptz") })
  created_at: Date

  @UpdateDateColumn({ type: resolveDbType("timestamptz") })
  updated_at: Date
}
