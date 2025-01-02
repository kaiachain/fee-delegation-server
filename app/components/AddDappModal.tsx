"use client";

import { ethers } from "ethers";
import fetchData from "@/lib/apiUtils";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import Modal from "react-modal";
import { Contract, Dapp } from "@/types";

interface AddDappModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  onDappAdd: (dapp: Dapp) => void;
}

export default function AddDappModal({
  isModalOpen,
  setIsModalOpen,
  onDappAdd,
}: AddDappModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [contractAddress, setContractAddress] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const { data: session } = useSession();

  const handleAddContract = () => {
    if (contractAddress.trim() && ethers.isAddress(contractAddress)) {
      setContracts([...contracts, { address: contractAddress }]);
      setContractAddress("");
    } else {
      alert("Please enter a valid contract address.");
    }
  };

  const handleAddDapp = async () => {
    if (name.trim() && url.trim() && balance >= 0) {
      const newDapp: Dapp = {
        name,
        url,
        balance,
        contracts,
      };
      // Add new dapp to the database
      const result = await fetchData(
        "/dapps",
        {
          method: "POST",
          body: newDapp,
        },
        session
      );

      if (!result.status) {
        return;
      }
      delete result.status;
      onDappAdd({ ...result, contracts: newDapp.contracts });
      setIsModalOpen(false);
      resetForm();
    } else {
      alert("Please fill out all fields correctly.");
    }
  };

  const resetForm = () => {
    setName("");
    setUrl("");
    setBalance(0);
    setContracts([]);
    setContractAddress("");
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onRequestClose={() => setIsModalOpen(false)} // 모달 닫기
      contentLabel="Add Dapp"
      ariaHideApp={false}
      className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-1"
    >
      <div className="bg-white p-6 rounded-lg w-1/3">
        <h2 className="text-xl font-bold mb-4">Add Dapp</h2>
        <div className="flex flex-row items-center gap-2">
          <label className="mb-2 w-[20%]" htmlFor="name">
            Name
          </label>
          <input
            type="text"
            placeholder="Enter name"
            className="border border-gray-300 p-2 mb-4 w-full"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-row items-center gap-2">
          <label className="mb-2 w-[20%]" htmlFor="url">
            URL
          </label>
          <input
            type="text"
            placeholder="Enter URL"
            className="border border-gray-300 p-2 mb-4 w-full"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-row items-center gap-2">
          <label className="mb-2 w-[20%]" htmlFor="balance">
            Balance
          </label>
          <input
            type="number"
            placeholder="Enter balance"
            className="border border-gray-300 p-2 mb-4 w-full"
            id="balance"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1" htmlFor="contracts">
            Contracts
          </label>
          {contracts.map((contract) => (
            <div
              key={contract.address}
              className="flex flex-row items-center gap-2 mb-1"
            >
              <input
                type="text"
                placeholder="Enter contract address"
                className="bg-gray-100 p-2 w-full"
                value={contract.address}
                readOnly
              />
              <button
                onClick={() =>
                  setContracts(
                    contracts.filter((c) => c.address !== contract.address)
                  )
                }
                className="flex items-center justify-center bg-slate-400 text-white px-2 pb-0.5 h-6 rounded-full opacity-30 hover:opacity-90 text-2xl"
              >
                -
              </button>
            </div>
          ))}
          <div className="flex flex-row items-center gap-2 mb-6">
            <input
              type="text"
              placeholder="Enter contract address"
              className="border border-gray-300 p-2 w-full"
              id="contracts"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
            />
            <button
              onClick={handleAddContract}
              className="flex items-center justify-center bg-slate-400 text-white px-1.5 py-0.5 h-6 rounded-full opacity-80 hover:opacity-100 text-xl"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setIsModalOpen(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleAddDapp}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Submit
          </button>
        </div>
      </div>
    </Modal>
  );
}
