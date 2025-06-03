import { DailyPlanState } from '../types';

export class StateManager {
  private states: Map<string, DailyPlanState> = new Map();

  private getStateKey(chatId: number, date: string): string {
    return `${chatId}_${date}`;
  }

  public getState(chatId: number, date: string): DailyPlanState {
    const key = this.getStateKey(chatId, date);
    if (!this.states.has(key)) {
      this.states.set(key, {
        chatId,
        date,
        repliedUserIds: new Set(),
        reminderCount: 0,
      });
    }
    return this.states.get(key)!;
  }

  public markUserReplied(chatId: number, date: string, userId: number): void {
    const state = this.getState(chatId, date);
    state.repliedUserIds.add(userId);
  }

  public incrementReminderCount(chatId: number, date: string): void {
    const state = this.getState(chatId, date);
    state.reminderCount++;
    state.lastReminderTime = new Date();
  }

  public getRepliedUserIds(chatId: number, date: string): Set<number> {
    return this.getState(chatId, date).repliedUserIds;
  }

  public getReminderCount(chatId: number, date: string): number {
    return this.getState(chatId, date).reminderCount;
  }

  public getUnrepliedUserIds(chatId: number, date: string, trackedUserIds: number[]): number[] {
    const repliedUserIds = this.getRepliedUserIds(chatId, date);
    return trackedUserIds.filter(userId => !repliedUserIds.has(userId));
  }

  public hasUserReplied(chatId: number, date: string, userId: number): boolean {
    return this.getRepliedUserIds(chatId, date).has(userId);
  }

  public resetStateForDate(chatId: number, date: string): void {
    const key = this.getStateKey(chatId, date);
    this.states.delete(key);
  }

  public getAllStates(): Map<string, DailyPlanState> {
    return new Map(this.states);
  }
} 