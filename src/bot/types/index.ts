export interface DailyPlanState {
  chatId: number;
  date: string; // YYYY-MM-DD format
  repliedUsers: Set<number>;
  reminderCount: number;
  lastReminderTime?: Date;
}

export interface BotConfig {
  token: string;
  trackedUserIds: number[];
  activeChatIds: number[];
}

export interface ReminderTimes {
  initial: string; // '06:00'
  followUp1: string; // '09:00'
  followUp2: string; // '12:00'
  followUp3: string; // '15:00'
}

export const REMINDER_SCHEDULE: ReminderTimes = {
  initial: '06:00',
  followUp1: '09:00',
  followUp2: '12:00',
  followUp3: '15:00'
};

export const WORKING_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday

export interface MockUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
      first_name: string;
      last_name?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    date: number;
    text?: string;
  };
  my_chat_member?: {
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    from: {
      id: number;
      username?: string;
      first_name: string;
      last_name?: string;
    };
    date: number;
    old_chat_member: {
      user: {
        id: number;
        username?: string;
        first_name: string;
      };
      status: string;
    };
    new_chat_member: {
      user: {
        id: number;
        username?: string;
        first_name: string;
      };
      status: string;
    };
  };
} 