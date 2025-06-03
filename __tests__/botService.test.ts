import { BotService } from '../src/services/botService';
import { StateManager } from '../src/services/stateManager';
import { MockUpdate } from '../src/types';

// Mock the Bot
const mockBot = {
  api: {
    sendMessage: jest.fn(),
  },
  command: jest.fn(),
  on: jest.fn(),
  catch: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};

// Mock grammy
jest.mock('grammy', () => ({
  Bot: jest.fn(() => mockBot),
  GrammyError: class GrammyError extends Error {
    constructor(public description: string) {
      super(description);
    }
  },
  HttpError: class HttpError extends Error {
    constructor(message: string) {
      super(message);
    }
  },
}));

// Mock UserService
const mockUserService = {
  getActiveUsersForChat: jest.fn(),
  getActiveChatIds: jest.fn(),
  getTrackedUserIdsForChat: jest.fn(),
  isUserActiveInChat: jest.fn(),
  upsertUser: jest.fn(),
};

jest.mock('../src/services/UserService', () => {
  return {
    UserService: jest.fn().mockImplementation(() => mockUserService),
  };
});

// Mock SchedulerService
const mockScheduler = {
  start: jest.fn(),
  sendInitialReminder: jest.fn(),
  sendFollowUpReminder: jest.fn(),
};

jest.mock('../src/services/scheduler', () => ({
  SchedulerService: jest.fn().mockImplementation(() => mockScheduler),
}));

