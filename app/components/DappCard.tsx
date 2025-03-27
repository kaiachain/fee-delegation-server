import { ethers } from "ethers";
import React, { useState } from "react";
import EditModal from "./EditModal";
import { useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { Contract, Dapp } from "@/types";

interface DappCardProps {
  dapp: Dapp;
  children?: React.ReactNode;
}

export const DappCard: React.FC<DappCardProps> = ({ dapp, children }) => {
  const [dappInfo, setDappInfo] = useState<any>(dapp);
  const [isContractEditModalOpen, setIsContractEditModalOpen] = useState(false);
  const [isSenderEditModalOpen, setIsSenderEditModalOpen] = useState(false);
  const [isBalanceEditModalOpen, setIsBalanceEditModalOpen] = useState(false);
  const [isUrlEditModalOpen, setIsUrlEditModalOpen] = useState(false);
  const { data: session } = useSession();

  const convertTime = (time: string) => {
    const readableDate = new Date(time).toLocaleString("ko-KR", {
      timeZone: "UTC",
    });
    return readableDate;
  };

  const removeContract = async (contract: string) => {
    const id = dappInfo.contracts.find((c: any) => c.address === contract).id;
    const result = await fetchData(
      "/contracts",
      {
        method: "DELETE",
        body: { id },
      },
      session
    );

    if (!result.status) {
      return;
    }

    const updatedContracts = dappInfo.contracts.filter(
      (c: any) => c.address !== contract
    );
    const updatedDapp = { ...dappInfo, contracts: updatedContracts };
    setDappInfo(updatedDapp);
  };

  const removeSender = async (sender: string) => {
    const id = dappInfo.senders.find((s: any) => s.address === sender).id;
    const result = await fetchData(
      "/senders",
      {
        method: "DELETE",
        body: { id },
      },
      session
    );

    if (!result.status) {
      return;
    }

    const updatedSenders = dappInfo.senders.filter(
      (s: any) => s.address !== sender
    );
    const updatedDapp = { ...dappInfo, senders: updatedSenders };
    setDappInfo(updatedDapp);
  };

  const addSender = async (sender: string) => {
    setIsSenderEditModalOpen(false);
    if (!sender || !ethers.isAddress(sender)) return;
    if (
      dappInfo.senders.some(
        (s: any) => s.address.toLowerCase() === sender.toLowerCase()
      )
    ) {
      alert("Sender already exists");
      return;
    }

    const result = await fetchData(
      "/senders",
      {
        method: "POST",
        body: { dappId: dappInfo.id, address: sender },
      },
      session
    );

    if (!result.status) {
      return;
    }

    const addedSender = { id: result.data.id, address: result.data.address };
    setDappInfo({
      ...dappInfo,
      senders: [...dappInfo.senders, addedSender],
    });
  };

  const addContract = async (contract: string) => {
    setIsContractEditModalOpen(false);
    if (!contract || !ethers.isAddress(contract)) return;
    if (
      dappInfo.contracts.some(
        (c: any) => c.address.toLowerCase() === contract.toLowerCase()
      )
    ) {
      alert("Contract already exists");
      return;
    }

    const result = await fetchData(
      "/contracts",
      {
        method: "POST",
        body: { dappId: dappInfo.id, address: contract },
      },
      session
    );

    if (!result.status) {
      return;
    }

    const addedContract = { id: result.data.id, address: result.data.address };
    setDappInfo({
      ...dappInfo,
      contracts: [...dappInfo.contracts, addedContract],
    });
  };

  const updateBalance = async (balance: string) => {
    setIsBalanceEditModalOpen(false);
    const result = await fetchData(
      "/dapps",
      {
        method: "PUT",
        body: { id: dappInfo.id, balance },
      },
      session
    );
    if (!result.status) {
      return;
    }
    setDappInfo({ ...dappInfo, balance: result.balance });
  };

  const updateUrl = async (url: string) => {
    setIsUrlEditModalOpen(false);
    const result = await fetchData(
      "/dapps",
      {
        method: "PUT",
        body: { id: dappInfo.id, url },
      },
      session
    );

    if (!result.status) {
      return;
    }

    setDappInfo({ ...dappInfo, url });
  };

  return (
    <div className="flex flex-col bg-slate-300 mx-10 my-2 px-8 py-5 rounded-3xl w-[80%] relative dark:text-black">
      <h2 className="text-2xl font-bold mb-4">{dappInfo.name}</h2>
      <div className="flex flex-row gap-8">
        <p className="flex flex-row items-center font-bold gap-2">
          {dappInfo.url}
          <button onClick={() => setIsUrlEditModalOpen(true)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
        </p>
        <p className="font-bold">
          Total Used:
          <span className="font-thin ml-1">{dappInfo.totalUsed} KAIA</span>
        </p>
        <p className="flex flex-row font-bold items-center gap-2">
          Balance:{" "}
          <span className="font-thin ml-1">{dappInfo.balance} KAIA</span>
          <button onClick={() => setIsBalanceEditModalOpen(true)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
        </p>
        <p className="font-bold">
          Created At:
          <span className="font-thin ml-1">
            {convertTime(dapp.createdAt as string)}
          </span>
        </p>
      </div>
      <h3 className="text-lg font-bold mt-4">Contracts</h3>
      <ul className="flex flex-wrap items-center gap-2 mt-2">
        {dappInfo.contracts.map((contract: Contract) => (
          <li
            className="flex items-center justify-center p-2 bg-slate-400 rounded-lg relative group pr-10 font-mono"
            key={contract.address}
          >
            {contract.address.toLowerCase()}
            <button
              className="absolute top-1/2 right-2 -translate-y-1/2 hidden group-hover:block bg-red-200 text-white text-xs px-1 py-0.5 h-5 w-5 rounded-full hover:bg-red-400"
              aria-label="Delete"
              onClick={() => removeContract(contract.address)}
              key={contract.id}
            >
              x
            </button>
          </li>
        ))}
        <button
          className="flex items-center justify-center h-3 w-3 bg-slate-400 text-xs rounded-full font-bold hover:bg-slate-50"
          onClick={() => setIsContractEditModalOpen(true)}
        >
          +
        </button>
      </ul>
      <h3 className="text-lg font-bold mt-4">Senders</h3>
      <ul className="flex flex-wrap items-center gap-2 mt-2">
        {dappInfo.senders.map((sender: any) => (
          <li
            className="flex items-center justify-center p-2 bg-slate-400 rounded-lg relative group pr-10 font-mono"
            key={sender.address}
          >
            {sender.address.toLowerCase()}
            <button
              className="absolute top-1/2 right-2 -translate-y-1/2 hidden group-hover:block bg-red-200 text-white text-xs px-1 py-0.5 h-5 w-5 rounded-full hover:bg-red-400"
              aria-label="Delete"
              onClick={() => removeSender(sender.address)}
            >
              x
            </button>
          </li>
        ))}
        <button
          className="flex items-center justify-center h-3 w-3 bg-slate-400 text-xs rounded-full font-bold hover:bg-slate-50"
          onClick={() => setIsSenderEditModalOpen(true)}
        >
          +
        </button>
      </ul>
      <EditModal
        title="Add Contract"
        isModalOpen={isContractEditModalOpen}
        setIsModalOpen={setIsContractEditModalOpen}
        submitData={addContract}
        placeholder="Enter contract address"
        initialValue=""
      />
      <EditModal
        title="Add Sender"
        isModalOpen={isSenderEditModalOpen}
        setIsModalOpen={setIsSenderEditModalOpen}
        submitData={addSender}
        placeholder="Enter sender address"
        initialValue=""
      />
      <EditModal
        title="Charge Balance"
        isModalOpen={isBalanceEditModalOpen}
        setIsModalOpen={setIsBalanceEditModalOpen}
        submitData={updateBalance}
        placeholder="How much to charge?"
        initialValue="2000"
      />
      <EditModal
        title="Edit URL"
        isModalOpen={isUrlEditModalOpen}
        setIsModalOpen={setIsUrlEditModalOpen}
        submitData={updateUrl}
        placeholder={dapp.url}
        initialValue={dapp.url}
      />
      {children}
    </div>
  );
};
