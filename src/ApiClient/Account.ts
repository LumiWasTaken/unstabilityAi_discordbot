// src/ApiClient/Account.ts

import axios from 'axios';
import WebSocket from 'ws';
import logger from '../Logger';
import { Request, GenRequest } from '../Types';
import { CommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { EventEmitter } from 'events';

interface AccountSettings {
  token: string;
  maxProcessingCount: number;
}
class Account extends EventEmitter {
  private settings: AccountSettings;
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private localQueue: Map<string, Request> = new Map();
  private serverQueue: Map<string, Request> = new Map();
  private isConnected = false;

  constructor(settings: AccountSettings) {
    super();
    this.settings = settings;
  }

  private async fetchWebSocketURL(): Promise<string | null> {
    try {
      const response = await axios.get("https://www.unstability.ai/api/getWebSocketURL", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
          'cookie': `__Secure-next-auth.session-token=${this.settings.token}`
        },
      });
      const wsUrl = response.data.url;
      return wsUrl;
    } catch (err) {
      logger.error('Failed to fetch WebSocket URL:', err);
      return null;
    }
  }

  public async connect() {
    // Close any existing WebSocket connection
    this.disconnect();

    const wsUrl = await this.fetchWebSocketURL();

    if (wsUrl) {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocket(this.ws);
    } else {
      logger.error('Failed to fetch WebSocket URL, retrying in 30 seconds.');
      setTimeout(() => this.connect(), 30000);
    }
  }

  public disconnect() {
    if (this.ws) {
      // Disconnect from WebSocket and clean up the intervals
      this.ws.close();
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      this.isConnected = false;
    }
  }

  private setupWebSocket(ws: WebSocket) {
    ws.on('open', () => {
      logger.info('WebSocket connection established');
      this.isConnected = true;
      // Start sending ping messages every 25 seconds
      this.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25000);
    });

    ws.on('message', async (data) => {
      // Process incoming message from WebSocket
      // You can move the logic from the original index.ts file here
    });

    ws.on('close', () => {
      logger.warn('WebSocket connection closed, reconnecting...');
      setTimeout(() => this.connect(), 15000);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  }

  public addToQueue(requestData: Request) {
    // Add a request to the local queue and attempt to process it
    this.localQueue.set(Date.now().toString(), requestData);
    this.processNextRequest();
  }

  private async processNextRequest() {
    // WebSocket connection check
    if (
      !this.isConnected ||
      this.localQueue.size === 0 ||
      this.serverQueue.size >= this.settings.maxProcessingCount
    ) {
      return;
    }

    // Process next request and move it from localQueue to serverQueue
    // Similar to your original index.ts logic
  }
  
  public getServerQueueSize(): number {
    return this.serverQueue.size;
  }

  public getMaxProcessingCount(): number {
    return this.settings.maxProcessingCount;
  }

  private async emitImageReady(interaction: CommandInteraction, embeds: EmbedBuilder[], attachments: AttachmentBuilder[]) {
    // Emit an event to notify that an image is ready
    this.emit('imageReady', { interaction, embeds, attachments });
  }
}

export default Account;