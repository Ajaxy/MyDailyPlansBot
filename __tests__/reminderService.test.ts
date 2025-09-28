// import { DataSource } from 'typeorm';
import { ReminderService } from '../src/services/ReminderService';
import { ReminderState } from '../src/entities';

// Mock the AppDataSource
jest.mock('../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('ReminderService', () => {
  let reminderService: ReminderService;
  let mockReminderStateRepository: any;
  let mockDataSource: any;

  beforeEach(() => {
    // Setup repository mock
    mockReminderStateRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn(() => mockReminderStateRepository),
    };

    // Mock the AppDataSource
    require('../src/config/database').AppDataSource = mockDataSource;

    reminderService = new ReminderService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateReminderState', () => {
    it('should return existing reminder state when found', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const existingState = new ReminderState(chatId, date, 2);

      mockReminderStateRepository.findOne.mockResolvedValue(existingState);

      const result = await reminderService.getOrCreateReminderState(chatId, date);

      expect(mockReminderStateRepository.findOne).toHaveBeenCalledWith({
        where: { id: `${chatId}_${date}` }
      });
      expect(result).toBe(existingState);
      expect(mockReminderStateRepository.save).not.toHaveBeenCalled();
    });

    it('should create new reminder state when not found', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const newState = new ReminderState(chatId, date);

      mockReminderStateRepository.findOne.mockResolvedValue(null);
      mockReminderStateRepository.save.mockResolvedValue(newState);

      const result = await reminderService.getOrCreateReminderState(chatId, date);

      expect(mockReminderStateRepository.findOne).toHaveBeenCalledWith({
        where: { id: `${chatId}_${date}` }
      });
      expect(mockReminderStateRepository.save).toHaveBeenCalled();
      expect(result).toBeInstanceOf(ReminderState);
    });
  });

  describe('incrementReminderCount', () => {
    it('should increment existing reminder count', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const existingState = new ReminderState(chatId, date, 1);

      mockReminderStateRepository.findOne.mockResolvedValue(existingState);
      mockReminderStateRepository.save.mockResolvedValue({
        ...existingState,
        reminderCount: 2
      });

      const result = await reminderService.incrementReminderCount(chatId, date);

      expect(existingState.reminderCount).toBe(2);
      expect(mockReminderStateRepository.save).toHaveBeenCalledWith(existingState);
      expect(result).toBe(2);
    });

    it('should create new state and increment when not exists', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const newState = new ReminderState(chatId, date);

      mockReminderStateRepository.findOne
        .mockResolvedValueOnce(null) // First call for getOrCreateReminderState
        .mockResolvedValueOnce(newState); // Second call after save
      
      mockReminderStateRepository.save
        .mockResolvedValueOnce(newState) // Save new state
        .mockResolvedValueOnce({ ...newState, reminderCount: 1 }); // Save incremented state

      const result = await reminderService.incrementReminderCount(chatId, date);

      expect(mockReminderStateRepository.save).toHaveBeenCalledTimes(2);
      expect(result).toBe(1);
    });
  });

  describe('getReminderCount', () => {
    it('should return reminder count from existing state', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const existingState = new ReminderState(chatId, date, 3);

      mockReminderStateRepository.findOne.mockResolvedValue(existingState);

      const result = await reminderService.getReminderCount(chatId, date);

      expect(result).toBe(3);
    });

    it('should return 0 for new state', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const newState = new ReminderState(chatId, date);

      mockReminderStateRepository.findOne
        .mockResolvedValueOnce(null) // First call
        .mockResolvedValueOnce(newState); // After save

      mockReminderStateRepository.save.mockResolvedValue(newState);

      const result = await reminderService.getReminderCount(chatId, date);

      expect(result).toBe(0);
    });
  });

  describe('resetReminderState', () => {
    it('should delete reminder state', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockReminderStateRepository.delete.mockResolvedValue({ affected: 1 });

      await reminderService.resetReminderState(chatId, date);

      expect(mockReminderStateRepository.delete).toHaveBeenCalledWith({
        id: `${chatId}_${date}`
      });
    });
  });

  describe('getLastReminderTime', () => {
    it('should return last reminder time when state exists', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';
      const reminderTime = new Date('2023-12-15T09:00:00Z');
      const existingState = new ReminderState(chatId, date);
      existingState.lastReminderTime = reminderTime;

      mockReminderStateRepository.findOne.mockResolvedValue(existingState);

      const result = await reminderService.getLastReminderTime(chatId, date);

      expect(mockReminderStateRepository.findOne).toHaveBeenCalledWith({
        where: { id: `${chatId}_${date}` }
      });
      expect(result).toBe(reminderTime);
    });

    it('should return null when state does not exist', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockReminderStateRepository.findOne.mockResolvedValue(null);

      const result = await reminderService.getLastReminderTime(chatId, date);

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const chatId = -987654321;
      const date = '2023-12-15';

      mockReminderStateRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(reminderService.getReminderCount(chatId, date)).rejects.toThrow('Database error');
    });
  });
}); 