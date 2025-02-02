import { mnemonicToWalletKey } from '@ton/crypto';
import { internal, OutActionSendMsg, Sender, SenderArguments, SendMode, TonClient, TonClient4 } from '@ton/ton';
import { HighloadWalletV3, HighloadWalletV3Config } from './highload-wrapper';
import { HighloadQueryId } from './highload-query-id';
import { getMessageHash, retry } from '../../utils';

/**
 * Creates a HighloadWalletV3 instance using the provided TonClient, mnemonic, and optional configuration.
 *
 * This function initializes a highload wallet by generating a key pair from the mnemonic and
 * configuring the wallet with the provided settings. It provides methods to deploy the wallet
 * and send messages in batches.
 *
 * @param tonClient - The TonClient instance used to interact with the blockchain.
 * @param mnemonic - An array of mnemonic words used to derive the wallet's key pair.
 * @param config - Optional configuration for the wallet, excluding the public key, which includes
 *                 settings such as subwallet ID and timeout duration.
 *
 * @returns An object containing:
 *   - `wallet`: The initialized highload wallet instance.
 *   - `deploy`: A function to deploy the wallet with a specified sender and value.
 *   - `send`: A function to send messages in batches, with options for verbosity, timeout,
 *             and error handling.
 */
export async function createHighloadWalletV3(
  tonClient: TonClient | TonClient4,
  mnemonic: string[],
  config?: Omit<Partial<HighloadWalletV3Config>, 'publicKey'>,
) {
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

  const send = async (
    args: SenderArguments | SenderArguments[],
    queryId: HighloadQueryId,
    options?: {
      verbose?: boolean;
      timeout?: number;
      on_fail?: (error: unknown) => void;
    },
  ): Promise<string> => {
    args = Array.isArray(args) ? args : [args];
    const messages: OutActionSendMsg[] = args.map((arg) => {
      return {
        type: 'sendMsg',
        mode: arg.sendMode ?? SendMode.NONE,
        outMsg: internal(arg),
      };
    });
    const createdAt = Math.floor(Date.now() / 1000) - 30;
    const timeout = options?.timeout ?? 128;

    const { ok, value: msgHash } = await retry(
      async () => {
        const msg = await wallet.sendBatch(keyPair.secretKey, messages, queryId, timeout, createdAt);
        const msgHash = getMessageHash(wallet.address.toString(), msg);
        return msgHash;
      },
      {
        attempts: 10,
        attemptInterval: 5000,
        verbose: options?.verbose ?? false,
        on_fail: options?.on_fail ?? ((error: unknown) => console.error('Failed to send message', error)),
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
