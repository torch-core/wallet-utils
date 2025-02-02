import { mnemonicToWalletKey } from '@ton/crypto';
import {
  internal,
  OpenedContract,
  OutActionSendMsg,
  Sender,
  SenderArguments,
  SendMode,
  TonClient,
  TonClient4,
} from '@ton/ton';
import { HighloadWalletV3, HighloadWalletV3Config } from './highload-wrapper';
import { HighloadQueryId } from './highload-query-id';
import { getMessageHash, retry } from '../../utils';

export async function createHighloadWalletV3(
  tonClient: TonClient | TonClient4,
  mnemonic: string[],
  config?: Omit<Partial<HighloadWalletV3Config>, 'publicKey'>,
): Promise<{
  wallet: OpenedContract<HighloadWalletV3>;
  deploy: (sender: Sender, value: bigint) => Promise<void>;
  send: (args: SenderArguments | SenderArguments[], queryId: HighloadQueryId) => Promise<string>;
}> {
  const keyPair = await mnemonicToWalletKey(mnemonic);
  const wallet = tonClient.open(
    HighloadWalletV3.createFromConfig({
      publicKey: keyPair.publicKey,
      subwalletId: config?.subwalletId ?? 0,
      timeout: config?.timeout ?? 60, // 60 seconds
    }),
  );

  const deploy = async (sender: Sender, value: bigint) => {
    await wallet.sendDeploy(sender, value);
  };

  const send = async (args: SenderArguments | SenderArguments[], queryId: HighloadQueryId): Promise<string> => {
    args = Array.isArray(args) ? args : [args];
    const messages: OutActionSendMsg[] = args.map((arg) => {
      return {
        type: 'sendMsg',
        mode: arg.sendMode ?? SendMode.NONE,
        outMsg: internal(arg),
      };
    });
    const createdAt = Math.floor(Date.now() / 1000) - 30;
    const timeout = 128;

    const { ok, value: msgHash } = await retry(
      async () => {
        const msg = await wallet.sendBatch(keyPair.secretKey, messages, queryId, timeout, createdAt);
        const msgHash = getMessageHash(wallet.address.toString(), msg);
        return msgHash;
      },
      {
        attempts: 10,
        attemptInterval: 5000,
        verbose: false,
        on_fail: () => console.log('Failed to send message'),
      },
    );

    if (!ok) {
      throw new Error('Failed to send message');
    }

    return msgHash;
  };

  return {
    wallet,
    deploy,
    send,
  };
}
