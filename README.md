# MyDailyPlans Bot

A Telegram bot designed to help teams stay synchronized with daily plans. The bot automatically reminds team members to share their daily plans and tracks responses.

## Features

### 🤖 Automated Daily Reminders
- **Initial Reminder**: 6:00 AM GMT on working days (Monday-Friday)
- **Follow-up Reminders**: 9:00 AM, 12:00 PM, and 3:00 PM GMT (up to 4 total reminders per day)
- **Smart Tracking**: Only sends follow-up reminders if not everyone has responded

### 📊 User Management
- **Database-driven**: User tracking managed through PostgreSQL
- **Per-chat Configuration**: Users tracked separately for each chat
- **Username Required**: All tracked users must have Telegram usernames
- **Admin Configuration**: Users managed directly in the database

### 💬 Bot Commands
- `/status` - Check who has replied today and reminder count
- `/help` - Show command help

### 🎯 Smart Response Detection
- Tracks any message from configured users as a daily plan response
- Automatically updates usernames when users send messages
- Confirms when all team members have responded
- **Note**: Only users with usernames can be tracked

## Setup

### Prerequisites
- Node.js (version 16 or higher)
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Environment Variables

Create a `.env` file in the project root:

**Option 1: Using DATABASE_URL (Heroku Postgres)**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=postgres://username:password@hostname:port/database
```
*Note: SSL is automatically enabled when using `DATABASE_URL`*

**Option 2: Using individual database variables**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=mdp
```
*Note: SSL is disabled for local development*

### Installation & Database Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Create Database**:
   ```bash
   npm run db:create
   ```

3. **For Development** (with sample user data):
   ```bash
   npm run db:create -- --with-stubs
   ```

4. **Build and Start**:
   ```bash
   npm run build
   npm start
   ```

   For development with auto-reload: `npm run dev`

## Usage

1. **Add the Bot** to your group chat
2. **Configure Users**: Add users to the database (see User Management section)
3. **Verify Setup**: Use `/status` command in the chat

The bot will automatically send daily reminders and track responses from configured team members.

## Database Schema

```sql
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  username VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
```

- **telegram_id**: User's Telegram ID (stored as number)
- **chat_id**: Chat where the user should be tracked (stored as number)  
- **username**: User's Telegram username (required)
- **is_active**: Whether the user is currently being tracked

## User Management

Add users directly to the database:

```sql
-- Add a user
INSERT INTO users (telegram_id, chat_id, username, is_active) 
VALUES (123456789, -1001234567890, 'username', true);

-- Remove a user (soft delete)
UPDATE users SET is_active = false 
WHERE telegram_id = 123456789 AND chat_id = -1001234567890;

-- List active users
SELECT * FROM users WHERE is_active = true;
```

### Getting User and Chat IDs

- **User IDs**: Add [@userinfobot](https://t.me/userinfobot) to your group temporarily
- **Chat IDs**: Check bot logs when adding it to a group, or use the `/status` command

**Important**: Only users with Telegram usernames can be tracked by the bot.

## Development

### Manual Testing
In development mode, manually trigger reminders:
```bash
remind      # Follow-up reminder
remind 6    # Initial reminder (6 AM type)
```

### Database Management
- **Reset Database**: `npm run db:create -- --force`
- **With Sample Data**: `npm run db:create -- --force --with-stubs`
- **Schema Only**: `npm run db:seed`

### Testing
```bash
npm test
npm run test:watch
npm run test:coverage
```

## Support

- Use `/help` command in Telegram for bot usage
- Use `/status` to check current tracking status
- Manage users through database administration tools
- Ensure all tracked users have Telegram usernames
