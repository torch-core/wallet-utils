import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  internal as internal_relaxed,
  MessageRelaxed,
  OutAction,
  OutActionSendMsg,
  Sender,
  SendMode,
  storeMessageRelaxed,
  storeOutList,
  toNano,
} from '@ton/core';
import { HighloadQueryId } from './highload-query-id';
import { sign } from '@ton/crypto';

const HIGHLOAD_WALLET_V3_CODE =
  'b5ee9c7241021001000228000114ff00f4a413f4bcf2c80b01020120020d02014803040078d020d74bc00101c060b0915be101d0d3030171b0915be0fa4030f828c705b39130e0d31f018210ae42e5a4ba9d8040d721d74cf82a01ed55fb04e030020120050a02027306070011adce76a2686b85ffc00201200809001aabb6ed44d0810122d721d70b3f0018aa3bed44d08307d721d70b1f0201200b0c001bb9a6eed44d0810162d721d70b15800e5b8bf2eda2edfb21ab09028409b0ed44d0810120d721f404f404d33fd315d1058e1bf82325a15210b99f326df82305aa0015a112b992306dde923033e2923033e25230800df40f6fa19ed021d721d70a00955f037fdb31e09130e259800df40f6fa19cd001d721d70a00937fdb31e0915be270801f6f2d48308d718d121f900ed44d0d3ffd31ff404f404d33fd315d1f82321a15220b98e12336df82324aa00a112b9926d32de58f82301de541675f910f2a106d0d31fd4d307d30cd309d33fd315d15168baf2a2515abaf2a6f8232aa15250bcf2a304f823bbf2a35304800df40f6fa199d024d721d70a00f2649130e20e01fe5309800df40f6fa18e13d05004d718d20001f264c858cf16cf8301cf168e1030c824cf40cf8384095005a1a514cf40e2f800c94039800df41704c8cbff13cb1ff40012f40012cb3f12cb15c9ed54f80f21d0d30001f265d3020171b0925f03e0fa4001d70b01c000f2a5fa4031fa0031f401fa0031fa00318060d721d300010f0020f265d2000193d431d19130e272b1fb00b585bf03';

export type HighloadWalletV3Config = {
  publicKey: Buffer;
  subwalletId: number;
  timeout: number;
};

export const TIMESTAMP_SIZE = 64;
export const TIMEOUT_SIZE = 22;

export function highloadWalletV3ConfigToCell(config: HighloadWalletV3Config): Cell {
  return beginCell()
    .storeBuffer(config.publicKey)
    .storeUint(config.subwalletId, 32)
    .storeUint(0, 1 + 1 + TIMESTAMP_SIZE)
    .storeUint(config.timeout, TIMEOUT_SIZE)
    .endCell();
}

export class HighloadWalletV3 implements Contract {
  constructor(
    readonly address: Address,
    readonly subwalletId?: number,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address, subwalletId: number) {
    return new HighloadWalletV3(address, subwalletId);
  }