describe('BotService', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService({ token: 'test-token' });
  });

  describe('constructor', () => {
    it('should initialize bot service with required components', () => {
      expect(botService).toBeDefined();
      expect(botService.getBot()).toBe(mockBot);
      expect(botService.getStateManager()).toBeInstanceOf(StateManager);
      expect(botService.getScheduler()).toBeDefined();
      expect(botService.getUserService()).toBeDefined();
    });

    it('should set up handlers and error handling', () => {
      expect(mockBot.on).toHaveBeenCalledWith('my_chat_member', expect.any(Function));
      expect(mockBot.on).toHaveBeenCalledWith('message:text', expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith('help', expect.any(Function));
      expect(mockBot.catch).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('start method', () => {
    it('should start scheduler and bot', async () => {
      mockUserService.getActiveChatIds.mockResolvedValue([-123456789, -987654321]);
      
      await botService.start();
      
      expect(mockScheduler.start).toHaveBeenCalled();
      expect(mockBot.start).toHaveBeenCalled();
    });

    it('should handle case when no active chats found', async () => {
      mockUserService.getActiveChatIds.mockRejectedValue(new Error('No chats'));
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await botService.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('No active chats found in database');
      
      consoleSpy.mockRestore();
    });
  });

  describe('stop method', () => {
    it('should stop the bot', async () => {
      await botService.stop();
      
      expect(mockBot.stop).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    let messageHandler: Function;
    let stateManager: StateManager;

    beforeEach(() => {
      // Get the message handler
      const messageHandlerCall = mockBot.on.mock.calls.find(
        (call: any[]) => call[0] === 'message:text'
      );
      messageHandler = messageHandlerCall![1];
      stateManager = botService.getStateManager();
    });

    it('should track reply from active user', async () => {
      const chatId = -123456789;
      const userId = 123456789;
      const username = 'testuser';
      const today = new Date().toISOString().split('T')[0];

      // Mock UserService
      mockUserService.isUserActiveInChat.mockResolvedValue(true);
      mockUserService.getTrackedUserIdsForChat.mockResolvedValue([userId, 987654321]);
      mockUserService.upsertUser.mockResolvedValue(undefined);

      // Create mock context
      const mockCtx = {
        from: { id: userId, username },
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      await messageHandler(mockCtx);

      expect(mockUserService.isUserActiveInChat).toHaveBeenCalledWith(userId, chatId);
      expect(mockUserService.upsertUser).toHaveBeenCalledWith(userId, chatId, username);
      expect(stateManager.hasUserReplied(chatId, today, userId)).toBe(true);
    });

    it('should not track reply from inactive user', async () => {
      const chatId = -123456789;
      const userId = 123456789;
      const username = 'testuser';
      const today = new Date().toISOString().split('T')[0];

      // Mock UserService
      mockUserService.isUserActiveInChat.mockResolvedValue(false);

      // Create mock context
      const mockCtx = {
        from: { id: userId, username },
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      await messageHandler(mockCtx);

      expect(mockUserService.isUserActiveInChat).toHaveBeenCalledWith(userId, chatId);
      expect(mockUserService.upsertUser).not.toHaveBeenCalled();
      expect(stateManager.hasUserReplied(chatId, today, userId)).toBe(false);
    });

    it('should send confirmation when all users have replied', async () => {
      const chatId = -123456789;
      const userId = 123456789;
      const username = 'testuser';

      // Mock UserService
      mockUserService.isUserActiveInChat.mockResolvedValue(true);
      mockUserService.getTrackedUserIdsForChat.mockResolvedValue([userId]); // Only one user
      mockUserService.upsertUser.mockResolvedValue(undefined);

      // Create mock context
      const mockCtx = {
        from: { id: userId, username },
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      await messageHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('✅ Отлично! Все поделились своими планами на день.');
    });

    it('should ignore messages without userId or username', async () => {
      const mockCtx = {
        from: { id: null, username: null },
        chat: { id: -123456789, type: 'group' },
        reply: jest.fn(),
      };

      await messageHandler(mockCtx);

      expect(mockUserService.isUserActiveInChat).not.toHaveBeenCalled();
    });

    it('should ignore messages in private chats for tracking', async () => {
      const mockCtx = {
        from: { id: 123456789, username: 'testuser' },
        chat: { id: 123456789, type: 'private' },
        reply: jest.fn(),
      };

      mockUserService.isUserActiveInChat.mockResolvedValue(true);

      await messageHandler(mockCtx);

      // Should still check if user is active and update user info
      expect(mockUserService.isUserActiveInChat).toHaveBeenCalled();
      expect(mockUserService.upsertUser).toHaveBeenCalled();

      // But should not mark as replied or send confirmation
      expect(mockCtx.reply).not.toHaveBeenCalled();
    });
  });

  describe('status command', () => {
    let statusHandler: Function;

    beforeEach(() => {
      // Get the status command handler
      const statusHandlerCall = mockBot.command.mock.calls.find(
        (call: any[]) => call[0] === 'status'
      );
      statusHandler = statusHandlerCall![1];
    });

    it('should show status for group chat', async () => {
      const chatId = -123456789;
      const today = new Date().toISOString().split('T')[0];
      
      // Mock user data
      const trackedUsers = [
        { telegramId: 123456789, username: 'user1' },
        { telegramId: 987654321, username: 'user2' },
      ];
      
      mockUserService.getActiveUsersForChat.mockResolvedValue(trackedUsers);

      const mockCtx = {
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      await statusHandler(mockCtx);

      expect(mockUserService.getActiveUsersForChat).toHaveBeenCalledWith(chatId);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📊 Статус ежедневных планов'),
        { parse_mode: 'Markdown' }
      );
    });

    it('should handle case when no tracked users exist', async () => {
      const chatId = -123456789;
      
      mockUserService.getActiveUsersForChat.mockResolvedValue([]);

      const mockCtx = {
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      await statusHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '⚠️ В этом чате нет отслеживаемых пользователей.\n\n' +
        'Обратитесь к администратору для настройки отслеживания участников команды.'
      );
    });

    it('should reject status command in private chat', async () => {
      const mockCtx = {
        chat: { type: 'private' },
        reply: jest.fn(),
      };

      await statusHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Эта команда работает только в групповых чатах.');
    });

    it('should handle errors gracefully', async () => {
      const chatId = -123456789;
      
      mockUserService.getActiveUsersForChat.mockRejectedValue(new Error('Database error'));

      const mockCtx = {
        chat: { id: chatId, type: 'group' },
        reply: jest.fn(),
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await statusHandler(mockCtx);

      expect(consoleSpy).toHaveBeenCalledWith('Error getting status:', expect.any(Error));
      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Ошибка при получении статуса.');

      consoleSpy.mockRestore();
    });
  });

  describe('help command', () => {
    let helpHandler: Function;

    beforeEach(() => {
      // Get the help command handler
      const helpHandlerCall = mockBot.command.mock.calls.find(
        (call: any[]) => call[0] === 'help'
      );
      helpHandler = helpHandlerCall![1];
    });

    it('should send help message', async () => {
      const mockCtx = {
        reply: jest.fn(),
      };

      await helpHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🤖 *Справка MyDailyPlans Bot*'),
        { parse_mode: 'Markdown' }
      );
    });
  });

  describe('chat member events', () => {
    let chatMemberHandler: Function;

    beforeEach(() => {
      // Get the chat member handler
      const chatMemberHandlerCall = mockBot.on.mock.calls.find(
        (call: any[]) => call[0] === 'my_chat_member'
      );
      chatMemberHandler = chatMemberHandlerCall![1];
    });

    it('should send welcome message when bot is added to chat', async () => {
      const mockCtx = {
        myChatMember: {
          new_chat_member: { status: 'member' },
        },
        chat: { id: -123456789, title: 'Test Group' },
        reply: jest.fn(),
      };

      await chatMemberHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('👋 Привет! Я бот *MyDailyPlans*'),
        { parse_mode: 'Markdown' }
      );
    });

    it('should log when bot is removed from chat', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const mockCtx = {
        myChatMember: {
          new_chat_member: { status: 'left' },
        },
        chat: { id: -123456789 },
        reply: jest.fn(),
      };

      await chatMemberHandler(mockCtx);

      expect(consoleSpy).toHaveBeenCalledWith('Bot removed from chat: -123456789');
      expect(mockCtx.reply).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('triggerReminder', () => {
    it('should trigger initial reminder for hour 6', async () => {
      await botService.triggerReminder(6);

      expect(mockScheduler.sendInitialReminder).toHaveBeenCalled();
      expect(mockScheduler.sendFollowUpReminder).not.toHaveBeenCalled();
    });

    it('should trigger follow-up reminder for other hours', async () => {
      await botService.triggerReminder(9);

      expect(mockScheduler.sendFollowUpReminder).toHaveBeenCalled();
      expect(mockScheduler.sendInitialReminder).not.toHaveBeenCalled();
    });

    it('should trigger follow-up reminder when no hour specified', async () => {
      await botService.triggerReminder();

      expect(mockScheduler.sendFollowUpReminder).toHaveBeenCalled();
      expect(mockScheduler.sendInitialReminder).not.toHaveBeenCalled();
    });
  });
}); 