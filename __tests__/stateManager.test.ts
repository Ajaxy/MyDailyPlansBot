import { StateManager } from '../src/bot/services/stateManager';

describe('StateManager', () => {
  let stateManager: StateManager;
  const chatId = -123456789;
  const date = '2023-12-15';
  const trackedUserIds = [123456789, 987654321, 555666777];

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('getState', () => {
    it('should create new state for chat and date', () => {
      const state = stateManager.getState(chatId, date);
      
      expect(state.chatId).toBe(chatId);
      expect(state.date).toBe(date);
      expect(state.repliedUsers.size).toBe(0);
      expect(state.reminderCount).toBe(0);
      expect(state.lastReminderTime).toBeUndefined();
    });

    it('should return existing state for same chat and date', () => {
      const state1 = stateManager.getState(chatId, date);
      state1.reminderCount = 2;
      state1.repliedUsers.add(123456789);

      const state2 = stateManager.getState(chatId, date);
      
      expect(state2).toBe(state1);
      expect(state2.reminderCount).toBe(2);
      expect(state2.repliedUsers.has(123456789)).toBe(true);
    });
  });

  describe('markUserReplied', () => {
    it('should mark user as replied', () => {
      const userId = 123456789;
      
      stateManager.markUserReplied(chatId, date, userId);
      
      expect(stateManager.hasUserReplied(chatId, date, userId)).toBe(true);
      expect(stateManager.getRepliedUsers(chatId, date).has(userId)).toBe(true);
    });

    it('should not duplicate user replies', () => {
      const userId = 123456789;
      
      stateManager.markUserReplied(chatId, date, userId);
      stateManager.markUserReplied(chatId, date, userId);
      
      expect(stateManager.getRepliedUsers(chatId, date).size).toBe(1);
    });
  });

  describe('incrementReminderCount', () => {
    it('should increment reminder count and set timestamp', () => {
      const beforeTime = new Date();
      
      stateManager.incrementReminderCount(chatId, date);
      
      const afterTime = new Date();
      const state = stateManager.getState(chatId, date);
      
      expect(state.reminderCount).toBe(1);
      expect(state.lastReminderTime).toBeDefined();
      expect(state.lastReminderTime!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(state.lastReminderTime!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should increment reminder count multiple times', () => {
      stateManager.incrementReminderCount(chatId, date);
      stateManager.incrementReminderCount(chatId, date);
      stateManager.incrementReminderCount(chatId, date);
      
      expect(stateManager.getReminderCount(chatId, date)).toBe(3);
    });
  });

  describe('getUnrepliedUsers', () => {
    it('should return all tracked users when no one has replied', () => {
      const unrepliedUsers = stateManager.getUnrepliedUsers(chatId, date, trackedUserIds);
      
      expect(unrepliedUsers).toEqual(trackedUserIds);
    });

    it('should exclude users who have replied', () => {
      stateManager.markUserReplied(chatId, date, 123456789);
      stateManager.markUserReplied(chatId, date, 555666777);
      
      const unrepliedUsers = stateManager.getUnrepliedUsers(chatId, date, trackedUserIds);
      
      expect(unrepliedUsers).toEqual([987654321]);
    });

    it('should return empty array when all users have replied', () => {
      trackedUserIds.forEach(userId => {
        stateManager.markUserReplied(chatId, date, userId);
      });
      
      const unrepliedUsers = stateManager.getUnrepliedUsers(chatId, date, trackedUserIds);
      
      expect(unrepliedUsers).toEqual([]);
    });
  });

  describe('resetStateForDate', () => {
    it('should reset state for specific chat and date', () => {
      // Set up some state
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

    it('should not affect other chat/date combinations', () => {
      const otherDate = '2023-12-16';
      const otherChatId = -987654321;
      
      // Set up state for multiple combinations
      stateManager.markUserReplied(chatId, date, 123456789);
      stateManager.markUserReplied(chatId, otherDate, 123456789);
      stateManager.markUserReplied(otherChatId, date, 123456789);
      
      // Reset only one combination
      stateManager.resetStateForDate(chatId, date);
      
      // Verify only the specific combination was reset
      expect(stateManager.hasUserReplied(chatId, date, 123456789)).toBe(false);
      expect(stateManager.hasUserReplied(chatId, otherDate, 123456789)).toBe(true);
      expect(stateManager.hasUserReplied(otherChatId, date, 123456789)).toBe(true);
    });
  });

  describe('getAllStates', () => {
    it('should return copy of all states', () => {
      stateManager.markUserReplied(chatId, date, 123456789);
      stateManager.incrementReminderCount(chatId, date);
      
      const allStates = stateManager.getAllStates();
      
      expect(allStates.size).toBe(1);
      
      // Verify it's a copy, not the original
      allStates.clear();
      expect(stateManager.getAllStates().size).toBe(1);
    });
  });
}); 