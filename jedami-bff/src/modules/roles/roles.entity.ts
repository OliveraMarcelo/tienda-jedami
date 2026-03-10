
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../users/users.entity.js";

@Entity('roles')
export class Role {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({ unique: true, length: 50, type: 'varchar' })
    name!: string;
    @ManyToMany(() => User, user => user.roles)
    users!: User[];
}