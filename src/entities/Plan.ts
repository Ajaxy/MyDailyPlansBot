import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plans')
@Index(['chatId', 'date']) // Index for querying plans by chat and date
@Index(['userTelegramId', 'chatId', 'date']) // Index for faster queries (but not unique)
export class Plan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'user_telegram_id' })
  userTelegramId!: number;

  @Column({ type: 'bigint', name: 'chat_id' })
  chatId!: number;

  @Column({ type: 'varchar', length: 10, name: 'date' }) // YYYY-MM-DD format
  date!: string;

  @Column({ type: 'bigint', name: 'message_id' })
  messageId!: number;

  @Column({ type: 'text', name: 'message_text' })
  messageText!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  constructor(
    userTelegramId?: number,
    chatId?: number,
    date?: string,
    messageId?: number,
    messageText?: string,
  ) {
    if (userTelegramId !== undefined) {
      this.userTelegramId = userTelegramId;
    }
    if (chatId !== undefined) {
      this.chatId = chatId;
    }
    if (date !== undefined) {
      this.date = date;
    }
    if (messageId !== undefined) {
      this.messageId = messageId;
    }
    if (messageText !== undefined) {
      this.messageText = messageText;
    }
  }
} 