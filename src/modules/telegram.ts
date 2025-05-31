import readline from 'readline';

import { Api as GramJs } from '../lib/gramjs';

import TelegramClient from '../lib/gramjs/client/TelegramClient';
import { StoreSession } from '../lib/gramjs/sessions';
import { env } from '../config/dotenv';
import { Logger } from '../lib/gramjs/extensions';

const DEBUG_GRAMJS = 0;

Logger.setLevel(DEBUG_GRAMJS ? 'debug' : 'warn');

let client: TelegramClient;
let me: GramJs.User;

export async function init() {
  const { apiId, apiHash, phoneNumber } = env.telegram;

  if (!apiId || !apiHash || !phoneNumber) {
    console.warn('Telegram credentials not configured. TelegramMonitor will not be active.');
    return;
  }

  const session = new StoreSession('.localStorage');

  client = new TelegramClient(
    session,
    apiId,
    apiHash,
    {
      useWSS: true,
      connectionRetries: 5,
    },
  );

  await client.start({
    phoneNumber,
    phoneCode: requestPhoneCode,
    password: requestPassword,
    shouldThrowIfUnauthorized: Boolean(session.getAuthKey()),

    webAuthTokenFailed: undefined as any,
    firstAndLastNames: undefined as any,
    qrCode: undefined as any,
    onError: undefined as any,
  });

  const nextMe = await client.getMe();
  if (!(nextMe instanceof GramJs.User) || !nextMe.accessHash) {
    throw new Error('[telegram] `GetMe` failed');
  }

  me = nextMe;
}

function requestPhoneCode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question('Please enter code:', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function requestPassword(hint?: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question(`Please enter password (hint: ${hint || 'N/A'}):`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
