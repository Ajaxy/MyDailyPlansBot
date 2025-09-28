// import { DataSource } from 'typeorm';
import { PlanService } from '../src/services/PlanService';
import { Plan } from '../src/entities';

// Mock the AppDataSource
jest.mock('../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('PlanService', () => {
  let planService: PlanService;
  let mockPlanRepository: any;
  let mockDataSource: any;

  beforeEach(() => {
    // Setup repository mock
    mockPlanRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn(() => mockPlanRepository),
    };

    // Mock the AppDataSource
    require('../src/config/database').AppDataSource = mockDataSource;

    planService = new PlanService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('insertPlan', () => {
    it('should insert new plan', async () => {
      const userTelegramId = 123456789;
      const chatId = -987654321;
      const date = '2023-12-15';
      const messageId = 123;
      const messageText = 'My daily plan';

      mockPlanRepository.save.mockResolvedValue(new Plan(userTelegramId, chatId, date, messageId, messageText));

      const result = await planService.insertPlan(userTelegramId, chatId, date, messageId, messageText);

      expect(mockPlanRepository.save).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Plan);
    });

    it('should allow multiple plans for same user on same date', async () => {
      const userTelegramId = 123456789;
      const chatId = -987654321;
      const date = '2023-12-15';

      const plan1 = new Plan(userTelegramId, chatId, date, 123, 'First plan');
      const plan2 = new Plan(userTelegramId, chatId, date, 456, 'Second plan');

      mockPlanRepository.save
        .mockResolvedValueOnce(plan1)
        .mockResolvedValueOnce(plan2);

      const result1 = await planService.insertPlan(userTelegramId, chatId, date, 123, 'First plan');
      const result2 = await planService.insertPlan(userTelegramId, chatId, date, 456, 'Second plan');

      expect(mockPlanRepository.save).toHaveBeenCalledTimes(2);
      expect(result1).toBeInstanceOf(Plan);
      expect(result2).toBeInstanceOf(Plan);
    });
  });

  describe('getRepliedUserIds', () => {
    it('should return array of user IDs who replied', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const mockPlans = [
        { userTelegramId: 123456789 },
        { userTelegramId: 987654321 },
      ];

      mockPlanRepository.find.mockResolvedValue(mockPlans);

      const result = await planService.getRepliedUserIds(chatId, date);

      expect(mockPlanRepository.find).toHaveBeenCalledWith({
        where: { chatId, date },
        select: ['userTelegramId']
      });
      expect(result).toEqual([123456789, 987654321]);
    });

    it('should return empty array when no plans exist', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockPlanRepository.find.mockResolvedValue([]);

      const result = await planService.getRepliedUserIds(chatId, date);

      expect(result).toEqual([]);
    });
  });

  describe('hasUserReplied', () => {
    it('should return true when user has replied', async () => {
      const userTelegramId = 123456789;
      const chatId = -987654321;
      const date = '2023-12-15';

      mockPlanRepository.findOne.mockResolvedValue(new Plan());

      const result = await planService.hasUserReplied(chatId, date, userTelegramId);

      expect(mockPlanRepository.findOne).toHaveBeenCalledWith({
        where: { userTelegramId, chatId, date }
      });
      expect(result).toBe(true);
    });

    it('should return false when user has not replied', async () => {
      const userTelegramId = 123456789;
      const chatId = -987654321;
      const date = '2023-12-15';

      mockPlanRepository.findOne.mockResolvedValue(null);

      const result = await planService.hasUserReplied(chatId, date, userTelegramId);

      expect(result).toBe(false);
    });
  });

  describe('getUnrepliedUserIds', () => {
    it('should return all tracked users when no one has replied', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];

      mockPlanRepository.find.mockResolvedValue([]);

      const result = await planService.getUnrepliedUserIds(chatId, date, trackedUserIds);

      expect(result).toEqual(trackedUserIds);
    });

    it('should return only users who have not replied', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const trackedUserIds = [123456789, 987654321, 111222333];
      const repliedUsers = [{ userTelegramId: 123456789 }];

      mockPlanRepository.find.mockResolvedValue(repliedUsers);

      const result = await planService.getUnrepliedUserIds(chatId, date, trackedUserIds);

      expect(result).toEqual([987654321, 111222333]);
    });

    it('should return empty array when all users have replied', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      const repliedUsers = [
        { userTelegramId: 123456789 },
        { userTelegramId: 987654321 },
      ];

      mockPlanRepository.find.mockResolvedValue(repliedUsers);

      const result = await planService.getUnrepliedUserIds(chatId, date, trackedUserIds);

      expect(result).toEqual([]);
    });
  });

  describe('getPlanCount', () => {
    it('should return count of plans for chat and date', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockPlanRepository.count.mockResolvedValue(3);

      const result = await planService.getPlanCount(chatId, date);

      expect(mockPlanRepository.count).toHaveBeenCalledWith({
        where: { chatId, date }
      });
      expect(result).toBe(3);
    });
  });

  describe('removeAllPlansForDate', () => {
    it('should remove all plans for specific chat and date', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockPlanRepository.delete.mockResolvedValue({ affected: 2 });

      await planService.removeAllPlansForDate(chatId, date);

      expect(mockPlanRepository.delete).toHaveBeenCalledWith({
        chatId,
        date
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockPlanRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(planService.getRepliedUserIds(chatId, date)).rejects.toThrow('Database error');
    });
  });
}); 