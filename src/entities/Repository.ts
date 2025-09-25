import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('repositories')
@Index(['chatId']) // Add index for chatId for better query performance
@Unique(['fullName', 'chatId']) // Ensure same repo can't be added twice to same chat
export class Repository {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'chat_id' })
  chatId!: number;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName!: string; // Format: "owner/repo"

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean = true;

  @Column({ type: 'text', name: 'gh_token', nullable: true })
  ghToken?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt!: Date;

  constructor(chatId?: number, fullName?: string, isActive?: boolean) {
    if (chatId !== undefined) {
      this.chatId = chatId;
    }
    if (fullName !== undefined) {
      this.fullName = fullName;
    }
    if (isActive !== undefined) {
      this.isActive = isActive;
    }
  }
}
