import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from './User';

@Entity('offs')
@Index(['userId', 'chatId'])
@Index(['from', 'to'])
export class Off {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'bigint', name: 'chat_id' })
  chatId!: number;

  @Column({ type: 'date', name: 'from' })
  from!: Date;

  @Column({ type: 'date', name: 'to' })
  to!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  constructor(
    userId?: number,
    chatId?: number,
    from?: Date,
    to?: Date,
  ) {
    if (userId !== undefined) {
      this.userId = userId;
    }
    if (chatId !== undefined) {
      this.chatId = chatId;
    }
    if (from !== undefined) {
      this.from = from;
    }
    if (to !== undefined) {
      this.to = to;
    }
  }
}
