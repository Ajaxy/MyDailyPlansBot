import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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

  @Column({ type: 'varchar', length: 255, name: 'github_username', nullable: true })
  githubUsername?: string;

  @Column({ type: 'varchar', length: 255, name: 'notion_username', nullable: true })
  notionUsername?: string;

  constructor(
    telegramId?: number,
    chatId?: number,
    username?: string,
    isActive?: boolean,
    githubUsername?: string,
    notionUsername?: string,
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
    if (githubUsername !== undefined) {
      this.githubUsername = githubUsername;
    }
    if (notionUsername !== undefined) {
      this.notionUsername = notionUsername;
    }
  }
} 