export interface Contract {
  id?: string;
  address: string;
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
  contracts?: Contract[];
  senders?: Sender[];
}
