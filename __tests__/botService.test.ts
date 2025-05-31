import { BotService } from '../src/bot/services/botService';
import { MockUpdate } from '../src/bot/types';

// Mock the grammy Bot class
jest.mock('grammy', () => {
  const mockBot = {
    api: {
      sendMessage: jest.fn(),
      getChatMember: jest.fn(),
    },
    on: jest.fn(),
    command: jest.fn(),
    catch: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    handleUpdate: jest.fn(),
  };

  return {
    Bot: jest.fn(() => mockBot),
    GrammyError: class GrammyError extends Error {},
    HttpError: class HttpError extends Error {},
  };
});

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

describe('BotService', () => {
  let botService: BotService;
  let mockBotInstance: any;
  const config = {
    token: 'test_token',
    trackedUserIds: [123456789, 987654321],
    activeChatIds: [-123456789, -987654321],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked Bot constructor
    const { Bot } = require('grammy');
    botService = new BotService(config);
    
    // Get the mock instance
    mockBotInstance = Bot.mock.results[Bot.mock.results.length - 1].value;
  });

  describe('initialization', () => {
    it('should create bot with correct token', () => {
      const { Bot } = require('grammy');
      expect(Bot).toHaveBeenCalledWith('test_token');
    });

    it('should set up event handlers', () => {
      expect(mockBotInstance.on).toHaveBeenCalledWith('my_chat_member', expect.any(Function));
      expect(mockBotInstance.on).toHaveBeenCalledWith('message:text', expect.any(Function));
      expect(mockBotInstance.command).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockBotInstance.command).toHaveBeenCalledWith('help', expect.any(Function));
      expect(mockBotInstance.catch).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should initialize scheduler with active chats from config', () => {
      const scheduler = botService.getScheduler();
      const activeChats = scheduler.getActiveChats();
      
      expect(activeChats.has(-123456789)).toBe(true);
      expect(activeChats.has(-987654321)).toBe(true);
      expect(activeChats.size).toBe(2);
    });
  });

  describe('bot added to group', () => {
    it('should handle bot being added to group with informational message', async () => {
      const mockUpdate: MockUpdate = {
        update_id: 1,
        my_chat_member: {
          chat: {
            id: -123456789,
            type: 'group',
            title: 'Test Group',
          },
          from: {
            id: 123456789,
            first_name: 'John',
            username: 'john_doe',
          },
          date: Math.floor(Date.now() / 1000),
          old_chat_member: {
            user: {
              id: 987654321,
              first_name: 'Bot',
              username: 'testbot',
            },
            status: 'left',
          },
          new_chat_member: {
            user: {
              id: 987654321,
              first_name: 'Bot',
              username: 'testbot',
            },
            status: 'member',
          },
        },
      };

      // Get the handler function that was registered
      const onMyChatMemberCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'my_chat_member'
      );
      const handler = onMyChatMemberCall[1];

      // Create mock context
      const mockCtx = {
        myChatMember: mockUpdate.my_chat_member,
        chat: mockUpdate.my_chat_member!.chat,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Hello! I\'m the MyDailyPlans bot')
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('ACTIVE_CHAT_IDS environment variable')
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Chat ID: `-123456789`',
        { parse_mode: 'Markdown' }
      );

      // Chat should already be in scheduler from config initialization
      const scheduler = botService.getScheduler();
      expect(scheduler.getActiveChats().has(-123456789)).toBe(true);
    });

    it('should handle bot being removed from group', async () => {
      const mockUpdate: MockUpdate = {
        update_id: 2,
        my_chat_member: {
          chat: {
            id: -123456789,
            type: 'group',
            title: 'Test Group',
          },
          from: {
            id: 123456789,
            first_name: 'John',
            username: 'john_doe',
          },
          date: Math.floor(Date.now() / 1000),
          old_chat_member: {
            user: {
              id: 987654321,
              first_name: 'Bot',
              username: 'testbot',
            },
            status: 'member',
          },
          new_chat_member: {
            user: {
              id: 987654321,
              first_name: 'Bot',
              username: 'testbot',
            },
            status: 'left',
          },
        },
      };

      // Get the handler function
      const onMyChatMemberCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'my_chat_member'
      );
      const handler = onMyChatMemberCall[1];

      const mockCtx = {
        myChatMember: mockUpdate.my_chat_member,
        chat: mockUpdate.my_chat_member!.chat,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      // Chat should still be in scheduler (only config controls this now)
      const scheduler = botService.getScheduler();
      expect(scheduler.getActiveChats().has(-123456789)).toBe(true);
    });
  });

  describe('message handling', () => {
    it('should track replies from tracked users in active group chats', async () => {
      const mockUpdate: MockUpdate = {
        update_id: 3,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            first_name: 'John',
            username: 'john_doe',
          },
          chat: {
            id: -123456789,
            type: 'group',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'My daily plan: work on project X',
        },
      };

      // Get the message handler
      const onMessageCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'message:text'
      );
      const handler = onMessageCall[1];

      const mockCtx = {
        from: mockUpdate.message!.from,
        chat: mockUpdate.message!.chat,
        message: mockUpdate.message,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      // Check that user was marked as replied
      const stateManager = botService.getStateManager();
      const today = new Date().toISOString().split('T')[0];
      expect(stateManager.hasUserReplied(-123456789, today, 123456789)).toBe(true);
    });

    it('should not track replies from tracked users in non-active chats', async () => {
      const mockUpdate: MockUpdate = {
        update_id: 4,
        message: {
          message_id: 2,
          from: {
            id: 123456789,
            first_name: 'John',
            username: 'john_doe',
          },
          chat: {
            id: -999999999, // Not in activeChatIds
            type: 'group',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'My daily plan',
        },
      };

      const onMessageCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'message:text'
      );
      const handler = onMessageCall[1];

      const mockCtx = {
        from: mockUpdate.message!.from,
        chat: mockUpdate.message!.chat,
        message: mockUpdate.message,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      // Check that user was NOT marked as replied (inactive chat)
      const stateManager = botService.getStateManager();
      const today = new Date().toISOString().split('T')[0];
      expect(stateManager.hasUserReplied(-999999999, today, 123456789)).toBe(false);
    });

    it('should not track replies from non-tracked users', async () => {
      const mockUpdate: MockUpdate = {
        update_id: 5,
        message: {
          message_id: 3,
          from: {
            id: 999999999, // Not in tracked users
            first_name: 'Unknown',
          },
          chat: {
            id: -123456789,
            type: 'group',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'My daily plan',
        },
      };

      const onMessageCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'message:text'
      );
      const handler = onMessageCall[1];

      const mockCtx = {
        from: mockUpdate.message!.from,
        chat: mockUpdate.message!.chat,
        message: mockUpdate.message,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      // Check that user was NOT marked as replied
      const stateManager = botService.getStateManager();
      const today = new Date().toISOString().split('T')[0];
      expect(stateManager.hasUserReplied(-123456789, today, 999999999)).toBe(false);
    });

    it('should not track replies in private chats', async () => {
      const mockUpdate: MockUpdate = {
        update_id: 6,
        message: {
          message_id: 4,
          from: {
            id: 123456789,
            first_name: 'John',
            username: 'john_doe',
          },
          chat: {
            id: 123456789,
            type: 'private',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'My daily plan',
        },
      };

      const onMessageCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'message:text'
      );
      const handler = onMessageCall[1];

      const mockCtx = {
        from: mockUpdate.message!.from,
        chat: mockUpdate.message!.chat,
        message: mockUpdate.message,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      // Check that user was NOT marked as replied for private chat
      const stateManager = botService.getStateManager();
      const today = new Date().toISOString().split('T')[0];
      expect(stateManager.hasUserReplied(123456789, today, 123456789)).toBe(false);
    });

    it('should send confirmation when all users have replied', async () => {
      const stateManager = botService.getStateManager();
      const today = new Date().toISOString().split('T')[0];
      const chatId = -123456789;

      // Mark first user as already replied
      stateManager.markUserReplied(chatId, today, 987654321);

      const mockUpdate: MockUpdate = {
        update_id: 7,
        message: {
          message_id: 5,
          from: {
            id: 123456789,
            first_name: 'John',
            username: 'john_doe',
          },
          chat: {
            id: chatId,
            type: 'group',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'My daily plan',
        },
      };

      const onMessageCall = mockBotInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'message:text'
      );
      const handler = onMessageCall[1];

      const mockCtx = {
        from: mockUpdate.message!.from,
        chat: mockUpdate.message!.chat,
        message: mockUpdate.message,
        reply: jest.fn(),
      };

      await handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('✅ Great! Everyone has shared their daily plans.');
    });
  });

  describe('status command', () => {
    it('should show status in active group chat', async () => {
      const stateManager = botService.getStateManager();
      const today = new Date().toISOString().split('T')[0];
      const chatId = -123456789;

      // Set up some state
      stateManager.markUserReplied(chatId, today, 123456789);
      stateManager.incrementReminderCount(chatId, today);

      const statusCommandCall = mockBotInstance.command.mock.calls.find(
        (call: any[]) => call[0] === 'status'
      );
      const handler = statusCommandCall[1];

      const mockCtx = {
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      await handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringMatching(/Daily Plans Status for \d{4}-\d{2}-\d{2}/)
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Replied: 1/2')
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⏰ Reminders sent: 1/4')
      );
    });

    it('should show configuration message for inactive group chat', async () => {
      const statusCommandCall = mockBotInstance.command.mock.calls.find(
        (call: any[]) => call[0] === 'status'
      );
      const handler = statusCommandCall[1];

      const mockCtx = {
        chat: { id: -999999999, type: 'group' }, // Not in activeChatIds
        reply: jest.fn(),
      };

      await handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('This chat is not configured to receive reminders'),
        { parse_mode: 'Markdown' }
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Chat ID: `-999999999`')
      );
    });

    it('should reject status command in private chat', async () => {
      const statusCommandCall = mockBotInstance.command.mock.calls.find(
        (call: any[]) => call[0] === 'status'
      );
      const handler = statusCommandCall[1];

      const mockCtx = {
        chat: { id: 123456789, type: 'private' },
        reply: jest.fn(),
      };

      await handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('This command only works in group chats.');
    });
  });

  describe('help command', () => {
    it('should show help message with setup instructions', async () => {
      const helpCommandCall = mockBotInstance.command.mock.calls.find(
        (call: any[]) => call[0] === 'help'
      );
      const handler = helpCommandCall[1];

      const mockCtx = {
        reply: jest.fn(),
      };

      await handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('MyDailyPlans Bot Help'),
        { parse_mode: 'Markdown' }
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('ACTIVE_CHAT_IDS environment variable')
      );
    });
  });

  describe('service lifecycle', () => {
    it('should start bot and scheduler with configuration logging', async () => {
      await botService.start();

      expect(mockBotInstance.start).toHaveBeenCalled();
    });

    it('should stop bot', async () => {
      await botService.stop();

      expect(mockBotInstance.stop).toHaveBeenCalled();
    });
  });

  describe('manual reminder trigger', () => {
    it('should trigger initial reminder when hour 6 is specified', async () => {
      const scheduler = botService.getScheduler();
      const sendInitialReminderSpy = jest.spyOn(scheduler, 'sendInitialReminder').mockResolvedValue();
      const sendFollowUpReminderSpy = jest.spyOn(scheduler, 'sendFollowUpReminder').mockResolvedValue();
      
      await botService.triggerReminder(6);

      expect(sendInitialReminderSpy).toHaveBeenCalled();
      expect(sendFollowUpReminderSpy).not.toHaveBeenCalled();

      sendInitialReminderSpy.mockRestore();
      sendFollowUpReminderSpy.mockRestore();
    });

    it('should trigger follow-up reminder when other hour is specified', async () => {
      const scheduler = botService.getScheduler();
      const sendInitialReminderSpy = jest.spyOn(scheduler, 'sendInitialReminder').mockResolvedValue();
      const sendFollowUpReminderSpy = jest.spyOn(scheduler, 'sendFollowUpReminder').mockResolvedValue();
      
      await botService.triggerReminder(9);

      expect(sendFollowUpReminderSpy).toHaveBeenCalled();
      expect(sendInitialReminderSpy).not.toHaveBeenCalled();

      sendInitialReminderSpy.mockRestore();
      sendFollowUpReminderSpy.mockRestore();
    });

    it('should trigger initial reminder at 6 AM when no hour specified', async () => {
      const scheduler = botService.getScheduler();
      const sendInitialReminderSpy = jest.spyOn(scheduler, 'sendInitialReminder').mockResolvedValue();
      const sendFollowUpReminderSpy = jest.spyOn(scheduler, 'sendFollowUpReminder').mockResolvedValue();
      
      // Mock current hour to be 6
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-12-15T06:00:00.000Z'));

      await botService.triggerReminder();

      expect(sendInitialReminderSpy).toHaveBeenCalled();
      expect(sendFollowUpReminderSpy).not.toHaveBeenCalled();

      jest.useRealTimers();
      sendInitialReminderSpy.mockRestore();
      sendFollowUpReminderSpy.mockRestore();
    });

    it('should trigger follow-up reminder at other hours when no hour specified', async () => {
      const scheduler = botService.getScheduler();
      const sendInitialReminderSpy = jest.spyOn(scheduler, 'sendInitialReminder').mockResolvedValue();
      const sendFollowUpReminderSpy = jest.spyOn(scheduler, 'sendFollowUpReminder').mockResolvedValue();
      
      // Mock current hour to be 9
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-12-15T09:00:00.000Z'));

      await botService.triggerReminder();

      expect(sendFollowUpReminderSpy).toHaveBeenCalled();
      expect(sendInitialReminderSpy).not.toHaveBeenCalled();

      jest.useRealTimers();
      sendInitialReminderSpy.mockRestore();
      sendFollowUpReminderSpy.mockRestore();
    });
  });
}); 