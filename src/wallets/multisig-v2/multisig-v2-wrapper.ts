import {
  Address,
  beginCell,
  Cell,
  Dictionary,
  MessageRelaxed,
  storeMessageRelaxed,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  internal,
  toNano,
} from '@ton/core';
import { Op, Params } from './constants';
import { orderConfigToCell, Order as OrderContract } from './order-wrapper';

const MULTISIG_CODE =
  'b5ee9c7241021201000495000114ff00f4a413f4bcf2c80b010201620802020120060302016605040159b0c9fe0a00405c00b21633c5804072fff26208b232c07d003d0032c0325c007e401d3232c084b281f2fff274201100f1b0cafb513434ffc04074c1c0407534c1c0407d01348000407448dfdc2385d4449e3d1f1be94c886654c0aebcb819c0a900b7806cc4b99b08548c2ebcb81b085fdc2385d4449e3d1f1be94c886654c0aebcb819c0a900b7806cc4b99b084c08b0803cb81b8930803cb81b5490eefcb81b40648cdfe440f880e00143bf74ff6a26869ff8080e9838080ea69838080fa0269000080e8881aaf8280fc11d0c0700c2f80703830cf94130038308f94130f8075006a18127f801a070f83681120670f836a0812bec70f836a0811d9870f836a022a60622a081053926a027a070f83823a481029827a070f838a003a60658a08106e05005a05005a0430370f83759a001a002cad033d0d3030171b0925f03e0fa403022d749c000925f03e002d31f0120c000925f04e001d33f01ed44d0d3ff0101d3070101d4d3070101f404d2000101d1288210f718510fbae30f054443c8500601cbff500401cb0712cc0101cb07f4000101ca00c9ed540d09029a363826821075097f5dba8eba068210a32c59bfba8ea9f82818c705f2e06503d4d1103410364650f8007f8e8d2178f47c6fa5209132e30d01b3e65b10355034923436e2505413e30d40155033040b0a02e23604d3ff0101d32f0101d3070101d3ff0101d4d1f8285005017002c858cf160101cbffc98822c8cb01f400f400cb00c97001f90074c8cb0212ca07cbffc9d01bc705f2e06526f9001aba5193be19b0f2e06607f823bef2e06f44145056f8007f8e8d2178f47c6fa5209132e30d01b3e65b110b01fa02d74cd0d31f01208210f1381e5bba8e6a82101d0cfbd3ba8e5e6c44d3070101d4217f708e17511278f47c6fa53221995302baf2e06702a402de01b312e66c2120c200f2e06e23c200f2e06d5330bbf2e06d01f404217f708e17511278f47c6fa53221995302baf2e06702a402de01b312e66c2130d155239130e2e30d0c001030d307d402fb00d1019e3806d3ff0128b38e122084ffba923024965305baf2e3f0e205a405de01d2000101d3070101d32f0101d4d1239126912ae2523078f40e6fa1f2e3ef1ec705f2e3ef20f823bef2e06f20f823a1546d700e01d4f80703830cf94130038308f94130f8075006a18127f801a070f83681120670f836a0812bec70f836a0811d9870f836a022a60622a081053926a027a070f83823a481029827a070f838a003a60658a08106e05005a05005a0430370f83759a001a01cbef2e064f82850030f02b8017002c858cf160101cbffc98822c8cb01f400f400cb00c97021f90074c8cb0212ca07cbffc9d0c882109c73fba2580a02cb1fcb3f2601cb075250cc500b01cb2f1bcc2a01ca000a951901cb07089130e2102470408980188050db3c111000928e45c85801cb055005cf165003fa0254712323ed44ed45ed479f5bc85003cf17c913775003cb6bcccced67ed65ed64747fed11987601cb6bcc01cf17ed41edf101f2ffc901fb00db060842026305a8061c856c2ccf05dcb0df5815c71475870567cab5f049e340bcf59251f3ada4ac42';

