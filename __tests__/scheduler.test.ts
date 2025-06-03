import { SchedulerService } from '../src/services/SchedulerService';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

// Mock UserService
const mockUserService = {
  getActiveChatIds: jest.fn(),
  getTrackedUserIdsForChat: jest.fn(),
  getActiveUsersForChat: jest.fn(),
};

jest.mock('../src/services/UserService', () => {
  return {
    UserService: jest.fn().mockImplementation(() => mockUserService),
  };
});

// Mock PlanService
const mockPlanService = {
  insertPlan: jest.fn(),
  getRepliedUserIds: jest.fn(),
  hasUserReplied: jest.fn(),
  getUnrepliedUserIds: jest.fn(),
  getPlanCount: jest.fn(),
  removeAllPlansForDate: jest.fn(),
};

jest.mock('../src/services/PlanService', () => {
  return {
    PlanService: jest.fn().mockImplementation(() => mockPlanService),
  };
});

// Mock ReminderService
const mockReminderService = {
  getReminderCount: jest.fn(),
  incrementReminderCount: jest.fn(),
  resetReminderState: jest.fn(),
  getLastReminderTime: jest.fn(),
};

jest.mock('../src/services/ReminderService', () => {
  return {
    ReminderService: jest.fn().mockImplementation(() => mockReminderService),
  };
});

// Mock the grammy Bot class
const mockBot = {
  api: {
    sendMessage: jest.fn(),
  },
};

