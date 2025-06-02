export interface Dapp {
  id?: string;
  name: string;
  url: string;
  balance: number;
  totalUsed?: number;
  terminationDate?: string;
  active?: boolean;
  createdAt?: string;
  contracts: Contract[];
  senders: Sender[];
  apiKeys: ApiKey[];
}

export interface Contract {
  id?: string;
  address: string;
  hasSwap: boolean;
  swapAddress?: string;
}

export interface Sender {
  id?: string;
  address: string;
}

export interface ApiKey {
  id?: string;
  key: string;
  name: string;
  dappId?: string;
  createdAt?: string;
} 