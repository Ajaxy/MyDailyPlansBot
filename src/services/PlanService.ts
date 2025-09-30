import type { DataSource, Repository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { logger } from '../util/logger';
import { Plan } from '../entities';

export class PlanService {
  private planRepository: Repository<Plan>;
  private dataSource: DataSource;

  constructor() {
    this.dataSource = AppDataSource;
    this.planRepository = this.dataSource.getRepository(Plan);
  }

  /**
   * Insert a new plan for a user (allows multiple plans per day)
   */
  public async insertPlan(
    userTelegramId: number,
    chatId: number,
    date: string,
    messageId: number,
    messageText: string,
  ): Promise<Plan> {
    try {
      const plan = new Plan(userTelegramId, chatId, date, messageId, messageText);
      return await this.planRepository.save(plan);
    } catch (error) {
      logger.error('Error inserting plan:', error);
      throw error;
    }
  }

  /**
   * Get all user IDs who have replied for a specific chat and date
   */
  public async getRepliedUserIds(chatId: number, date: string): Promise<number[]> {
    try {
      const plans = await this.planRepository.find({
        where: {
          chatId,
          date,
        },
        select: ['userTelegramId'],
      });

      // Return unique user IDs since users can have multiple plans per day
      const uniqueUserIds = [...new Set(plans.map((plan) => plan.userTelegramId))];
      return uniqueUserIds;
    } catch (error) {
      logger.error('Error getting replied user IDs:', error);
      throw error;
    }
  }

  /**
   * Check if a specific user has replied for a chat and date
   */
  public async hasUserReplied(chatId: number, date: string, userTelegramId: number): Promise<boolean> {
    try {
      const plan = await this.planRepository.findOne({
        where: {
          userTelegramId,
          chatId,
          date,
        },
      });

      return Boolean(plan);
    } catch (error) {
      logger.error('Error checking if user replied:', error);
      throw error;
    }
  }

  /**
   * Get user IDs who haven't replied yet for a specific chat and date
   */
  public async getUnrepliedUserIds(chatId: number, date: string, trackedUserIds: number[]): Promise<number[]> {
    try {
      const repliedUserIds = await this.getRepliedUserIds(chatId, date);
      return trackedUserIds.filter((userId) => !repliedUserIds.includes(userId));
    } catch (error) {
      logger.error('Error getting unreplied user IDs:', error);
      throw error;
    }
  }

  /**
   * Get all plans for a specific chat and date
   */
  public async getPlansForChatAndDate(chatId: number, date: string): Promise<Plan[]> {
    try {
      return await this.planRepository.find({
        where: {
          chatId,
          date,
        },
        order: {
          createdAt: 'ASC',
        },
      });
    } catch (error) {
      logger.error('Error getting plans for chat and date:', error);
      throw error;
    }
  }

  /**
   * Get plan count for a specific chat and date
   */
  public async getPlanCount(chatId: number, date: string): Promise<number> {
    try {
      return await this.planRepository.count({
        where: {
          chatId,
          date,
        },
      });
    } catch (error) {
      logger.error('Error getting plan count:', error);
      throw error;
    }
  }

  /**
   * Get a specific plan
   */
  public async getPlan(userTelegramId: number, chatId: number, date: string): Promise<Plan | null> {
    try {
      return await this.planRepository.findOne({
        where: {
          userTelegramId,
          chatId,
          date,
        },
      });
    } catch (error) {
      logger.error('Error getting plan:', error);
      throw error;
    }
  }

  /**
   * Remove all plans for a specific chat and date (for cleanup/testing)
   */
  public async removeAllPlansForDate(chatId: number, date: string): Promise<void> {
    try {
      await this.planRepository.delete({
        chatId,
        date,
      });
    } catch (error) {
      logger.error('Error removing plans for date:', error);
      throw error;
    }
  }
}
