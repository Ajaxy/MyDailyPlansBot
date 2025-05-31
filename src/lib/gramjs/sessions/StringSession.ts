import { Buffer } from 'buffer';
import { AuthKey } from '../crypto/AuthKey';
import Session from './Abstract';

export class StringSession extends Session {
  private _dcId: number;
  private _serverAddress: string;
  private _port: number;
  private _auth?: AuthKey;
  private _isTest?: boolean;

  constructor(private session: string = '') {
    super();
  }

  setDC(dcId: number, serverAddress: string, port: number, isTestServer?: boolean): void {
    this._dcId = dcId;
    this._serverAddress = serverAddress;
    this._port = port;
    this._isTest = isTestServer;
  }

  get dcId(): number {
    return this._dcId;
  }

  get serverAddress(): string {
    return this._serverAddress;
  }

  get port(): number {
    return this._port;
  }

  get isTestServer(): boolean | undefined {
    return this._isTest;
  }

  getAuthKey(dcId?: number): AuthKey {
    if (!this._auth) {
      this._auth = new AuthKey();
    }
    return this._auth;
  }

  setAuthKey(authKey: AuthKey | undefined, dcId?: number): void {
    this._auth = authKey;
  }

  save(): string {
    if (!this._auth?.getKey()) {
      return '';
    }
    const authKey = this._auth.getKey();
    let data = Buffer.concat([Buffer.from([1]), Buffer.from([this._dcId])]);
    if (this._isTest) {
      data = Buffer.concat([data, Buffer.from([1])]);
    } else {
      data = Buffer.concat([data, Buffer.from([0])]);
    }
    data = Buffer.concat([data, Buffer.from(this._serverAddress)]);
    data = Buffer.concat([data, Buffer.from([0])]);
    data = Buffer.concat([data, Buffer.from([this._port >> 8, this._port & 0xff])]);
    data = Buffer.concat([data, authKey!]);
    return data.toString('base64');
  }

  async load(): Promise<void> {
    if (!this.session) {
      return;
    }
    try {
      const data = Buffer.from(this.session, 'base64');
      if (data[0] !== 1) {
        throw new Error('Invalid string format');
      }
      this._dcId = data[1];
      const isTest = data[2] === 1;
      this._isTest = isTest;
      
      let serverAddressLen = 0;
      let idx = 3;
      while (data[idx] !== 0) {
        serverAddressLen++;
        idx++;
      }
      this._serverAddress = data.slice(3, 3 + serverAddressLen).toString();
      this._port = (data[4 + serverAddressLen] << 8) | data[5 + serverAddressLen];
      
      const authKey = data.slice(6 + serverAddressLen);
      if (authKey.length) {
        this._auth = new AuthKey();
        await this._auth.setKey(authKey);
      }
    } catch (e) {
      console.error('Failed to load session string:', e);
    }
  }

  delete(): void {
    this._auth = undefined;
  }
} 