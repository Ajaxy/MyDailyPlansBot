import { Entity, Column, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('reminder_states')
@Index(['chatId', 'date'], { unique: true }) // Unique constraint: one reminder state per chat per date
export class ReminderState {
  @PrimaryColumn({ type: 'varchar', length: 50, name: 'id' }) // Format: "{chatId}_{date}"
  id!: string;

  @Column({ type: 'bigint', name: 'chat_id' })
  chatId!: number;

  @Column({ type: 'varchar', length: 10, name: 'date' }) // YYYY-MM-DD format
  date!: string;

  @Column({ type: 'int', name: 'reminder_count', default: 0 })
  reminderCount: number = 0;

  @UpdateDateColumn({ name: 'last_reminder_time' })
  lastReminderTime!: Date;

  constructor(
    chatId?: number,
    date?: string,
    reminderCount?: number
  ) {
    if (chatId !== undefined && date !== undefined) {
      this.id = `${chatId}_${date}`;
      this.chatId = chatId;
      this.date = date;
    }
    if (reminderCount !== undefined) {
      this.reminderCount = reminderCount;
    }
  }
} 