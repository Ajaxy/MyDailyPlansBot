import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('users')
@Index(['chatId']) // Add index for chatId for better query performance
export class User {
  @PrimaryColumn({ type: 'bigint', name: 'telegram_id' })
  telegramId!: number;

  @Column({ type: 'bigint', name: 'chat_id' })
  chatId!: number;

  @Column({ type: 'varchar', length: 255, name: 'username' })
  username!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean = true;

  constructor(
    telegramId?: number,
    chatId?: number,
    username?: string,
    isActive?: boolean
  ) {
    if (telegramId !== undefined) {
      this.telegramId = telegramId;
    }
    if (chatId !== undefined) {
      this.chatId = chatId;
    }
    if (username !== undefined) {
      this.username = username;
    }
    if (isActive !== undefined) {
      this.isActive = isActive;
    }
  }
} 