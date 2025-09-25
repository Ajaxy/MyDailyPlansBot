import type { DataSource, Repository as TypeOrmRepository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { logger } from '../util/logger';
import { Repository } from '../entities';

export class RepositoryService {
  private repositoryRepository: TypeOrmRepository<Repository>;
  private dataSource: DataSource;

  constructor() {
    this.dataSource = AppDataSource;
    this.repositoryRepository = this.dataSource.getRepository(Repository);
  }

  public async getActiveRepositoriesForChat(chatId: number): Promise<Repository[]> {
    try {
      const repositories = await this.repositoryRepository.find({
        where: { chatId, isActive: true },
        order: { fullName: 'ASC' },
      });

      return repositories;
    } catch (error) {
      logger.error(`Error fetching active repositories for chat ${chatId}:`, error);
      return [];
    }
  }

  /**
   * Add a new repository for a chat
   */
  public async addRepository(fullName: string, chatId: number): Promise<Repository> {
    try {
      const repository = new Repository(chatId, fullName, true);
      return await this.repositoryRepository.save(repository);
    } catch (error) {
      logger.error('Error adding repository:', error);
      throw error;
    }
  }

  /**
   * Toggle repository active status
   */
  public async toggleRepository(fullName: string, chatId: number, isActive: boolean): Promise<void> {
    try {
      await this.repositoryRepository.update({ fullName, chatId }, { isActive });
    } catch (error) {
      logger.error('Error toggling repository status:', error);
      throw error;
    }
  }

  /**
   * Toggle repository active status by ID
   */
  public async toggleRepositoryById(id: number, isActive: boolean): Promise<void> {
    try {
      await this.repositoryRepository.update({ id }, { isActive });
    } catch (error) {
      logger.error('Error toggling repository status:', error);
      throw error;
    }
  }
}
