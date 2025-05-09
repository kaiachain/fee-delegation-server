export interface Contract {
  id?: string;
  address: string;
  hasSwap?: boolean;
  swapAddress?: string;
}

export interface Sender {
  id?: string;
  address: string;
}

export interface Dapp {
  id?: string;
  name?: string;
  url?: string;
  totalUsed?: number;
  balance?: number;
  createdAt?: string;
  terminationDate?: string;
  active?: boolean;
  contracts?: Contract[];
  senders?: Sender[];
}
