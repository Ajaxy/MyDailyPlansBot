import { AppDataSource } from '../config/database';
import { Off } from '../entities';
import { Repository } from 'typeorm';

export class OffService {
  private offRepository: Repository<Off>;

  constructor() {
    this.offRepository = AppDataSource.getRepository(Off);
  }

  /**
   * Create a new off record
   */
  async createOff(userId: number, chatId: number, from: Date, to: Date): Promise<Off> {
    const off = this.offRepository.create({
      userId,
      chatId,
      from,
      to,
    });
    return await this.offRepository.save(off);
  }

  /**
   * Check if a user has an active off record for today in a specific chat
   */
  async hasActiveOff(userId: number, chatId: number, date?: Date): Promise<boolean> {
    const checkDate = date || new Date();
    checkDate.setHours(0, 0, 0, 0);

    const count = await this.offRepository.createQueryBuilder('off')
      .where('off.userId = :userId', { userId })
      .andWhere('off.chatId = :chatId', { chatId })
      .andWhere('off.from <= :date', { date: checkDate })
      .andWhere('off.to >= :date', { date: checkDate })
      .getCount();

    return count > 0;
  }

  /**
   * Get all active off records for a specific date and chat
   */
  async getActiveOffsForChat(chatId: number, date?: Date): Promise<Off[]> {
    const checkDate = date || new Date();
    checkDate.setHours(0, 0, 0, 0);

    return await this.offRepository.createQueryBuilder('off')
      .where('off.chatId = :chatId', { chatId })
      .andWhere('off.from <= :date', { date: checkDate })
      .andWhere('off.to >= :date', { date: checkDate })
      .getMany();
  }

  /**
   * Get all off records for a user in a chat
   */
  async getUserOffs(userId: number, chatId: number): Promise<Off[]> {
    return await this.offRepository.find({
      where: { userId, chatId },
      order: { from: 'DESC' },
    });
  }

  /**
   * Delete an off record
   */
  async deleteOff(id: number): Promise<void> {
    await this.offRepository.delete(id);
  }

  /**
   * Check if users have active off records for today
   */
  async filterUsersWithActiveOff(userIds: number[], chatId: number, date?: Date): Promise<number[]> {
    if (userIds.length === 0) {
      return [];
    }

    const checkDate = date || new Date();
    checkDate.setHours(0, 0, 0, 0);

    const offs = await this.offRepository.createQueryBuilder('off')
      .where('off.userId IN (:...userIds)', { userIds })
      .andWhere('off.chatId = :chatId', { chatId })
      .andWhere('off.from <= :date', { date: checkDate })
      .andWhere('off.to >= :date', { date: checkDate })
      .getMany();

    return offs.map(off => off.userId);
  }
}
