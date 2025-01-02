export interface Dapp {
  name: string;
  url: string;
  balance: number;
  contracts: Contract[];
}

export interface Contract {
  address: string;
}
