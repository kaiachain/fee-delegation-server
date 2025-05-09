import { ethers } from "ethers";
import React, { useState } from "react";
import EditModal from "./EditModal";
import ConfirmModal from "./ConfirmModal";
import { useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { Contract, Dapp } from "@/types";
import { useRouter } from 'next/navigation';
import StatsModal from './StatsModal';
import ErrorModal from "./ErrorModal";

interface DappCardProps {
  dapp: Dapp;
  children?: React.ReactNode;
}

const DappCard: React.FC<DappCardProps> = ({ dapp, children }) => {
  const [dappInfo, setDappInfo] = useState<any>(dapp);
  const [isContractEditModalOpen, setIsContractEditModalOpen] = useState(false);
  const [isSenderEditModalOpen, setIsSenderEditModalOpen] = useState(false);
  const [isBalanceEditModalOpen, setIsBalanceEditModalOpen] = useState(false);
  const [isUrlEditModalOpen, setIsUrlEditModalOpen] = useState(false);
  const [isTerminationDateEditModalOpen, setIsTerminationDateEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'contract' | 'sender';
    address: string;
    action: () => Promise<void>;
    isDuplicate?: boolean;
  } | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: ""
  });

  const convertTime = (time: string) => {
    if (!time) return "Not set";
    const date = new Date(time);
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // Add 9 hours for KST
    return kstDate.toLocaleDateString("ko-KR", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const convertUTCtoKST = (utcDate: string) => {
    if (!utcDate) return "";
    const date = new Date(utcDate);
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // Add 9 hours for KST
    return kstDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  };

  const convertKSTtoUTC = (kstDate: string) => {
    if (!kstDate) return "";
    const date = new Date(kstDate);
    const utcDate = new Date(date.getTime() - (9 * 60 * 60 * 1000)); // Subtract 9 hours for UTC
    return utcDate.toISOString();
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
      setErrorModal({
        isOpen: true,
        title: "Failed to Remove Contract",
        message: result.message || "Failed to remove the contract. Please try again."
      });
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
      setErrorModal({
        isOpen: true,
        title: "Failed to Remove Sender",
        message: result.message || "Failed to remove the sender. Please try again."
      });
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
    if (!sender || !ethers.isAddress(sender)) {
      setErrorModal({
        isOpen: true,
        title: "Invalid Sender Address",
        message: "Please enter a valid sender address."
      });
      return;
    }

    const isDuplicate = dappInfo.senders.some(
      (s: any) => s.address.toLowerCase() === sender.toLowerCase()
    );

    if (isDuplicate) {
      setConfirmAction({
        type: 'sender',
        address: sender,
        isDuplicate: true,
        action: async () => {
          setIsConfirmModalOpen(false);
        }
      });
      setIsConfirmModalOpen(true);
      return;
    }

    const result = await fetchData(
      "/senders",
      {
        method: "POST",
        body: {
          dappId: dappInfo.id,
          address: sender,
        },
      },
      session
    );

    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Add Sender",
        message: result.message || "Failed to add the sender. Please try again."
      });
      return;
    }

    const updatedSenders = [...dappInfo.senders, result.data];
    const updatedDapp = { ...dappInfo, senders: updatedSenders };
    setDappInfo(updatedDapp);
  };

  const addContract = async (contract: string, hasSwap?: boolean, swapAddress?: string) => {
    setIsContractEditModalOpen(false);
    if (!contract || !ethers.isAddress(contract)) {
      setErrorModal({
        isOpen: true,
        title: "Invalid Contract Address",
        message: "Please enter a valid contract address."
      });
      return;
    }

    // Check for duplicate contract with same address and swap configuration
    const isDuplicate = dappInfo.contracts.some((c: any) => {
      const addressMatch = c.address.toLowerCase() === contract.toLowerCase();
      return addressMatch; // Only check address match, ignore swap configuration
    });

    if (isDuplicate) {
      setConfirmAction({
        type: 'contract',
        address: contract,
        isDuplicate: true,
        action: async () => {
          setIsConfirmModalOpen(false);
        }
      });
      setIsConfirmModalOpen(true);
      return;
    }

    const result = await fetchData(
      "/contracts",
      {
        method: "POST",
        body: {
          dappId: dappInfo.id,
          address: contract,
          hasSwap: hasSwap || false,
          swapAddress: hasSwap ? swapAddress : null,
        },
      },
      session
    );

    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Add Contract",
        message: result.message || "Failed to add the contract. Please try again."
      });
      return;
    }

    const updatedContracts = [...dappInfo.contracts, result.data];
    const updatedDapp = { ...dappInfo, contracts: updatedContracts };
    setDappInfo(updatedDapp);
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
      setErrorModal({
        isOpen: true,
        title: "Failed to Update Balance",
        message: result.message || "Failed to update the balance. Please try again."
      });
      return;
    }

    setDappInfo({ ...dappInfo, balance });
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
      setErrorModal({
        isOpen: true,
        title: "Failed to Update URL",
        message: result.message || "Failed to update the URL. Please try again."
      });
      return;
    }

    setDappInfo({ ...dappInfo, url });
  };

  const updateTerminationDate = async (date: string) => {
    setIsTerminationDateEditModalOpen(false);
    const result = await fetchData(
      "/dapps",
      {
        method: "PUT",
        body: { id: dappInfo.id, terminationDate: convertKSTtoUTC(date) },
      },
      session
    );

    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Update Service End Date",
        message: result.message || "Failed to update the service end date. Please try again."
      });
      return;
    }

    setDappInfo({ ...dappInfo, terminationDate: date });
  };

  const handleRemoveContract = (contract: string) => {
    setConfirmAction({
      type: 'contract',
      address: contract,
      isDuplicate: false,
      action: async () => {
        await removeContract(contract);
        setIsConfirmModalOpen(false);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleRemoveSender = (sender: string) => {
    setConfirmAction({
      type: 'sender',
      address: sender,
      isDuplicate: false,
      action: async () => {
        await removeSender(sender);
        setIsConfirmModalOpen(false);
      }
    });
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{dappInfo.name}</h2>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created {convertTime(dappInfo.createdAt as string)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {children}
            {/* <button
              onClick={() => setIsStatsModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button> */}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
            <div className="p-1.5 bg-blue-50 rounded-md">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex items-center min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-gray-500 mb-0.5">URL</span>
                <div className="flex items-center">
                  <span className="text-gray-600 truncate max-w-[120px]">{dappInfo.url}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsUrlEditModalOpen(true); }}
                    className="ml-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                    title="Edit URL"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
            <div className="p-1.5 bg-green-50 rounded-md">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex items-center min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-gray-500 mb-0.5">Balance</span>
                <div className="flex items-center">
                  <span className="text-gray-600">{dappInfo.balance} KAIA</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsBalanceEditModalOpen(true); }}
                    className="ml-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-all duration-200"
                    title="Edit Balance"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex items-center min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-gray-500 mb-0.5">Total Used</span>
                <span className="text-gray-600">{dappInfo.totalUsed} KAIA</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
            <div className="p-1.5 bg-indigo-50 rounded-md">
              <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex items-center min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-gray-500 mb-0.5">Service End Date (KST)</span>
                <div className="flex items-center">
                  <span className="text-gray-600">
                    {dappInfo.terminationDate 
                      ? convertTime(dappInfo.terminationDate)
                      : 'Not set'
                    }
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsTerminationDateEditModalOpen(true); }}
                    className="ml-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all duration-200"
                    title="Edit Service End Date"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900">Contracts</h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {dappInfo.contracts.length}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsContractEditModalOpen(true); }}
                className="group relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Contract
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {dappInfo.contracts.map((contract: Contract) => (
                <div
                  key={contract.address}
                  className="group relative inline-flex items-center px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm font-mono hover:bg-blue-100 transition-all duration-200"
                >
                  <span className="text-blue-700 truncate max-w-[120px]">{contract.address.toLowerCase()}</span>
                  {contract.hasSwap && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                      Swap
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveContract(contract.address); }}
                    className="ml-2 p-1 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    title="Remove contract"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {contract.hasSwap && contract.swapAddress && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10 hidden group-hover:block">
                      <div className="text-xs text-gray-500">Swap TO:</div>
                      <div className="text-sm font-mono text-gray-700 truncate">{contract.swapAddress}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900">Senders</h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {dappInfo.senders.length}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsSenderEditModalOpen(true); }}
                className="group relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-sm hover:shadow"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Sender
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {dappInfo.senders.map((sender: any) => (
                <div
                  key={sender.address}
                  className="group relative inline-flex items-center px-3 py-1.5 bg-green-50 border border-green-100 rounded-full text-sm font-mono hover:bg-green-100 transition-all duration-200"
                >
                  <span className="text-green-700 truncate max-w-[120px]">{sender.address.toLowerCase()}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveSender(sender.address); }}
                    className="ml-2 p-1 text-green-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    title="Remove sender"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EditModal
        title="Add Contract"
        isModalOpen={isContractEditModalOpen}
        setIsModalOpen={setIsContractEditModalOpen}
        submitData={addContract}
        placeholder="Enter contract address"
        initialValue=""
        isContract={true}
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
        title="Current Balance"
        isModalOpen={isBalanceEditModalOpen}
        setIsModalOpen={setIsBalanceEditModalOpen}
        submitData={updateBalance}
        placeholder="Current Balance?"
        initialValue={dapp.balance?.toString() || "0"}
      />
      <EditModal
        title="Edit URL"
        isModalOpen={isUrlEditModalOpen}
        setIsModalOpen={setIsUrlEditModalOpen}
        submitData={updateUrl}
        placeholder={dapp.url || ''}
        initialValue={dapp.url || ''}
      />
      <EditModal
        title="Edit Service End Date"
        isModalOpen={isTerminationDateEditModalOpen}
        setIsModalOpen={setIsTerminationDateEditModalOpen}
        submitData={updateTerminationDate}
        placeholder="YYYY-MM-DD"
        initialValue={dappInfo.terminationDate ? new Date(dappInfo.terminationDate).toISOString().split('T')[0] : ''}
        isDate={true}
        allowReset={true}
        resetValue=""
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setConfirmAction(null);
        }}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.action();
          }
        }}
        title={confirmAction?.type === 'contract' ? 
          (confirmAction.isDuplicate ? 'Contract Already Exists' : 'Remove Contract') : 
          confirmAction?.type === 'sender' ? 
          (confirmAction.isDuplicate ? 'Sender Already Exists' : 'Remove Sender') : 
          'Confirm Action'
        }
        message={confirmAction?.type === 'contract' ? 
          (confirmAction.isDuplicate ? 
            `Contract address ${confirmAction.address} with the same swap configuration already exists in this DApp.` :
            `Are you sure you want to remove this contract address: ${confirmAction.address}?`) : 
          confirmAction?.type === 'sender' ? 
          (confirmAction.isDuplicate ? 
            `Sender address ${confirmAction.address} already exists in this DApp.` :
            `Are you sure you want to remove this sender address: ${confirmAction.address}?`) :
          'Are you sure you want to proceed?'
        }
        confirmText={confirmAction?.type === 'contract' || confirmAction?.type === 'sender' ? 
          (confirmAction.isDuplicate ? "OK" : "Remove") : 
          "Confirm"
        }
        cancelText={confirmAction?.type === 'contract' || confirmAction?.type === 'sender' ? 
          (confirmAction.isDuplicate ? undefined : "Cancel") : 
          "Cancel"
        }
        swapAddress={confirmAction?.type === 'contract' ? 
          dappInfo.contracts.find((c: any) => c.address === confirmAction.address)?.swapAddress : 
          undefined
        }
      />

      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        dappId={dapp.id || ''}
        dappName={dapp.name || ''}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
};

export default DappCard;