const ORDER_CODE =
  'b5ee9c7241020c01000376000114ff00f4a413f4bcf2c80b01020162030200c7a1c771da89a1f48003f0c3a7fe03f0c441ae9380011c2c60dbf0c6dbf0c8dbf0cadbf0ccdbf0cedbf0d0dbf0d31c45a60e03f0c7a40003f0c9a803f0cba7fe03f0cda60e03f0cfa65e03f0d1a803f0d3a3c5f083f085f087f089f08bf08df08ff091f09303f8d03331d0d3030171b0915be0fa403001d31f01ed44d0fa4001f861d3ff01f86220d749c0008e16306df8636df8646df8656df8666df8676df8686df8698e22d30701f863d20001f864d401f865d3ff01f866d30701f867d32f01f868d401f869d1e220c000e30201d33f012282109c73fba2bae302028210a762230f070504014aba8e9bd3070101d1f845521078f40e6fa1f2e06a5230c705f2e06a59db3ce05f03840ff2f00802fe32f84113c705f2e068f8436e8ef101d30701f86370f864d401f86570f86670f867d32f01f868f848f823bef2e06fd401f869d200018e99d30701aef84621b0f2d06bf847a4f867f84601b1f86601db3c9131e2d1f849f846f845c8f841cf16f84201cbfff84301cb07f84401ca00cccbfff84701cb07f84801cb2fccc9ed540a06018ce001d30701f843baf2e069d401f900f845f900baf2e069d32f01f848baf2e069d401f900f849f900baf2e069d20001f2e069d3070101d1f845521078f40e6fa1f2e06a58db3c0801c83020d74ac0008e23c8708e1a22d7495230d71912cf1622d74a9402d74cd093317f58e2541220e63031c9d0df840f018b7617070726f76658c705f2f420707f8e19f84578f47c6fa5209b5243c70595317f327001de9132e201b3e632f2e06af82512db3c08026e8f335ced44ed45ed478e983170c88210afaf283e580402cb1fcb3fcb1f80108050db3ced67ed65ed64727fed118aed41edf101f2ffdb030b0902b4f844f2d07002aef84621b0f2d06bf847a4f867f84601b1f86670c8821082609bf62402cb1fcb3f80108050db3cdb3cf849f846f845c8f841cf16f84201cbfff84301cb07f84401ca00cccbfff84701cb07f84801cb2fccc9ed540b0a0180f847f843ba8eb6f84170f849c8821075097f5d580502cb1fcb3ff84201cbfff84801cb2ff84701cb07f845f90001cbff13cc128010810090db3c7ff8649130e20b00888e40c85801cb055004cf1658fa02547120ed44ed45ed479d5bc85003cf17c9127158cb6acced67ed65ed64737fed11977001cb6a01cf17ed41edf101f2ffc901fb00db0545f8021c';

export type Module = {
  address: Address;
  module: Cell;
};
export type MultisigConfig = {
  threshold: number;
  signers: Array<Address>;
  proposers: Array<Address>;
  allowArbitrarySeqno: boolean;
};

export type TransferRequest = { type: 'transfer'; sendMode: SendMode; message: MessageRelaxed };
export type UpdateRequest = {
  type: 'update';
  threshold: number;
  signers: Array<Address>;
  proposers: Array<Address>;
};

export type Action = TransferRequest | UpdateRequest;
export type Order = Array<Action>;

function arrayToCell(arr: Array<Address>): Dictionary<number, Address> {
  const dict = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Address());
  for (let i = 0; i < arr.length; i++) {
    dict.set(i, arr[i]);
  }
  return dict;
}

function cellToArray(addrDict: Cell | null): Array<Address> {
  let resArr: Array<Address> = [];
  if (addrDict !== null) {
    const dict = Dictionary.loadDirect(Dictionary.Keys.Uint(8), Dictionary.Values.Address(), addrDict);
    resArr = dict.values();
  }
  return resArr;
}

export function multisigConfigToCell(config: MultisigConfig): Cell {
  return beginCell()
    .storeUint(0, Params.bitsize.orderSeqno)
    .storeUint(config.threshold, Params.bitsize.signerIndex)
    .storeRef(beginCell().storeDictDirect(arrayToCell(config.signers)))
    .storeUint(config.signers.length, Params.bitsize.signerIndex)
    .storeDict(arrayToCell(config.proposers))
    .storeBit(config.allowArbitrarySeqno)
    .endCell();
}

