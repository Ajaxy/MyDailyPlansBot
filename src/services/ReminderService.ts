import type { DataSource, Repository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { logger } from '../util/logger';
import { ReminderState } from '../entities';

export class ReminderService {
  private reminderStateRepository: Repository<ReminderState>;
  private dataSource: DataSource;

  constructor() {
    this.dataSource = AppDataSource;
    this.reminderStateRepository = this.dataSource.getRepository(ReminderState);
  }

  /**
   * Get or create reminder state for a chat and date
   */
  public async getOrCreateReminderState(chatId: number, date: string): Promise<ReminderState> {
    try {
      const stateId = this.getStateId(chatId, date);

      let reminderState = await this.reminderStateRepository.findOne({
        where: { id: stateId },
      });

      if (!reminderState) {
        reminderState = new ReminderState(chatId, date);
        reminderState = await this.reminderStateRepository.save(reminderState);
      }

      return reminderState;
    } catch (error) {
      logger.error('Error getting or creating reminder state:', error);
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
      logger.error('Error incrementing reminder count:', error);
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
      logger.error('Error getting reminder count:', error);
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
      logger.error('Error resetting reminder state:', error);
      throw error;
    }
  }

  /**
   * Get last reminder time for a chat and date
   */
  public async getLastReminderTime(chatId: number, date: string): Promise<Date | undefined> {
    try {
      const reminderState = await this.reminderStateRepository.findOne({
        where: { id: this.getStateId(chatId, date) },
      });

      return reminderState?.lastReminderTime || undefined;
    } catch (error) {
      logger.error('Error getting last reminder time:', error);
      throw error;
    }
  }

  private getStateId(chatId: number, date: string): string {
    return `${chatId}_${date}`;
  }
}
