import type { Repository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { Off, User } from '../entities';

export class UserService {
  private userRepository: Repository<User>;
  private offRepository: Repository<Off>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.offRepository = AppDataSource.getRepository(Off);
  }

  /**
   * Get all active users for a specific chat (excluding those who are off today)
   */
  async getActiveUsersForChat(chatId: number): Promise<User[]> {
    const activeUsers = await this.userRepository.find({
      where: {
        chatId,
        isActive: true,
      },
    });

    // Filter out users who are off today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeUsersNotOff: User[] = [];

    for (const user of activeUsers) {
      const isOff = await this.isUserOffOnDate(user.id, chatId, today);

      if (!isOff) {
        activeUsersNotOff.push(user);
      }
    }

    return activeUsersNotOff;
  }

  /**
   * Get all unique active chat IDs
   */
  async getActiveChatIds(): Promise<number[]> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('DISTINCT user.chatId', 'chatId')
      .where('user.isActive = :isActive', { isActive: true })
      .getRawMany();

    return result.map((row) => parseInt(row.chatId, 10));
  }

  /**
   * Get tracked user IDs for a specific chat
   */
  async getTrackedUserIdsForChat(chatId: number): Promise<number[]> {
    const users = await this.getActiveUsersForChat(chatId);
    return users.map((user) => user.telegramId);
  }

  /**
   * Add or update a user
   */
  async upsertUser(telegramId: number, chatId: number, username: string): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { telegramId, chatId },
    });

    if (user) {
      // Update existing user
      user.username = username;
      user.isActive = true; // Reactivate if was inactive
    } else {
      // Create new user
      user = new User(telegramId, chatId, username, true);
    }

    return this.userRepository.save(user);
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivateUser(telegramId: number, chatId: number): Promise<void> {
    await this.userRepository.update(
      { telegramId, chatId },
      { isActive: false },
    );
  }

  /**
   * Get a specific user
   */
  async getUser(telegramId: number, chatId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { telegramId, chatId },
    });
  }

  /**
   * Check if a user exists and is active (not deactivated and not off today)
   */
  async isUserActiveInChat(telegramId: number, chatId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { telegramId, chatId, isActive: true },
    });

    if (!user) {
      return false;
    }

    // Check if user is off today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isOff = await this.isUserOffOnDate(user.id, chatId, today);

    return !isOff;
  }

  /**
   * Get all users (for admin purposes)
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }

  /**
   * Get a user by username and chat ID
   */
  async getUserByUsernameAndChat(username: string, chatId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username, chatId },
    });
  }

  /**
   * Check if a user is off on a specific date
   */
  private async isUserOffOnDate(userId: number, chatId: number, date: Date): Promise<boolean> {
    const offCount = await this.offRepository.createQueryBuilder('off')
      .where('off.userId = :userId', { userId })
      .andWhere('off.chatId = :chatId', { chatId })
      .andWhere('off.from <= :date', { date })
      .andWhere('off.to >= :date', { date })
      .getCount();

    return offCount > 0;
  }
}
