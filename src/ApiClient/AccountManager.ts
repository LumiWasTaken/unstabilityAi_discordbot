// src/ApiClient/AccountManager.ts

import { EventEmitter } from 'events';
import * as Types from '../Types';
import Account from './Account';
import logger from '../Logger';



type EventsMap = {
  imageReady: { data: Types.GenProgressWS; localId: string };
  illegalWords: { illegalWords: string[]; localId: string };
  requestFailed: { error: Error; localId: string };
};

class AccountManager extends EventEmitter {
  private accounts: Account[] = [];

  constructor(accountSettingsList: Types.AccountSettings[]) {
    super();
    for (const settings of accountSettingsList) {
      const account = new Account(settings);
      account.on('imageReady', (data) => {
        this.emit('imageReady', data);
      });
      this.accounts.push(account);
    }
  }

  public getNextAvailableAccount(): Account | null {
    const availableAccounts = this.accounts.filter(
      (account: Account) =>
        account.getServerQueueSize() < account.getMaxProcessingCount()
    );
    if (availableAccounts.length > 0) {
      return availableAccounts[0]; // or any load balancing strategy you prefer
    }
    return null;
  }

  public addToQueue(GenRequest: Types.GenRequest, localId: string): boolean {
    const account = this.getNextAvailableAccount();
    if (account) {
      account.addToQueue(GenRequest, localId);
      return true;
    } else {
      logger.error("Ooops... No Account available :/")
      return false;
    }
  }

  public connectAllAccounts() {
    for (const account of this.accounts) {
      account.connect();
    }
  }

  public disconnectAllAccounts() {
    for (const account of this.accounts) {
      account.disconnect();
    }
  }

  public on<K extends keyof EventsMap>(
    event: K,
    listener: (data: EventsMap[K]) => void
  ): this {
    return super.on(event, listener);
  }
  public emit<K extends keyof EventsMap>(
    event: K,
    data: EventsMap[K]
  ): boolean {
    return super.emit(event, data);
  }
}

export default AccountManager;
