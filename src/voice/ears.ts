export type EarState = 'asleep' | 'awake' | 'followup';
export const WAKE_IDLE_MS = 6000;
export const FOLLOWUP_MS = 7000;

export class Ears {
  state: EarState = 'asleep';
  private deadline = 0;
  private holding = false;
  private ptt = false;

  get open(): boolean {
    return this.ptt || this.state !== 'asleep';
  }

  get pushToTalk(): boolean {
    return this.ptt;
  }

  wake(now: number) {
    this.state = 'awake';
    this.holding = false;
    this.deadline = now + WAKE_IDLE_MS;
  }

  setPushToTalk(down: boolean, now: number) {
    this.ptt = down;
    if (!down) {
      this.state = 'awake';
      this.deadline = now + WAKE_IDLE_MS;
    }
  }

  userSpeaking(now: number) {
    if (!this.open) return;
    this.state = 'awake';
    this.deadline = now + WAKE_IDLE_MS;
  }

  chefReplyStarted() {
    if (this.open) this.holding = true;
  }

  chefReplyDone(now: number) {
    if (!this.holding) return;
    this.holding = false;
    this.state = 'followup';
    this.deadline = now + FOLLOWUP_MS;
  }

  tick(now: number) {
    if (!this.ptt && !this.holding && this.state !== 'asleep' && now > this.deadline) this.state = 'asleep';
  }
}
