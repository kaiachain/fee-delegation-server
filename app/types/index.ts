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
  emailAlerts?: EmailAlert[];
  contractUsages?: ContractUsage[];
}

export interface Contract {
  id?: string;
  address: string;
  hasSwap: boolean;
  swapAddress?: string;
  active?: boolean;
}

export interface Sender {
  id?: string;
  address: string;
  active?: boolean;
}

export interface ApiKey {
  id?: string;
  key: string;
  name: string;
  dappId?: string;
  createdAt?: string;
  active?: boolean;
}

export interface EmailAlert {
  id?: string;
  email: string;
  balanceThreshold: string;
  isActive: boolean;
  dappId?: string;
  createdAt?: string;
}

export interface EmailAlertLog {
  id?: string;
  email: string;
  dappId: string;
  dappName: string;
  newBalance: string;
  threshold: string;
  sentAt: string;
  isRead: boolean;
} 

export interface ContractUsage {
  contractAddress: string;
  totalUsed: string;
  updatedAt?: string;
}

export interface TransactionLogEntry {
  contractAddress: string;
  senderAddress: string;
  usedFee: string;
  gasUsed: string;
  gasPrice: string;
  txHash: string;
  blockNumber: string;
  createdAt: string;
}