  static createFromConfig(config: HighloadWalletV3Config, subwalletId?: number) {
    const workchain = 0;
    const data = highloadWalletV3ConfigToCell(config);
    const code = Cell.fromHex(HIGHLOAD_WALLET_V3_CODE);
    const init = { code, data };
    return new HighloadWalletV3(contractAddress(workchain, init), subwalletId, init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      bounce: false,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendExternalMessage(
    provider: ContractProvider,
    secretKey: Buffer,
    opts: {
      message: MessageRelaxed | Cell;
      mode: number;
      query_id: bigint | HighloadQueryId;
      createdAt: number;
      timeout: number;
    },
  ): Promise<Cell> {
    let messageCell: Cell;

    if (opts.message instanceof Cell) {
      messageCell = opts.message;
    } else {
      const messageBuilder = beginCell();
      messageBuilder.store(storeMessageRelaxed(opts.message));
      messageCell = messageBuilder.endCell();
    }
    const queryId = opts.query_id instanceof HighloadQueryId ? opts.query_id.getQueryId() : opts.query_id;

    const messageInner = beginCell()
      .storeUint(this.subwalletId || 0, 32)
      .storeRef(messageCell)
      .storeUint(opts.mode, 8)
      .storeUint(queryId, 23)
      .storeUint(opts.createdAt, TIMESTAMP_SIZE)
      .storeUint(opts.timeout, TIMEOUT_SIZE)
      .endCell();

    const msg = beginCell().storeBuffer(sign(messageInner.hash(), secretKey)).storeRef(messageInner).endCell();

    await provider.external(msg);
    return msg;
  }

  async sendBatch(
    provider: ContractProvider,
    secretKey: Buffer,
    messages: OutActionSendMsg[],
    query_id: HighloadQueryId,
    timeout: number,
    createdAt?: number,
    value: bigint = 0n,
  ) {
    if (createdAt == undefined) {
      createdAt = Math.floor(Date.now() / 1000) - 30;
    }
    return this.sendExternalMessage(provider, secretKey, {
      message: this.packActions(messages, value, query_id),
      mode: value > 0n ? SendMode.PAY_GAS_SEPARATELY : SendMode.CARRY_ALL_REMAINING_BALANCE,
      query_id: query_id,
      createdAt: createdAt,
      timeout: timeout,
    });
  }

  static createInternalTransferBody(opts: { actions: OutAction[] | Cell; queryId: HighloadQueryId }) {
    let actionsCell: Cell;
    if (opts.actions instanceof Cell) {
      actionsCell = opts.actions;
    } else {
      if (opts.actions.length > 254) {
        throw TypeError('Max allowed action count is 254. Use packActions instead.');
      }
      const actionsBuilder = beginCell();
      storeOutList(opts.actions)(actionsBuilder);
      actionsCell = actionsBuilder.endCell();
    }
    return beginCell()
      .storeUint(0xae42e5a4, 32) // internal_transfer
      .storeUint(opts.queryId.getQueryId(), 64)
      .storeRef(actionsCell)
      .endCell();
  }

  createInternalTransfer(opts: { actions: OutAction[] | Cell; queryId: HighloadQueryId; value: bigint }) {
    return internal_relaxed({
      to: this.address,
      value: opts.value,
      body: HighloadWalletV3.createInternalTransferBody(opts),
    });
  }

  packActions(messages: OutAction[], value: bigint = toNano('1'), query_id: HighloadQueryId) {
    let batch: OutAction[];
    if (messages.length > 254) {
      batch = messages.slice(0, 253);
      batch.push({
        type: 'sendMsg',
        mode: value > 0n ? SendMode.PAY_GAS_SEPARATELY : SendMode.CARRY_ALL_REMAINING_BALANCE,
        outMsg: this.packActions(messages.slice(253), value, query_id),
      });
    } else {
      batch = messages;
    }
    return this.createInternalTransfer({
      actions: batch,
      queryId: query_id,
      value,
    });
  }

  async getPublicKey(provider: ContractProvider): Promise<Buffer> {
    const res = (await provider.get('get_public_key', [])).stack;
    const pubKeyU = res.readBigNumber();
    return Buffer.from(pubKeyU.toString(16).padStart(32 * 2, '0'), 'hex');
  }

  async getSubwalletId(provider: ContractProvider): Promise<number> {
    const res = (await provider.get('get_subwallet_id', [])).stack;
    return res.readNumber();
  }

  async getTimeout(provider: ContractProvider): Promise<number> {
    const res = (await provider.get('get_timeout', [])).stack;
    return res.readNumber();
  }

  async getLastCleaned(provider: ContractProvider): Promise<number> {
    const res = (await provider.get('get_last_clean_time', [])).stack;
    return res.readNumber();
  }

  async getProcessed(provider: ContractProvider, queryId: HighloadQueryId, needClean = true): Promise<boolean> {
    const res = (
      await provider.get('processed?', [
        { type: 'int', value: queryId.getQueryId() },
        {
          type: 'int',
          value: needClean ? -1n : 0n,
        },
      ])
    ).stack;
    return res.readBoolean();
  }
}