describe('SchedulerService', () => {
  let scheduler: SchedulerService;
  let mockSchedule: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked schedule function
    const cron = require('node-cron');
    mockSchedule = cron.schedule;
    
    scheduler = new SchedulerService(mockBot as any, mockPlanService as any, mockReminderService as any, mockUserService as any);
  });

  describe('scheduler start', () => {
    it('should set up cron jobs', () => {
      scheduler.start();
      
      expect(mockSchedule).toHaveBeenCalledTimes(2);
      
      // Check initial reminder (6 AM on weekdays)
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 6 * * 1-5',
        expect.any(Function),
        { timezone: 'GMT' }
      );
      
      // Check follow-up reminders (9 AM, 12 PM, 3 PM on weekdays)
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 9,12,15 * * 1-5',
        expect.any(Function),
        { timezone: 'GMT' }
      );
    });
  });

  describe('reminder functionality', () => {
    beforeEach(() => {
      // Mock Date to return a consistent date for testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-12-15T10:00:00.000Z')); // Friday
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send initial reminder to active chats', async () => {
      const chatId = -123456789;
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(0);
      mockReminderService.incrementReminderCount.mockResolvedValue(1);
      
      scheduler.start();

      // Get the initial reminder function
      const initialReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 6 * * 1-5'
      );
      const initialReminderFunc = initialReminderCall![1];

      await initialReminderFunc();

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        chatId,
        '🌅 Всем доброе утро! Пожалуйста, поделитесь своими планами на день.'
      );

      // Verify reminder count was incremented
      const today = '2023-12-15';
      expect(mockReminderService.incrementReminderCount).toHaveBeenCalledWith(chatId, today);
    });

    it('should reset state for new day when reminder count is 0', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(0);
      mockReminderService.resetReminderState.mockResolvedValue();
      mockReminderService.incrementReminderCount.mockResolvedValue(1);
      
      scheduler.start();

      const initialReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 6 * * 1-5'
      );
      const initialReminderFunc = initialReminderCall![1];

      await initialReminderFunc();

      expect(mockReminderService.resetReminderState).toHaveBeenCalledWith(chatId, today);
    });

    it('should not send follow-up reminder if everyone has replied', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(1);
      mockUserService.getTrackedUserIdsForChat.mockResolvedValue(trackedUserIds);
      mockPlanService.getUnrepliedUserIds.mockResolvedValue([]); // Everyone replied
      
      scheduler.start();

      // Get the follow-up reminder function
      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      // Should not send message since everyone replied
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should send follow-up reminder with mentions for unreplied users', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      const unrepliedUserIds = [987654321];
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(1); // 1 reminder already sent
      mockUserService.getTrackedUserIdsForChat.mockResolvedValue(trackedUserIds);
      mockPlanService.getUnrepliedUserIds.mockResolvedValue(unrepliedUserIds);
      mockUserService.getActiveUsersForChat.mockResolvedValue([
        { telegramId: 987654321, username: 'jane_doe' },
      ]);
      mockReminderService.incrementReminderCount.mockResolvedValue(2);
      
      scheduler.start();

      // Get the follow-up reminder function
      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        chatId,
        '⏰ Дружеское напоминание: @jane_doe, пожалуйста, не забудьте поделиться своими планами на день!',
        { parse_mode: 'Markdown' }
      );

      // Verify reminder count was incremented
      expect(mockReminderService.incrementReminderCount).toHaveBeenCalledWith(chatId, today);
    });

    it('should handle user mention when user not found in database', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      const unrepliedUserIds = [987654321];
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(1);
      mockUserService.getTrackedUserIdsForChat.mockResolvedValue(trackedUserIds);
      mockPlanService.getUnrepliedUserIds.mockResolvedValue(unrepliedUserIds);
      mockUserService.getActiveUsersForChat.mockResolvedValue([]); // No users found
      mockReminderService.incrementReminderCount.mockResolvedValue(2);
      
      scheduler.start();

      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        chatId,
        '⏰ Дружеское напоминание: [Пользователь 987654321](tg://user?id=987654321), пожалуйста, не забудьте поделиться своими планами на день!',
        { parse_mode: 'Markdown' }
      );
    });

    it('should not send more than 4 reminders per day', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(4); // 4 reminders already sent
      
      scheduler.start();

      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      // Should not send another reminder
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      expect(mockUserService.getTrackedUserIdsForChat).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully when sending messages', async () => {
      const chatId = -123456789;
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chatId]);
      mockReminderService.getReminderCount.mockResolvedValue(0);
      
      // Mock sendMessage to throw an error
      mockBot.api.sendMessage.mockRejectedValueOnce(new Error('Network error'));
      
      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      scheduler.start();

      const initialReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 6 * * 1-5'
      );
      const initialReminderFunc = initialReminderCall![1];

      await initialReminderFunc();

      expect(consoleSpy).toHaveBeenCalledWith(
        `Error sending initial reminder to chat ${chatId}:`,
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle multiple active chats correctly', async () => {
      const chat1 = -123456789;
      const chat2 = -987654321;
      
      // Mock services
      mockUserService.getActiveChatIds.mockResolvedValue([chat1, chat2]);
      mockReminderService.getReminderCount.mockResolvedValue(0);
      mockReminderService.incrementReminderCount.mockResolvedValue(1);
      
      scheduler.start();

      const initialReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 6 * * 1-5'
      );
      const initialReminderFunc = initialReminderCall![1];

      await initialReminderFunc();

      // Should send messages to both chats
      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chat1, expect.any(String));
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chat2, expect.any(String));
    });

    it('should handle UserService errors gracefully', async () => {
      // Mock UserService to throw an error
      mockUserService.getActiveChatIds.mockRejectedValue(new Error('Database error'));
      
      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      scheduler.start();

      const initialReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 6 * * 1-5'
      );
      const initialReminderFunc = initialReminderCall![1];

      await initialReminderFunc();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error getting active chat IDs:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getActiveChatIds', () => {
    it('should return active chat IDs from UserService', async () => {
      const expectedChatIds = [-123456789, -987654321];
      mockUserService.getActiveChatIds.mockResolvedValue(expectedChatIds);
      
      const result = await scheduler.getActiveChatIds();
      
      expect(result).toEqual(expectedChatIds);
      expect(mockUserService.getActiveChatIds).toHaveBeenCalled();
    });
  });
}); 