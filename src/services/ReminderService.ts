import { Repository, DataSource } from 'typeorm';
import { ReminderState } from '../entities';
import { AppDataSource } from '../config/database';

export class ReminderService {
  private reminderStateRepository: Repository<ReminderState>;
  private dataSource: DataSource;

  constructor() {
    this.dataSource = AppDataSource;
    this.reminderStateRepository = this.dataSource.getRepository(ReminderState);
  }

  private getStateId(chatId: number, date: string): string {
    return `${chatId}_${date}`;
  }

  /**
   * Get or create reminder state for a chat and date
   */
  public async getOrCreateReminderState(chatId: number, date: string): Promise<ReminderState> {
    try {
      const stateId = this.getStateId(chatId, date);
      
      let reminderState = await this.reminderStateRepository.findOne({
        where: { id: stateId }
      });

      if (!reminderState) {
        reminderState = new ReminderState(chatId, date);
        reminderState = await this.reminderStateRepository.save(reminderState);
      }

      return reminderState;
    } catch (error) {
      console.error('Error getting or creating reminder state:', error);
      throw error;
    }
  }

  /**
   * Increment reminder count for a chat and date
   */
  public async incrementReminderCount(chatId: number, date: string): Promise<number> {
    try {
      const reminderState = await this.getOrCreateReminderState(chatId, date);
      reminderState.reminderCount += 1;
      
      const updatedState = await this.reminderStateRepository.save(reminderState);
      return updatedState.reminderCount;
    } catch (error) {
      console.error('Error incrementing reminder count:', error);
      throw error;
    }
  }

  /**
   * Get reminder count for a chat and date
   */
  public async getReminderCount(chatId: number, date: string): Promise<number> {
    try {
      const reminderState = await this.getOrCreateReminderState(chatId, date);
      return reminderState.reminderCount;
    } catch (error) {
      console.error('Error getting reminder count:', error);
      throw error;
    }
  }

  /**
   * Reset reminder state for a chat and date (for new day)
   */
  public async resetReminderState(chatId: number, date: string): Promise<void> {
    try {
      const stateId = this.getStateId(chatId, date);
      await this.reminderStateRepository.delete({ id: stateId });
    } catch (error) {
      console.error('Error resetting reminder state:', error);
      throw error;
    }
  }

  /**
   * Get last reminder time for a chat and date
   */
  public async getLastReminderTime(chatId: number, date: string): Promise<Date | null> {
    try {
      const reminderState = await this.reminderStateRepository.findOne({
        where: { id: this.getStateId(chatId, date) }
      });

      return reminderState?.lastReminderTime || null;
    } catch (error) {
      console.error('Error getting last reminder time:', error);
      throw error;
    }
  }
} 