import type { SessionData } from '../types';

import store from 'store2';
import { LocalStorage } from 'node-localstorage';

import { AuthKey } from '../crypto/AuthKey';
import { getDC } from '../Utils';
import MemorySession from './Memory';

export class StoreSession extends MemorySession {
  private _sessionData?: SessionData;

  private _callback: (session?: SessionData) => void;

  private _authKeys: Record<number, AuthKey>;

  constructor(sessionName: string, divider = ':') {
    super();

    this._authKeys = {};

    this._store = store.area(
      sessionName,
      new LocalStorage('./' + sessionName),
    );

    this._sessionName = sessionName + divider;
  }

  async load() {
    const sessionData = await this._store.get(`${this._sessionName}SessionData`);
    if (!sessionData) return;

    const {
      mainDcId,
      keys,
      isTest,
    } = JSON.parse(sessionData);
    const {
      ipAddress,
      port,
    } = getDC(mainDcId);

    this.setDC(mainDcId, ipAddress, port, isTest, true);

    await Promise.all(Object.keys(keys)
      .map(async (dcIdStr) => {
        const dcId = Number(dcIdStr);
        const key = Buffer.from(keys[dcId], 'hex');

        this._authKeys[dcId] = new AuthKey();
        await this._authKeys[dcId].setKey(key);
      }));
  }

  setDC(dcId: number, serverAddress: string, port: number, isTestServer?: boolean, skipOnUpdate = false) {
    this._dcId = dcId;
    this._serverAddress = serverAddress;
    this._port = port;
    this._isTestServer = isTestServer;

    delete this._authKeys[dcId];

    if (!skipOnUpdate) {
      void this._onUpdate();
    }
  }

  getAuthKey(dcId = this._dcId) {
    return this._authKeys[dcId];
  }

  setAuthKey(authKey: AuthKey, dcId = this._dcId) {
    this._authKeys[dcId] = authKey;

    void this._onUpdate();
  }

  _getSessionData() {
    const sessionData: SessionData = {
      mainDcId: this._dcId,
      keys: {},
      isTest: this._isTestServer || undefined,
    };

    Object
      .keys(this._authKeys)
      .forEach((dcIdStr) => {
        const dcId = Number(dcIdStr);
        const authKey = this._authKeys[dcId];
        if (!authKey?._key) return;

        sessionData.keys[dcId] = authKey._key.toString('hex');
      });

    return sessionData;
  }

  async _onUpdate() {
    await this._store.set(`${this._sessionName}SessionData`, JSON.stringify(this._getSessionData()));
  }

  delete() {
    this._callback(undefined);
  }
}

