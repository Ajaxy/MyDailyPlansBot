import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities';

export class UserService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Get all active users for a specific chat
   */
  async getActiveUsersForChat(chatId: number): Promise<User[]> {
    return this.userRepository.find({
      where: {
        chatId,
        isActive: true,
      },
    });
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

    return result.map(row => parseInt(row.chatId, 10));
  }

  /**
   * Get tracked user IDs for a specific chat
   */
  async getTrackedUserIdsForChat(chatId: number): Promise<number[]> {
    const users = await this.getActiveUsersForChat(chatId);
    return users.map(user => user.telegramId);
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
   * Check if a user exists and is active
   */
  async isUserActiveInChat(telegramId: number, chatId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { telegramId, chatId, isActive: true },
    });
    return !!user;
  }

  /**
   * Get all users (for admin purposes)
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }
} 