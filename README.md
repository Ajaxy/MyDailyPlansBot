# MyDailyPlans Bot

A Telegram bot designed to help teams stay synchronized with daily plans. The bot automatically reminds team members to share their daily plans and tracks responses.

## Features

### 🤖 Automated Daily Reminders
- **Initial Reminder**: 6:00 AM GMT on working days (Monday-Friday)
- **Follow-up Reminders**: 9:00 AM, 12:00 PM, and 3:00 PM GMT (up to 4 total reminders per day)
- **Smart Tracking**: Only sends follow-up reminders if not everyone has responded

### 🔔 GitHub PR Reminders
- **Automatic PR Checks**: 10:00 AM and 4:00 PM GMT daily
- **Personalized Reminders**: Lists open PRs assigned to each team member
- **Direct Links**: Clickable PR links for easy access
- **Multi-repo Support**: Monitors multiple GitHub repositories

### 📅 Duty Reminders
- **Automatic Duty Checks**: 12:00 AM GMT daily
- **Notion Integration**: Fetches duty assignments from Notion database
- **User Mapping**: Maps Notion usernames to Telegram usernames
- **Manual Trigger**: `/remind_duty` command for on-demand reminders

### 📊 User Management
- **Database-driven**: User tracking managed through PostgreSQL
- **Per-chat Configuration**: Users tracked separately for each chat
- **Username Required**: All tracked users must have Telegram usernames
- **Admin Configuration**: Users managed directly in the database

### 💬 Bot Commands
- `/status` - Check who has replied today and reminder count
- `/remind_pr` - Manually trigger PR reminders for the current chat
- `/remind_duty` - Manually trigger duty reminder for the current chat
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
DATABASE_URL=postgres://username:password@hostname:port/database
```
*Note: SSL is automatically enabled when using `DATABASE_URL`*

**Option 2: Using individual database variables**
```env
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
  is_active BOOLEAN DEFAULT TRUE,
  github_username VARCHAR(255)
);

CREATE TABLE repositories (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  gh_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(full_name, chat_id)
);
```

### Users table:
- **telegram_id**: User's Telegram ID (stored as number)
- **chat_id**: Chat where the user should be tracked (stored as number)  
- **username**: User's Telegram username (required)
- **is_active**: Whether the user is currently being tracked
- **github_username**: User's GitHub username for PR reminders (optional)

### Repositories table:
- **id**: Auto-incrementing primary key
- **chat_id**: Chat where PR reminders for this repository should be sent
- **full_name**: Repository full name in "owner/repo" format
- **is_active**: Whether to check this repository for PRs
- **gh_token**: Fine-grained personal access token for this repository (required)
- **created_at**: When the repository was added
- **Unique constraint**: Combination of full_name and chat_id (prevents duplicate entries)

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

## GitHub PR Reminders Configuration

### 1. Configure Repositories with Tokens
Each repository must have its own GitHub Personal Access Token. Add repositories to the `repositories` table:
```sql
-- Add repositories with GitHub tokens (required)
INSERT INTO repositories (full_name, chat_id, is_active, gh_token) VALUES 
  ('organization/repo1', -1001234567890, true, 'github_pat_...'),
  ('organization/repo2', -1001234567890, true, 'github_pat_...');

-- Use fine-grained personal access tokens with read-only access to PRs
INSERT INTO repositories (full_name, chat_id, is_active, gh_token) VALUES 
  ('private-org/sensitive-repo', -1001234567890, true, 'github_pat_...');

-- List repositories for a chat
SELECT * FROM repositories WHERE chat_id = -1001234567890 AND is_active = true;

-- Update repository token
UPDATE repositories SET gh_token = 'github_pat_...' WHERE id = 1;

-- Disable a repository by ID
UPDATE repositories SET is_active = false WHERE id = 1;
```

### 2. Creating GitHub Fine-grained Personal Access Tokens

For each repository, create a fine-grained personal access token:
1. Go to GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens
2. Click "Generate new token"
3. Set expiration date
4. Select "Repository access" > "Selected repositories" and choose the specific repository
5. Under "Repository permissions", set "Pull requests" to "Read"
6. Generate and copy the token (starts with `github_pat_`)

### 3. Add GitHub Usernames
Update users with their GitHub usernames:
```sql
UPDATE users SET github_username = 'github-username' 
WHERE telegram_id = 123456789;
```

## Development

### Manual Testing
In development mode, manually trigger reminders:
```bash
remind      # Follow-up reminder
remind 6    # Initial reminder (6 AM type)
remind_pr   # Trigger PR reminders
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
