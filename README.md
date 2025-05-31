# LawAndOrder Telegram Bot

A team daily plans sync Telegram bot that helps teams track daily planning with automatic reminders.

## Features

- **Automatic Daily Reminders**: Sends reminders at 6 AM GMT on working days (Monday-Friday)
- **Smart Follow-ups**: Sends follow-up reminders every 3 hours (9 AM, 12 PM, 3 PM GMT) with mentions for team members who haven't responded
- **User Tracking**: Only tracks responses from specified team member IDs
- **Group Chat Support**: Works in group chats with proper chat member management
- **Status Monitoring**: Check daily plan status with the `/status` command
- **Comprehensive Testing**: Full test suite with mocked API requests

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LawAndOrder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp sample.env .env
   ```
   
   Edit `.env` and provide:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from [@BotFather](https://t.me/botfather)
   - `TRACKED_USER_IDS`: Comma-separated list of user IDs to track (e.g., "123456789,987654321")
   - Database configuration (if using the full stack)

## Usage

### Running the Bot

```bash
# Development mode with auto-restart
npm run dev:worker

# Production mode
npm run start:worker
```

### Bot Commands

- `/help` - Show help information
- `/status` - Check daily plan status (group chats only)

### How It Works

1. **Add to Group**: Add the bot to your team's group chat
2. **Daily Reminders**: Every working day at 6 AM GMT, the bot asks for daily plans
3. **Team Responses**: Team members reply with their daily plans
4. **Follow-up Reminders**: If someone hasn't replied, the bot sends reminders at 9 AM, 12 PM, and 3 PM GMT, mentioning the specific users
5. **Completion Tracking**: The bot acknowledges when everyone has shared their plans

### Getting User IDs

To find Telegram user IDs for the `TRACKED_USER_IDS` configuration:

1. Add [@userinfobot](https://t.me/userinfobot) to your group temporarily
2. Each team member should send a message
3. The bot will reply with their user ID
4. Remove the bot after collecting all IDs

## Testing

The project includes comprehensive tests covering all functionality:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

- **StateManager**: State tracking, user replies, reminder counts
- **SchedulerService**: Cron job scheduling, reminder logic, error handling
- **BotService**: Message handling, commands, bot lifecycle management

## Development

### Project Structure

```
src/
├── bot/                    # Bot implementation
│   ├── services/          # Core services
│   │   ├── botService.ts  # Main bot logic
│   │   ├── stateManager.ts # State management
│   │   └── scheduler.ts   # Reminder scheduling
│   └── types/             # TypeScript types
├── config/                # Configuration
├── worker/                # Worker entry point
└── ...

__tests__/                 # Test files
├── stateManager.test.ts
├── scheduler.test.ts
├── botService.test.ts
└── setup.ts
```

### Configuration

The bot uses environment variables for configuration:

- `TELEGRAM_BOT_TOKEN`: Required - Your bot token
- `TRACKED_USER_IDS`: Required - Comma-separated user IDs to track
- Database settings (inherited from the template)

### Scheduling

- **Initial Reminder**: 6:00 AM GMT, Monday-Friday
- **Follow-up Reminders**: 9:00 AM, 12:00 PM, 3:00 PM GMT, Monday-Friday
- **Maximum Reminders**: 4 per day (1 initial + 3 follow-ups)

## API Reference

### BotService

Main service that coordinates all bot functionality.

```typescript
const botService = new BotService({
  token: 'your_bot_token',
  trackedUserIds: [123456789, 987654321]
});

await botService.start(); // Start the bot
await botService.stop();  // Stop the bot
```

### StateManager

Manages daily plan state for each chat.

```typescript
const stateManager = new StateManager();

// Mark user as replied
stateManager.markUserReplied(chatId, date, userId);

// Check if user replied
const hasReplied = stateManager.hasUserReplied(chatId, date, userId);

// Get users who haven't replied
const unrepliedUsers = stateManager.getUnrepliedUsers(chatId, date, trackedUserIds);
```

### SchedulerService

Handles automatic reminder scheduling.

```typescript
const scheduler = new SchedulerService(bot, stateManager, trackedUserIds);

scheduler.addChat(chatId);    // Start tracking a chat
scheduler.removeChat(chatId); // Stop tracking a chat
scheduler.start();           // Start the cron jobs
```

## License

MIT License
