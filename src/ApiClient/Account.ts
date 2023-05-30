// src/ApiClient/Account.ts

import axios from 'axios';
import WebSocket from 'ws';
import logger from '../Logger';
import * as Types from '../Types';
import { EventEmitter } from 'events';
import Logger from '../Logger';

interface AccountSettings {
  token: string;
  maxProcessingCount: number;
}
class Account extends EventEmitter {
  private settings: AccountSettings;
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private localQueue: Map<string, Types.GenRequest> = new Map();
  private serverQueue: Map<string, { GenRequest: Types.GenRequest, localId: string }> = new Map();
  private isConnected = false;

  constructor(settings: AccountSettings) {
    super();
    this.settings = settings;
    this.connect();
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
      logger.error({msg: 'Failed to fetch WebSocket URL:', error: err});
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
      const jsonResponse: Types.GenProgressWS = JSON.parse(data.toString());
      logger.debug(jsonResponse)
      if (jsonResponse.data.status === 'FINISHED') {
          // The request has finished processing, so we can find it in the queue and remove it.
          const finishedRequest = this.serverQueue.get(jsonResponse.id);
          if(!finishedRequest) {
              return logger.warn(`Received finished REQUEST ${jsonResponse.id} which is not in serverQ.`)
          }
          this.serverQueue.delete(jsonResponse.id);
          this.emitImageReady(jsonResponse, finishedRequest.localId)

          // Start processing the next request in the queue.
          this.processNextRequest();
      } else if (jsonResponse.type == "REQUEST") {
          logger.debug(jsonResponse)
          const serverQ = this.serverQueue.get(jsonResponse.id);

          if(!serverQ) logger.warn(`Received REQUEST for ${jsonResponse.id} which is not mine?`)

      } else if(jsonResponse.type == "PROGRESS") {
          const serverQ = this.serverQueue.get(jsonResponse.id);
          if(!serverQ) return;
          logger.info(`Update on ${jsonResponse.id} status ${jsonResponse.type} progress ${jsonResponse.data.progress}`)
      }
    });

    ws.on('close', () => {
      logger.warn('WebSocket connection closed, reconnecting...');
      setTimeout(() => this.connect(), 5000);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  }

  public addToQueue(GenRequest: Types.GenRequest, localId: string) {
    // Add a request to the local queue and attempt to process it
    this.localQueue.set(localId, GenRequest);
    this.processNextRequest();
  }

  private async processNextRequest() {
    if(!this.isConnected) return logger.info("Not Connected. Sleeping.")
    if(this.localQueue.size === 0) return logger.info("LocalQueue empty. Nothing to process. Sleeping.")
    if(this.serverQueue.size >= this.settings.maxProcessingCount) return logger.info("Queue full. Not Processing.")

    // Get the next request from the queue.
    const [nextId, request] = this.localQueue.entries().next().value;
    this.localQueue.delete(nextId);
    logger.info(`Processing ${request.prompt}`)

    // Send a request to the API.
    try {
        const response = await axios.post(
            'https://www.unstability.ai/api/submitPrompt',
            request, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0',
                    'cookie': `__Secure-next-auth.session-token=${process.env.SECRET_TOKEN}`,
                },
            }
        );

        const id = response.data.id;
        request.id = id;

        this.serverQueue.set(id, { GenRequest: request, localId: nextId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // request failed
        switch (error.response.status) {
            case 429:
                logger.error(`Caught 429 error when processing ${request.prompt}, requeueing after 30 seconds.`);
                this.localQueue.set(nextId, request)
                setTimeout(() => { this.processNextRequest }, 15000);
                break;
            case 400:
                logger.error(`Caught 400 error when processing ${request.prompt}. Error: ${error.response}`);
                this.emitRequestFailed(request, error, nextId)                
                break;
            case 401:
                if (error.response.data && error.response.data.illegalWords) {
                    const illegalWords: string[] = error.response.data.illegalWords.map(([, word]: [number, string]) => word);
                    logger.error(`Caught 401 error when processing ${request.prompt}. ${error.response.data.illegalWords}`);
                    this.emitIllegalWords(request, error, illegalWords, nextId)
                } else {
                    logger.error(`Caught 401 error when processing ${request.prompt}. ${error.response.data}`);
                    this.emitRequestFailed(request, error, nextId)
                    await request.interaction.followUp(`Huh... ${error.response.data}`);
                }
                break;
            default:
                logger.error(`Caught error when processing ${request.prompt}. Error: ${error}`);
                this.emitRequestFailed(request, error, nextId)
                break;
        }
        // End Switch
    }
  }

  public getServerQueueSize(): number {
    return this.serverQueue.size;
  }

  public getMaxProcessingCount(): number {
    return this.settings.maxProcessingCount;
  }

  private async emitImageReady(finalResponse: Types.GenProgressWS, localId: string) {
    // Emit an event to notify that an image is ready
    this.emit('imageReady', { data: finalResponse, localId });
  }
  private async emitRequestFailed(failedRequest: Types.GenProgressWS, error: Error, localId: string) {
    // Emit an event to notify that an image has failed
    this.emit('requestFailed', { data: failedRequest, error: error, localId });
  }
  private async emitIllegalWords(failedRequest: Types.GenProgressWS, error: Error, illegalWords: string[], localId: string) {
    // Emit an event to notify that an image has failed
    this.emit('illegalWords', { data: failedRequest, error: error, illegalWords: illegalWords, localId });
  }
}

export default Account;