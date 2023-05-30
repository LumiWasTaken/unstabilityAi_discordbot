// src/ApiClient/AccountManager.ts

import { CommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { EventEmitter } from 'events';
import { Request, AccountSettings, ImageReadyHandler } from '../Types';
import Account from './Account';





class AccountManager extends EventEmitter {
  private accounts: Account[] = [];

  constructor(accountSettingsList: AccountSettings[]) {
    super();
    for (const settings of accountSettingsList) {
      const account = new Account(settings);
      account.on('imageReady', (data) => {
        this.emit('imageReady', data);
      });
      this.accounts.push(account);
    }
  }

  private getNextAvailableAccount(): Account | null {
    const availableAccounts = this.accounts.filter(
      (account: Account) =>
        account.getServerQueueSize() < account.getMaxProcessingCount()
    );
    if (availableAccounts.length > 0) {
      return availableAccounts[0]; // or any load balancing strategy you prefer
    }
    return null;
  }

  public addToQueue(request: Request) {
    const account = this.getNextAvailableAccount();
    if (account) {
      account.addToQueue(request);
    } else {
      // Could not find any available accounts
      // You can either wait and retry or notify the user that all accounts are busy
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

  public on(event: 'imageReady', listener: ImageReadyHandler): this {
    return super.on(event, listener);
  }

  public emit(
    event: 'imageReady',
    data: {
      interaction: CommandInteraction;
      embeds: EmbedBuilder[];
      attachments: AttachmentBuilder[];
    }
  ): boolean {
    return super.emit(event, data);
  }
}

export default AccountManager;
