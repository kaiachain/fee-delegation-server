// "use client";

// import { useEffect } from "react";

// export default function Home() {
//   useEffect(() => {
//     window.location.href = "/rank";
//   }, []);
//   return <div></div>;
// }

"use client";

import { useEffect, useState } from "react";
// import { OKXUniversalConnectUI } from "@okxconnect/ui";
import DappPortalSDK, { PaymentProvider } from "@linenext/dapp-portal-sdk";
import { ethers } from "ethers";
import { TxType } from "@kaiachain/ethers-ext";
import { Web3Provider } from "@kaiachain/ethers-ext/v6";

declare global {
  interface Window {
    klaytn: any;
  }
}

export default function Home() {
  const [provider, setProvider] = useState<Web3Provider | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [pProvider, setPProvider] = useState<PaymentProvider | null>(null);

  // const openModal = async () => {
  //   const universalUi = await OKXUniversalConnectUI.init({
  //     dappMetaData: {
  //       icon: "https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png",
  //       name: "OKX Connect Demo",
  //     },
  //     actionsConfiguration: {
  //       returnStrategy: "tg://resolve",
  //       modals: "all",
  //       tmaReturnUrl: "back",
  //     },
  //     language: "en_US",
  //   });

  //   const session = await universalUi.openModal({
  //     namespaces: {
  //       eip155: {
  //         chains: ["eip155:1"],
  //         defaultChain: "1",
  //       },
  //     },
  //     optionalNamespaces: {
  //       eip155: {
  //         chains: ["eip155:43114"],
  //       },
  //     },
  //   });
  // };

  const initDappPortal = async () => {
    const sdk = await DappPortalSDK.init({
      clientId: "30eb8e86-1096-44ef-b9db-f7efa00f9b89",
      chainId: "1001",
      // chainId: "8217",
    });
    const provider = new Web3Provider(sdk.getWalletProvider());
    // const provider = new Web3Provider(window.ethereum);
    // const provider = new Web3Provider(window.klaytn);
    const accounts = await provider.send("eth_requestAccounts", []);
    const pProvider = sdk.getPaymentProvider();
    setProvider(provider);
    setAccounts(accounts);
    setPProvider(pProvider);
  };

  const valueTransfer = async () => {
    if (!provider) return;
    const accountAddress = accounts[0];
    console.log(accountAddress);
    const receipt = await provider.send("eth_sendTransaction", [
      {
        from: accountAddress,
        to: accountAddress,
        value: "100000",
      },
    ]);
    const r = await receipt.wait();
    console.log(r);
  };

  const feeDelegatedValueTransfer = async () => {
    if (!provider) return;
    const accountAddress = accounts[0];
    const tx = {
      typeInt: TxType.FeeDelegatedValueTransfer, // fee delegated value transfer
      from: accountAddress,
      to: accountAddress,
      value: "0x10",
      // value: 10,
      feePayer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    };
    const userSignedTx = await provider.send("kaia_signTransaction", [tx]);
    const response = await fetch("/api/signAsFeePayer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userSignedTx }),
    });
    const data = await response.json();
    console.log(data);
  };

  const feeDelegatedSmartContractExecution = async () => {
    if (!provider) return;
    const abi =
      '[{"inputs":[{"internalType":"uint256","name":"initNumber","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"number","type":"uint256"}],"name":"SetNumber","type":"event"},{"inputs":[],"name":"increment","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"number","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"newNumber","type":"uint256"}],"name":"setNumber","outputs":[],"stateMutability":"nonpayable","type":"function"}]';
    const contractAddr = "0x95Be48607498109030592C08aDC9577c7C2dD505";
    const contract = new ethers.Contract(
      contractAddr,
      abi,
      await provider.getSigner(0)
    );
    // const txHash = await contract.increment();
    // await txHash.wait();

    const contractCallData = await contract.increment.populateTransaction();
    console.log(contractCallData);

    const accountAddress = accounts[0];
    console.log(accountAddress);
    const tx = {
      typeInt: TxType.FeeDelegatedSmartContractExecution, // fee delegated smart contract execution
      // type: TxType.FeeDelegatedSmartContractExecution,
      from: accountAddress,
      to: contractCallData.to,
      input: contractCallData.data,
      // data: contractCallData.data,
      value: "0x0",
      feePayer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      gas: "0x8000",
    };
    const userSignedTx = await provider.send("kaia_signTransaction", [tx]);

    const response = await fetch("/api/signAsFeePayer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userSignedTx }),
      // body: JSON.stringify({
      //   userSignedTx: {
      //     raw: "0x31f8a42985066720b300825208949b86c3c4caa348db6dd0a2b0b9423c6ff53bed4a871000000000000094d57c74c3d19bf13212ca4d60b452201fe7c3179684d09de08af847f8458207f6a02395bbf2c825b48e08b1e6b918402ff8b9070fc9d6f77f87a624924bccbdb3e3a01e3f251caebbeda337d149fa8e0b98e55c2f21e56c33b0cb3f135fa47aa73a94940000000000000000000000000000000000000000c4c3018080",
      //   },
      // }),
    });
    const data = await response.json();
    console.log(data);
  };

  const personalSignVerify = async () => {
    if (!provider) return;
    const msg = "hello";
    const accountAddress = accounts[0];
    const hexMsg = ethers.hexlify(ethers.toUtf8Bytes(msg));
    try {
      const sig = await provider.send("personal_sign", [
        hexMsg,
        accountAddress,
      ]);

      const addr = ethers.verifyMessage(msg, sig);
      console.log(addr, accountAddress);

      console.log(sig);
    } catch (error) {
      console.log(error);
    }
  };

  const checkBalance = async () => {
    // It's an address of contracts or senders you registered for fee delegation
    const address = "0x63d4f17d2a8a729fd050f7679d961b1dfbb1e3af";

    const result = await fetch(`/api/balance?address=${address}`);
    const isEnough = (await result.json()).data;
    console.log(isEnough ? "enough balance" : "not enough balance");
  };

  useEffect(() => {
    // openModal();
    initDappPortal();
  }, []);
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen mt-16">
      <button onClick={valueTransfer}>value transfer sign</button>
      <button onClick={feeDelegatedValueTransfer}>
        fee delegated value transfer sign
      </button>
      <button onClick={feeDelegatedSmartContractExecution}>
        fee delegated smart contract execution
      </button>
      <button onClick={personalSignVerify}>personal_sign</button>
      <button onClick={checkBalance}>check balance</button>
    </div>
  );
}