export class Multisig implements Contract {
  public orderSeqno: number;

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
    readonly configuration?: MultisigConfig,
  ) {
    this.orderSeqno = 0;
  }

  static createFromConfig(config: MultisigConfig) {
    const workchain = 0;
    const code = Cell.fromHex(MULTISIG_CODE);
    const data = multisigConfigToCell(config);
    const init = { code, data };
    return new Multisig(contractAddress(workchain, init), init, config);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(0, Params.bitsize.op).storeUint(0, Params.bitsize.queryId).endCell(),
    });
  }

  static packTransferRequest(transfer: TransferRequest) {
    const message = beginCell().store(storeMessageRelaxed(transfer.message)).endCell();
    return beginCell()
      .storeUint(Op.actions.send_message, Params.bitsize.op)
      .storeUint(transfer.sendMode, 8)
      .storeRef(message)
      .endCell();
  }

  static packUpdateRequest(update: UpdateRequest) {
    return beginCell()
      .storeUint(Op.actions.update_multisig_params, Params.bitsize.op)
      .storeUint(update.threshold, Params.bitsize.signerIndex)
      .storeRef(beginCell().storeDictDirect(arrayToCell(update.signers)))
      .storeDict(arrayToCell(update.proposers))
      .endCell();
  }

  packLarge(actions: Array<Action>, address?: Address) {
    return Multisig.packLarge(actions, address ?? this.address);
  }

  static packLarge(actions: Array<Action>, address: Address): Cell {
    const packChained = function (req: Cell): TransferRequest {
      return {
        type: 'transfer',
        sendMode: 1,
        message: internal({
          to: address,
          value: toNano('0.01'),
          body: beginCell()
            .storeUint(Op.multisig.execute_internal, Params.bitsize.op)
            .storeUint(0, Params.bitsize.queryId)
            .storeRef(req)
            .endCell(),
        }),
      };
    };
    let tailChunk: Cell | null = null;
    let chunkCount = Math.ceil(actions.length / 254);
    let actionProcessed = 0;
    let lastSz = actions.length % 254;
    while (chunkCount--) {
      let chunkSize: number;
      if (lastSz > 0) {
        chunkSize = lastSz;
        lastSz = 0;
      } else {
        chunkSize = 254;
      }

      // Processing chunks from tail to head to evade recursion
      const chunk = actions.slice(-(chunkSize + actionProcessed), actions.length - actionProcessed);

      if (tailChunk === null) {
        tailChunk = Multisig.packOrder(chunk);
      } else {
        // Every next chunk has to be chained with execute_internal
        tailChunk = Multisig.packOrder([...chunk, packChained(tailChunk)]);
      }

      actionProcessed += chunkSize;
    }

    if (tailChunk === null) {
      throw new Error('Something went wrong during large order pack');
    }

    return tailChunk;
  }

  static packOrder(actions: Array<Action>) {
    const order_dict = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Cell());
    if (actions.length > 255) {
      throw new Error('For action chains above 255, use packLarge method');
    } else {
      // pack transfers to the order_body cell
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const actionCell =
          action.type === 'transfer' ? Multisig.packTransferRequest(action) : Multisig.packUpdateRequest(action);
        order_dict.set(i, actionCell);
      }
      return beginCell().storeDictDirect(order_dict).endCell();
    }
  }

  static newOrderMessage(
    actions: Order | Cell,
    expirationDate: number,
    isSigner: boolean,
    addrIdx: number,
    order_id: bigint = 115792089237316195423570985008687907853269984665640564039457584007913129639935n,
    query_id: number | bigint = 0,
  ) {
    const msgBody = beginCell()
      .storeUint(Op.multisig.new_order, Params.bitsize.op)
      .storeUint(query_id, Params.bitsize.queryId)
      .storeUint(order_id, Params.bitsize.orderSeqno)
      .storeBit(isSigner)
      .storeUint(addrIdx, Params.bitsize.signerIndex)
      .storeUint(expirationDate, Params.bitsize.time);

    if (actions instanceof Cell) {
      return msgBody.storeRef(actions).endCell();
    }

    if (actions.length == 0) {
      throw new Error("Order list can't be empty!");
    }
    const order_cell = Multisig.packOrder(actions);
    return msgBody.storeRef(order_cell).endCell();
  }

  async sendNewOrder(
    provider: ContractProvider,
    via: Sender,
    actions: Order | Cell,
    expirationDate: number,
    value: bigint = toNano('1'),
    addrIdx?: number,
    isSigner?: boolean,
    seqno?: bigint,
  ) {
    if (seqno == undefined) {
      seqno = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
    }
    if (this.configuration === undefined) {
      throw new Error('Configuration is not set: use createFromConfig or loadConfiguration');
    }
    // check that via.address is in signers
    // We can only check in advance when address is known. Otherwise we have to trust isSigner flag
    if (via.address !== undefined) {
      const addrCmp = (x: Address) => x.equals(via.address!);
      addrIdx = this.configuration.signers.findIndex(addrCmp);
      if (addrIdx >= 0) {
        isSigner = true;
      } else {
        addrIdx = this.configuration.proposers.findIndex(addrCmp);
        if (addrIdx < 0) {
          throw new Error('Sender is not a signer or proposer');
        }
        isSigner = false;
      }
    } else if (isSigner === undefined || addrIdx == undefined) {
      throw new Error('If sender address is not known, addrIdx and isSigner parameres required');
    }

    let newActions: Cell | Order;

    if (actions instanceof Cell) {
      newActions = actions;
    } else if (actions.length > 255) {
      newActions = Multisig.packLarge(actions, this.address);
    } else {
      newActions = Multisig.packOrder(actions);
    }
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value,
      body: Multisig.newOrderMessage(newActions, expirationDate, isSigner, addrIdx, seqno),
    });
  }

  getOrder(_: ContractProvider, orderSeqno: bigint): OrderContract {
    const code_raw = Cell.fromHex(ORDER_CODE);
    let lib_prep = beginCell().storeUint(2, 8).storeBuffer(code_raw.hash()).endCell();
    const code = new Cell({ exotic: true, bits: lib_prep.bits, refs: lib_prep.refs });
    const data = orderConfigToCell({ multisig: this.address, orderSeqno });
    const init = { code, data };
    const address = contractAddress(0, init);
    return OrderContract.createFromAddress(address);
  }

  async getOrderEstimate(provider: ContractProvider, order: Order, expiration_date: bigint) {
    const orderCell = Multisig.packOrder(order);
    const { stack } = await provider.get('get_order_estimate', [
      { type: 'cell', cell: orderCell },
      { type: 'int', value: expiration_date },
    ]);
    return stack.readBigNumber();
  }

  async getMultisigData(provider: ContractProvider) {
    const { stack } = await provider.get('get_multisig_data', []);
    const nextOrderSeqno = stack.readBigNumber();
    const threshold = stack.readBigNumber();
    const signers = cellToArray(stack.readCellOpt());
    const proposers = cellToArray(stack.readCellOpt());
    return { nextOrderSeqno, threshold, signers, proposers };
  }
}
