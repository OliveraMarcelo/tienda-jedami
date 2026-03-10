import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../roles/roles.entity.js';

@Entity('users')
export class User{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true, length: 255, type: 'varchar' })
    email!: string;

    @Column({ name: 'password_hash',type: "text"
    })
    passwordHash!: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    // Relaciones con otros entities pueden ir aquí
    @ManyToMany(() => Role, role => role.users) 

    @JoinTable({
        name: 'user_roles',
        joinColumn: { name: 'user_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
    })
    roles!: Role[];
}