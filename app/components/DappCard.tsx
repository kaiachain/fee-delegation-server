import { ethers } from "ethers";
import React, { useState, useEffect } from "react";
import EditModal from "./EditModal";
import ConfirmModal from "./ConfirmModal";
import { useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { Dapp, Contract, Sender, ApiKey } from "../types/index";
import { useRouter } from 'next/navigation';
import StatsModal from './StatsModal';
import ErrorModal from "./ErrorModal";
import Modal from "react-modal";

interface DappCardProps {
  dapp: Dapp;
  children?: React.ReactNode;
}

const DappCard: React.FC<DappCardProps> = ({ dapp, children }) => {
  const [dappInfo, setDappInfo] = useState<Dapp>({
    ...dapp,
    apiKeys: dapp.apiKeys || []
  });
  const [isContractEditModalOpen, setIsContractEditModalOpen] = useState(false);
  const [isSenderEditModalOpen, setIsSenderEditModalOpen] = useState(false);
  const [isBalanceEditModalOpen, setIsBalanceEditModalOpen] = useState(false);
  const [isUrlEditModalOpen, setIsUrlEditModalOpen] = useState(false);
  const [isTerminationDateEditModalOpen, setIsTerminationDateEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [visibleApiKeys, setVisibleApiKeys] = useState<{ [key: string]: boolean }>({});
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    address?: string;
    isDuplicate?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const [isNameEditModalOpen, setIsNameEditModalOpen] = useState(false);

  const convertTime = (time: string) => {
    if (!time) return "Not set";
    const date = new Date(time);
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // Add 9 hours for KST
    return kstDate.toLocaleDateString("ko-KR", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).replace(/\s/g, ''); // Remove all spaces
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
    const foundContract = dappInfo.contracts.find((c: any) => c.address === contract);
    if (!foundContract) return;
    const id = foundContract.id;
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
    const foundSender = dappInfo.senders.find((s: any) => s.address === sender);
    if (!foundSender) return;
    const id = foundSender.id;
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
        body: { id: dappInfo.id, balance: parseFloat(balance) },
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

    setDappInfo({ ...dappInfo, balance: parseFloat(balance) });
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

  const updateName = async (name: string) => {
    setIsNameEditModalOpen(false);
    const result = await fetchData(
      "/dapps",
      {
        method: "PUT",
        body: { id: dappInfo.id, name },
      },
      session
    );

    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Update Name",
        message: result.message || "Failed to update the name. Please try again."
      });
      return;
    }

    setDappInfo({ ...dappInfo, name });
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

  const generateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      setErrorModal({
        isOpen: true,
        title: "Invalid API Key Name",
        message: "Please enter a name for the API key."
      });
      setIsApiKeyModalOpen(false);
      return;
    }

    setIsGeneratingKey(true);
    try {
      const result = await fetchData(
        "/api-keys",
        {
          method: "POST",
          body: {
            dappId: dappInfo.id,
            name: newApiKeyName,
          },
        },
        session
      );

      if (!result.status) {
        setErrorModal({
          isOpen: true,
          title: "Failed to Generate API Key",
          message: result.message || "Failed to generate the API key. Please try again."
        });
        setIsApiKeyModalOpen(false);
        return;
      }

      const updatedApiKeys = [...dappInfo.apiKeys, result.data];
      const updatedDapp = { ...dappInfo, apiKeys: updatedApiKeys };
      setDappInfo(updatedDapp);
      setNewApiKeyName("");
      setIsApiKeyModalOpen(false);
    } catch (error) {
      setErrorModal({
        isOpen: true,
        title: "Error",
        message: "An error occurred while generating the API key."
      });
      setIsApiKeyModalOpen(false);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const removeApiKey = async (apiKeyId: string) => {
    try {
      const result = await fetchData(
        "/api-keys",
        {
          method: "DELETE",
          body: { id: apiKeyId },
        },
        session
      );

      if (!result.status) {
        setErrorModal({
          isOpen: true,
          title: "Failed to Remove API Key",
          message: result.message || "Failed to remove the API key. Please try again."
        });
        return;
      }

      const updatedApiKeys = dappInfo.apiKeys.filter(key => key.id !== apiKeyId);
      const updatedDapp = { ...dappInfo, apiKeys: updatedApiKeys };
      setDappInfo(updatedDapp);
    } catch (error) {
      setErrorModal({
        isOpen: true,
        title: "Error",
        message: "An error occurred while removing the API key."
      });
    }
  };

  const handleRemoveApiKey = (apiKeyId: string, apiKeyName: string) => {
    setConfirmAction({
      type: 'apiKey',
      action: async () => {
        await removeApiKey(apiKeyId);
        setIsConfirmModalOpen(false);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const toggleApiKeyVisibility = (apiKeyId: string) => {
    setVisibleApiKeys(prev => ({
      ...prev,
      [apiKeyId]: !prev[apiKeyId]
    }));
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
              <div className="flex items-center">
                <h2 className="text-xl font-bold text-gray-900">{dappInfo.name}</h2>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsNameEditModalOpen(true); }}
                  className="ml-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                  title="Edit Name"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
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

        {/* API Keys Section */}
        <div className={`mb-4 ${dappInfo.contracts.length > 0 || dappInfo.senders.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-50 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h3 className="text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">API Keys</h3>
            </div>
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow"
              disabled={dappInfo.contracts.length > 0 || dappInfo.senders.length > 0}
            >
              Add Key
            </button>
          </div>
          <div className="space-y-2">
            {dappInfo.apiKeys && dappInfo.apiKeys.length > 0 ? (
              dappInfo.apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-blue-900">{apiKey.name}</div>
                      <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-gray-50 rounded-md">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-500">Created</span>
                        <span className="font-mono text-xs text-gray-500 tracking-tight">{apiKey.createdAt ? convertTime(apiKey.createdAt) : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type={apiKey.id && visibleApiKeys[apiKey.id] ? "text" : "password"}
                        value={apiKey.key}
                        readOnly
                        className="flex-1 px-3 py-1.5 bg-white border border-blue-200 rounded text-sm font-mono text-gray-600"
                      />
                      <button
                        onClick={() => apiKey.id && toggleApiKeyVisibility(apiKey.id)}
                        className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors duration-200"
                        title={apiKey.id && visibleApiKeys[apiKey.id] ? "Hide API key" : "Show API key"}
                        disabled={dappInfo.contracts.length > 0 || dappInfo.senders.length > 0}
                      >
                        {apiKey.id && visibleApiKeys[apiKey.id] ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(apiKey.key);
                        }}
                        className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors duration-200"
                        title="Copy to clipboard"
                        disabled={dappInfo.contracts.length > 0 || dappInfo.senders.length > 0}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => apiKey.id && apiKey.name && handleRemoveApiKey(apiKey.id, apiKey.name)}
                        className="p-1.5 text-red-500 hover:text-red-600 transition-colors duration-200"
                        title="Delete API key"
                        disabled={dappInfo.contracts.length > 0 || dappInfo.senders.length > 0}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                No API keys added yet
              </div>
            )}
          </div>
        </div>

        <div className={`space-y-4 ${dappInfo.apiKeys && dappInfo.apiKeys.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center space-x-2 bg-gradient-to-br from-purple-100 via-purple-50 to-indigo-50 px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm mb-4">
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h3 className="text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Transaction Filters</h3>
          </div>
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
                disabled={dappInfo.apiKeys && dappInfo.apiKeys.length > 0}
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
                    disabled={dappInfo.apiKeys && dappInfo.apiKeys.length > 0}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {contract.hasSwap && contract.swapAddress && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10 hidden group-hover:block">
                      <div className="text-xs text-gray-500">Swap IN/OUT:</div>
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
                disabled={dappInfo.apiKeys && dappInfo.apiKeys.length > 0}
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
                    disabled={dappInfo.apiKeys && dappInfo.apiKeys.length > 0}
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
      <EditModal
        title="Edit Name"
        isModalOpen={isNameEditModalOpen}
        setIsModalOpen={setIsNameEditModalOpen}
        submitData={updateName}
        placeholder="Enter dapp name"
        initialValue={dappInfo.name}
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
          confirmAction?.type === 'apiKey' ?
          'Delete API Key' :
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
          confirmAction?.type === 'apiKey' ?
          'Are you sure you want to delete this API key? This action cannot be undone.' :
          'Are you sure you want to proceed?'
        }
        confirmText={confirmAction?.type === 'contract' || confirmAction?.type === 'sender' || confirmAction?.type === 'apiKey' ? 
          (confirmAction.isDuplicate ? "OK" : "Delete") : 
          "Confirm"
        }
        cancelText={confirmAction?.type === 'contract' || confirmAction?.type === 'sender' || confirmAction?.type === 'apiKey' ? 
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

      {/* Add API Key Modal */}
      <Modal
        isOpen={isApiKeyModalOpen}
        onRequestClose={() => setIsApiKeyModalOpen(false)}
        contentLabel="Add API Key"
        ariaHideApp={false}
        className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50"
      >
        <div className="bg-white rounded-xl shadow-2xl w-[400px] p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Add New API Key</h2>
            <button
              onClick={() => setIsApiKeyModalOpen(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key Name
              </label>
              <input
                type="text"
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                placeholder="Enter API key name (e.g., Production, Development)"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={generateApiKey}
                disabled={isGeneratingKey}
                className="px-4 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingKey ? 'Generating...' : 'Generate Key'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DappCard;
