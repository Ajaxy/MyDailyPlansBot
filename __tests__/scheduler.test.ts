import { SchedulerService } from '../src/bot/services/scheduler';
import { StateManager } from '../src/bot/services/stateManager';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

// Mock the grammy Bot class
const mockBot = {
  api: {
    sendMessage: jest.fn(),
    getChatMember: jest.fn(),
  },
};

describe('SchedulerService', () => {
  let scheduler: SchedulerService;
  let stateManager: StateManager;
  let mockSchedule: jest.Mock;
  const trackedUserIds = [123456789, 987654321];

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked schedule function
    const cron = require('node-cron');
    mockSchedule = cron.schedule;
    
    stateManager = new StateManager();
    scheduler = new SchedulerService(mockBot as any, stateManager, trackedUserIds);
  });

  describe('initialization', () => {
    it('should initialize with empty active chats', () => {
      expect(scheduler.getActiveChats().size).toBe(0);
    });
  });

  describe('chat management', () => {
    it('should add chat to active chats', () => {
      const chatId = -123456789;
      scheduler.addChat(chatId);
      
      expect(scheduler.getActiveChats().has(chatId)).toBe(true);
    });

    it('should remove chat from active chats', () => {
      const chatId = -123456789;
      scheduler.addChat(chatId);
      scheduler.removeChat(chatId);
      
      expect(scheduler.getActiveChats().has(chatId)).toBe(false);
    });

    it('should handle multiple chats', () => {
      const chat1 = -123456789;
      const chat2 = -987654321;
      
      scheduler.addChat(chat1);
      scheduler.addChat(chat2);
      
      expect(scheduler.getActiveChats().size).toBe(2);
      expect(scheduler.getActiveChats().has(chat1)).toBe(true);
      expect(scheduler.getActiveChats().has(chat2)).toBe(true);
    });
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
      scheduler.addChat(chatId);
      scheduler.start();

      // Get the initial reminder function
      const initialReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 6 * * 1-5'
      );
      const initialReminderFunc = initialReminderCall![1];

      await initialReminderFunc();

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        chatId,
        '🌅 Good morning, team! Please share your daily plans for today.'
      );

      // Verify reminder count was incremented
      const today = '2023-12-15';
      expect(stateManager.getReminderCount(chatId, today)).toBe(1);
    });

    it('should not send follow-up reminder if everyone has replied', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      
      scheduler.addChat(chatId);
      
      // Mark all users as replied
      trackedUserIds.forEach(userId => {
        stateManager.markUserReplied(chatId, today, userId);
      });
      
      // Set up some reminder count
      stateManager.incrementReminderCount(chatId, today);
      
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
      
      scheduler.addChat(chatId);
      
      // Mark only one user as replied
      stateManager.markUserReplied(chatId, today, 123456789);
      stateManager.incrementReminderCount(chatId, today); // 1 reminder already sent
      
      // Mock getChatMember to return user info
      mockBot.api.getChatMember.mockResolvedValueOnce({
        user: {
          id: 987654321,
          first_name: 'Jane',
          last_name: 'Doe',
          username: 'jane_doe',
        },
      });
      
      scheduler.start();

      // Get the follow-up reminder function
      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      expect(mockBot.api.getChatMember).toHaveBeenCalledWith(chatId, 987654321);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        chatId,
        '⏰ Friendly reminder: @jane_doe, please don\'t forget to share your daily plans!'
      );

      // Verify reminder count was incremented
      expect(stateManager.getReminderCount(chatId, today)).toBe(2);
    });

    it('should handle user mention when no username available', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      
      scheduler.addChat(chatId);
      
      // Mark only one user as replied
      stateManager.markUserReplied(chatId, today, 123456789);
      stateManager.incrementReminderCount(chatId, today);
      
      // Mock getChatMember to return user without username
      mockBot.api.getChatMember.mockResolvedValueOnce({
        user: {
          id: 987654321,
          first_name: 'Jane',
          last_name: 'Doe',
          // no username
        },
      });
      
      scheduler.start();

      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        chatId,
        '⏰ Friendly reminder: [Jane Doe](tg://user?id=987654321), please don\'t forget to share your daily plans!'
      );
    });

    it('should not send more than 4 reminders per day', async () => {
      const chatId = -123456789;
      const today = '2023-12-15';
      
      scheduler.addChat(chatId);
      
      // Set reminder count to maximum
      stateManager.incrementReminderCount(chatId, today);
      stateManager.incrementReminderCount(chatId, today);
      stateManager.incrementReminderCount(chatId, today);
      stateManager.incrementReminderCount(chatId, today); // 4 reminders sent
      
      scheduler.start();

      const followUpReminderCall = mockSchedule.mock.calls.find(
        (call: any[]) => call[0] === '0 9,12,15 * * 1-5'
      );
      const followUpReminderFunc = followUpReminderCall![1];

      await followUpReminderFunc();

      // Should not send another reminder
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully when sending messages', async () => {
      const chatId = -123456789;
      scheduler.addChat(chatId);
      
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
      
      scheduler.addChat(chat1);
      scheduler.addChat(chat2);
      
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
  });

  describe('getActiveChats', () => {
    it('should return copy of active chats set', () => {
      const chatId = -123456789;
      scheduler.addChat(chatId);
      
      const activeChats = scheduler.getActiveChats();
      expect(activeChats.has(chatId)).toBe(true);
      
      // Verify it's a copy
      activeChats.delete(chatId);
      expect(scheduler.getActiveChats().has(chatId)).toBe(true);
    });
  });
}); 