import { mnemonicToWalletKey } from '@ton/crypto';
import { internal, SenderArguments, SendMode, TonClient, TonClient4, WalletContractV4 } from '@ton/ton';
import { getMessageHash } from '../../utils';

const MAINNET_WALLET_ID = -239;
const TESTNET_WALLET_ID = -3;

/**
 * Creates a Wallet V4 instance and provides a function to send transactions.
 *
 * This function initializes a Wallet V4 smart contract instance using the provided mnemonic
 * and connects it to the specified TON network (`mainnet` or `testnet`). It also provides
 * a `send` function to facilitate transaction execution.
 *
 * @param  tonClient - The TON client instance used to interact with the blockchain.
 * @param  mnemonic - The mnemonic phrase used to derive the wallet key pair.
 * @param  network - The network where the wallet should be deployed.
 *
 * @returns - An object containing:
 *   - `keyPair`: The derived key pair from the mnemonic.
 *   - `wallet`: The initialized Wallet V4 contract instance.
 *   - `send`: A function to send transactions using the wallet.
 *
 * @example
 * const tonClient = new TonClient({endpoint: '...'});
 * const wallet = await createWalletV4(tonClient, mnemonic, 'mainnet');
 * const txHash = await wallet.send({ to: recipient, value: '1000000000' });
 */
export async function createWalletV4(
  tonClient: TonClient4 | TonClient,
  mnemonic: string[],
  network: 'mainnet' | 'testnet',
) {
  const keyPair = await mnemonicToWalletKey(mnemonic);
  const walletId = network === 'mainnet' ? MAINNET_WALLET_ID : TESTNET_WALLET_ID;
  const workchain = 0; // NOTE: only support basechain now

  const wallet = tonClient.open(
    WalletContractV4.create({
      workchain,
      publicKey: keyPair.publicKey,
      walletId: walletId,
    }),
  );

  const send = async (
    args: SenderArguments | SenderArguments[],
    options?: {
      seqno?: number;
      sendMode?: SendMode;
      timeout?: number;
    },
  ): Promise<string> => {
    args = Array.isArray(args) ? args : [args];
    if (args.length > 4) {
      throw new Error(
        'Wallet V4 only supports 4 messages, consider using Wallet V5 or reduce the number of messages sent at once',
      );
    }
    const seqno = options?.seqno ?? (await wallet.getSeqno());
    const messages = wallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: args.map((arg) => {
        return internal(arg);
      }),
      sendMode: options?.sendMode ?? SendMode.PAY_GAS_SEPARATELY,
      timeout: options?.timeout ?? Math.floor(Date.now() / 1000) + 60, // 1 minute
    });
    await wallet.send(messages);
    const messageHash = getMessageHash(wallet.address.toString(), messages);
    return messageHash;
  };

  return {
    keyPair,
    wallet,
    send,
  };
}
