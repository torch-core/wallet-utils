import { internal, Sender, SenderArguments, SendMode, toNano, TonClient, TonClient4 } from '@ton/ton';
import { Multisig, MultisigConfig, TransferRequest } from './multisig-v2-wrapper';
import { Order } from './order-wrapper';
import { getSecureRandomBytes } from '@ton/crypto';

/**
 * Creates a MultisigV2 wallet instance using the provided TonClient and configuration.
 *
 * This function initializes a multisig wallet by opening it with the given configuration.
 * It provides methods to deploy the wallet, send orders, and approve orders.
 *
 * @param tonClient - The TonClient instance used to interact with the blockchain.
 * @param config - The configuration object for the multisig wallet, which includes settings
 *                 such as the list of signers and whether arbitrary sequence numbers are allowed.
 *
 * @returns An object containing:
 *   - `wallet`: The initialized multisig wallet instance.
 *   - `deploy`: A function to deploy the wallet with a specified sender and value.
 *   - `sendOrder`: A function to send an order from the wallet, with options for timeout and value.
 *   - `approve`: A function to approve an order, requiring the sender to be one of the configured signers.
 */
export function createMultisigV2(tonClient: TonClient | TonClient4, config: MultisigConfig) {
  const wallet = tonClient.open(Multisig.createFromConfig(config));

  const deploy = async (sender: Sender, value: bigint = toNano('0.05')) => {
    await wallet.sendDeploy(sender, value);
  };

  const sendOrder = async (
    sender: Sender,
    args: SenderArguments | SenderArguments[],
    options?: {
      timeout?: number;
      value?: bigint;
    },
  ): Promise<Order> => {
    args = Array.isArray(args) ? args : [args];
    let orderSeqno: bigint = 0n;

    if (!sender.address) {
      throw new Error('Sender address is required');
    }

    const argToTransferRequest = (arg: SenderArguments): TransferRequest => {
      return {
        type: 'transfer',
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        message: internal(arg),
      };
    };

    const generateOrderSeqno = async (): Promise<bigint> => {
      const buffer = await getSecureRandomBytes(64);
      return buffer.readBigUInt64BE(0);
    };

    if (config.allowArbitrarySeqno) {
      // random generate bigint 256 by ton crypto
      orderSeqno = await generateOrderSeqno();
    } else {
      const { nextOrderSeqno } = await wallet.getMultisigData();
      orderSeqno = nextOrderSeqno;
    }

    const timeout = options?.timeout ?? Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    await wallet.sendNewOrder(
      sender,
      args.map(argToTransferRequest),
      timeout,
      options?.value,
      undefined,
      undefined,
      orderSeqno,
    );
    const orderContract = wallet.getOrder(orderSeqno);
    return orderContract;
  };

  const approve = async (
    sender: Sender,
    orderContract: Order,
    options?: {
      value?: bigint;
    },
  ) => {
    if (!sender.address) {
      throw new Error('Sender address is required');
    }

    const signerIdx = config.signers.findIndex((signer) => signer.equals(sender.address!));
    if (signerIdx === -1) {
      throw new Error('Sender address is not a signer');
    }

    await tonClient.open(orderContract).sendApprove(sender, signerIdx, options?.value);
  };

  return {
    wallet,
    deploy,
    sendOrder,
    approve,
  };
}
