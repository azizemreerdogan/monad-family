import { EventEmitter } from 'events';

export class MockProvider extends EventEmitter {
  private _blockNumber = 1000000;

  async getNetwork() {
    return { chainId: 41454n, name: 'monad-testnet' };
  }

  async getBlockNumber(): Promise<number> {
    return this._blockNumber++;
  }

  async getBalance(_address: string): Promise<bigint> {
    return BigInt('10000000000000000000'); // 10 ETH in wei
  }

  async getTransactionReceipt(_hash: string) {
    return { status: 1, transactionHash: _hash };
  }

  async getFeeData() {
    return {
      gasPrice: BigInt('1000000000'),
      maxFeePerGas: BigInt('2000000000'),
      maxPriorityFeePerGas: BigInt('1000000000'),
    };
  }
}
