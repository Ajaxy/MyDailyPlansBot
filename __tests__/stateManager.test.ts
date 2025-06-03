import { StateManager } from '../src/services/stateManager';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('state initialization', () => {
    it('should create new state with empty replied users and zero reminder count', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      
      const state = stateManager.getState(chatId, date);
      
      expect(state.chatId).toBe(chatId);
      expect(state.date).toBe(date);
      expect(state.repliedUserIds.size).toBe(0);
      expect(state.reminderCount).toBe(0);
    });

    it('should return same state instance for same chat and date', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      
      const state1 = stateManager.getState(chatId, date);
      state1.repliedUserIds.add(123456789);
      
      const state2 = stateManager.getState(chatId, date);
      
      expect(state1).toBe(state2);
      expect(state2.repliedUserIds.has(123456789)).toBe(true);
    });
  });

  describe('markUserReplied', () => {
    it('should mark user as replied', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      const userId = 123456789;
      
      stateManager.markUserReplied(chatId, date, userId);
      
      expect(stateManager.getRepliedUserIds(chatId, date).has(userId)).toBe(true);
    });

    it('should handle multiple users replying', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      
      stateManager.markUserReplied(chatId, date, 123456789);
      stateManager.markUserReplied(chatId, date, 987654321);
      
      expect(stateManager.getRepliedUserIds(chatId, date).size).toBe(2);
    });
  });

  describe('incrementReminderCount', () => {
    it('should increment reminder count', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      
      expect(stateManager.getReminderCount(chatId, date)).toBe(0);
      
      stateManager.incrementReminderCount(chatId, date);
      expect(stateManager.getReminderCount(chatId, date)).toBe(1);
      
      stateManager.incrementReminderCount(chatId, date);
      expect(stateManager.getReminderCount(chatId, date)).toBe(2);
    });

    it('should set lastReminderTime', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      
      const beforeTime = new Date();
      stateManager.incrementReminderCount(chatId, date);
      const afterTime = new Date();
      
      const state = stateManager.getState(chatId, date);
      expect(state.lastReminderTime).toBeDefined();
      expect(state.lastReminderTime!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(state.lastReminderTime!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('getUnrepliedUserIds', () => {
    it('should return all tracked users when no one has replied', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      
      const unrepliedUserIds = stateManager.getUnrepliedUserIds(chatId, date, trackedUserIds);
      
      expect(unrepliedUserIds).toEqual(trackedUserIds);
    });

    it('should return only users who have not replied', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      
      stateManager.markUserReplied(chatId, date, 123456789);
      
      const unrepliedUserIds = stateManager.getUnrepliedUserIds(chatId, date, trackedUserIds);
      
      expect(unrepliedUserIds).toEqual([987654321]);
    });

    it('should return empty array when all users have replied', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      const trackedUserIds = [123456789, 987654321];
      
      stateManager.markUserReplied(chatId, date, 123456789);
      stateManager.markUserReplied(chatId, date, 987654321);
      
      const unrepliedUserIds = stateManager.getUnrepliedUserIds(chatId, date, trackedUserIds);
      
      expect(unrepliedUserIds).toEqual([]);
    });
  });

  describe('hasUserReplied', () => {
    it('should return false for user who has not replied', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      const userId = 123456789;
      
      expect(stateManager.hasUserReplied(chatId, date, userId)).toBe(false);
    });

    it('should return true for user who has replied', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      const userId = 123456789;
      
      stateManager.markUserReplied(chatId, date, userId);
      
      expect(stateManager.hasUserReplied(chatId, date, userId)).toBe(true);
    });
  });

  describe('resetStateForDate', () => {
    it('should remove state for specific chat and date', () => {
      const chatId = -123456789;
      const date = '2023-12-15';
      
      // Create some state
      stateManager.markUserReplied(chatId, date, 123456789);
      stateManager.incrementReminderCount(chatId, date);
      
      // Verify state exists
      expect(stateManager.getReminderCount(chatId, date)).toBe(1);
      expect(stateManager.hasUserReplied(chatId, date, 123456789)).toBe(true);
      
      // Reset state
      stateManager.resetStateForDate(chatId, date);
      
      // Verify state is reset
      expect(stateManager.getReminderCount(chatId, date)).toBe(0);
      expect(stateManager.hasUserReplied(chatId, date, 123456789)).toBe(false);
    });
  });

  describe('state isolation', () => {
    it('should maintain separate state for different chats', () => {
      const chat1 = -123456789;
      const chat2 = -987654321;
      const date = '2023-12-15';
      const userId = 123456789;
      
      stateManager.markUserReplied(chat1, date, userId);
      
      expect(stateManager.hasUserReplied(chat1, date, userId)).toBe(true);
      expect(stateManager.hasUserReplied(chat2, date, userId)).toBe(false);
    });

    it('should maintain separate state for different dates', () => {
      const chatId = -123456789;
      const date1 = '2023-12-15';
      const date2 = '2023-12-16';
      const userId = 123456789;
      
      stateManager.markUserReplied(chatId, date1, userId);
      
      expect(stateManager.hasUserReplied(chatId, date1, userId)).toBe(true);
      expect(stateManager.hasUserReplied(chatId, date2, userId)).toBe(false);
    });
  });
}); 