import { BeforeInsert, Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne } from "typeorm"
import { BaseEntity } from "@ocular-ai/types"
import { generateEntityId } from "../utils/generate-entity-id"
import { Organisation } from "./organisation"
import { DbAwareColumn } from "../../../utils/src/db-aware-column"
import { Team } from "./team"

/**
 * @enum
 * 
 * The user's role.
 */
export enum ComponentTypes {
  SERVICE = "service",
  APPLICATION = "application",
  UI = "ui",
}

@Entity()
export class Component extends BaseEntity {
  @DbAwareColumn({
    type: "enum",
    enum: ComponentTypes,
    nullable: true,
  })
  type: ComponentTypes


  /**
   * The name of the entity.
   */
  @Column({ type: "varchar", nullable: false })
  name: string

  @Column({ type: "varchar", nullable: true})
  description?: string

  @Column({ type: "varchar", nullable: true })
  organisation_id: string;


  @ManyToOne(() => Organisation, (organisation) => organisation.members)
  @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
  organisation: Organisation;

  @JoinTable({
    name: "team_component",
    joinColumn: {
      name: "component_id",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "team_id",
      referencedColumnName: "id",
    },
  })
  @ManyToMany(() => Team, (team) => team.components,{
    onDelete: "CASCADE"
  })
  teams: Team[];

  /**
  * @apiIgnore
  */
  @BeforeInsert()
  private beforeInsert(): void {
    this.id = generateEntityId(this.id, "comp")
  }
}