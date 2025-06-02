"use client";

import React, { useState, useRef, useEffect } from "react";
import Modal from "react-modal";
import { ethers } from "ethers";
import { useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { Dapp, Contract, Sender, ApiKey } from "../types/index";
import ErrorModal from "./ErrorModal";
import crypto from "crypto";

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
  const cInputRef = useRef<HTMLInputElement>(null);
  const cAddButtonRef = useRef<HTMLButtonElement>(null);
  const sInputRef = useRef<HTMLInputElement>(null);
  const sAddButtonRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [terminationDate, setTerminationDate] = useState<string>("");
  const [contractAddress, setContractAddress] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [senderAddress, setSenderAddress] = useState("");
  const [senders, setSenders] = useState<Sender[]>([]);
  const [hasSwap, setHasSwap] = useState(false);
  const [swapAddress, setSwapAddress] = useState("");
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: ""
  });
  const { data: session } = useSession();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [newContract, setNewContract] = useState("");
  const [showContractInput, setShowContractInput] = useState(false);
  const [newSender, setNewSender] = useState("");
  const [showSenderInput, setShowSenderInput] = useState(false);

  // Convert UTC to KST for display
  const convertUTCtoKST = (utcDate: string) => {
    if (!utcDate) return "";
    const date = new Date(utcDate);
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // Add 9 hours for KST
    return kstDate.toLocaleDateString("ko-KR", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  // Convert KST to UTC for saving
  const convertKSTtoUTC = (kstDate: string) => {
    if (!kstDate) return "";
    const date = new Date(kstDate);
    const utcDate = new Date(date.getTime() - (9 * 60 * 60 * 1000)); // Subtract 9 hours for UTC
    return utcDate.toISOString();
  };

  useEffect(() => {
    if (isModalOpen) {
      resetForm();
    }
  }, [isModalOpen]);

  const handleCAddKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      cAddButtonRef.current?.click();
    }
  };

  const handleSAddKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sAddButtonRef.current?.click();
    }
  };

  const handleAddContract = async () => {
    if (contractAddress.trim() && ethers.isAddress(contractAddress)) {
      // Check for duplicate contract with same address and swap configuration
      const isDuplicate = contracts.some((contract) => {
        const addressMatch = contract.address.toLowerCase() === contractAddress.toLowerCase();
        if (!hasSwap && !contract.hasSwap) {
          return addressMatch; // Both are non-swap contracts
        }
        if (hasSwap && contract.hasSwap) {
          // Both are swap contracts, check swap addresses
          return addressMatch && contract.swapAddress?.toLowerCase() === swapAddress.toLowerCase();
        }
        return false; // Different swap configurations
      });

      if (isDuplicate) {
        setErrorModal({
          isOpen: true,
          title: "Duplicate Contract",
          message: "A contract with this address already exists."
        });
        return;
      }

      // Check if contract exists in any other DApp
      const existingContract = await fetchData(
        "/contracts/check",
        {
          method: "POST",
          body: {
            address: contractAddress,
            hasSwap,
            swapAddress: hasSwap ? swapAddress : null
          }
        },
        session
      );

      if (existingContract.status === "SUCCESS" && existingContract.data) {
        setErrorModal({
          isOpen: true,
          title: "Contract Already Exists",
          message: "This contract address is already registered with another DApp."
        });
        return;
      }

      setContracts([...contracts, { 
        address: contractAddress, 
        hasSwap,
        swapAddress: hasSwap ? swapAddress : undefined 
      }]);
      setContractAddress("");
      setSwapAddress("");
      setHasSwap(false);
    } else {
      setErrorModal({
        isOpen: true,
        title: "Invalid Contract Address",
        message: "Please enter a valid contract address."
      });
    }
  };

  const handleAddSender = async () => {
    if (senderAddress.trim() && ethers.isAddress(senderAddress)) {
      // Check for duplicate sender address
      const isDuplicate = senders.some(
        (sender) => sender.address.toLowerCase() === senderAddress.toLowerCase()
      );

      if (isDuplicate) {
        setErrorModal({
          isOpen: true,
          title: "Duplicate Sender",
          message: "This sender address has already been added."
        });
        return;
      }

      // Check if sender exists in any other DApp
      const existingSender = await fetchData(
        "/senders/check",
        {
          method: "POST",
          body: {
            address: senderAddress
          }
        },
        session
      );

      if (existingSender.status === "SUCCESS" && existingSender.data) {
        setErrorModal({
          isOpen: true,
          title: "Sender Already Exists",
          message: "This sender address is already registered with another DApp."
        });
        return;
      }

      setSenders([...senders, { address: senderAddress }]);
      setSenderAddress("");
    } else {
      setErrorModal({
        isOpen: true,
        title: "Invalid Sender Address",
        message: "Please enter a valid sender address."
      });
    }
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove leading zeros and convert to number
    const cleanValue = value.replace(/^0+/, '') || '0';
    // Only allow numbers
    if (/^\d*$/.test(cleanValue)) {
      setBalance(Number(cleanValue));
    }
  };

  const generateApiKey = () => {
    if (!newApiKeyName.trim()) {
      setErrorModal({
        isOpen: true,
        title: "Invalid API Key Name",
        message: "Please enter a name for the API key."
      });
      return;
    }

    setIsGeneratingKey(true);
    // Generate a random API key
    const key = `kaia_${crypto.randomBytes(32).toString('hex')}`;
    setApiKeys([...apiKeys, { key, name: newApiKeyName }]);
    setNewApiKeyName("");
    setIsGeneratingKey(false);
  };

  const removeApiKey = (index: number) => {
    setApiKeys(apiKeys.filter((_, i) => i !== index));
  };

  const handleAddDapp = async () => {
    if (name.trim() && url.trim() && balance >= 0) {
      // Check if at least one form of access control is provided
      if (apiKeys.length === 0 && contracts.length === 0 && senders.length === 0) {
        setErrorModal({
          isOpen: true,
          title: "Access Control Required",
          message: "Please add at least one form of access control:\n\n1. API Keys (Primary Access Control), or\n2. Contracts/Senders (Secondary Access Control)"
        });
        return;
      }

      const newDapp: Dapp = {
        name,
        url,
        balance,
        ...(terminationDate && { terminationDate: convertKSTtoUTC(terminationDate) }),
        contracts,
        senders,
        apiKeys,
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
        let errorMessage = "There was an error adding the DApp. Please try again.";
        
        // Handle specific error cases based on error code
        switch (result.error) {
          case "CONFLICT":
            errorMessage = "A DApp with this name or address combination already exists. Please try again choosing a different name or address.";
            break;
          case "BAD_REQUEST":
            errorMessage = result.message || "Invalid DApp data. Please check all fields and try again.";
            break;
          case "UNAUTHORIZED":
            errorMessage = "You don't have permission to create DApps. Please contact an administrator.";
            break;
          case "INTERNAL_ERROR":
            errorMessage = result.message || "An unexpected error occurred. Please try again later.";
            break;
          default:
            errorMessage = result.message || errorMessage;
        }

        setErrorModal({
          isOpen: true,
          title: "Failed to Add DApp",
          message: errorMessage
        });
        return;
      }

      onDappAdd(result.data);
      setIsModalOpen(false);
      resetForm();
    } else {
      setErrorModal({
        isOpen: true,
        title: "Invalid Input",
        message: "Please fill out all required fields correctly."
      });
    }
  };

  const resetForm = () => {
    setName("");
    setUrl("");
    setBalance(0);
    setTerminationDate("");
    setContracts([]);
    setContractAddress("");
    setSwapAddress("");
    setHasSwap(false);
    setSenders([]);
    setSenderAddress("");
    setApiKeys([]);
    setNewApiKeyName("");
    setShowApiKeyInput(false);
    setNewContract("");
    setShowContractInput(false);
    setNewSender("");
    setShowSenderInput(false);
  };

  return (
    <>
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Add Dapp"
        ariaHideApp={false}
        className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50"
      >
        <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
          {/* Header with gradient background */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90 rounded-t-xl"></div>
            <div className="relative px-6 py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-bold text-white">Add New DApp</h2>
                    <p className="text-blue-100 text-xs mt-0.5">Create a new decentralized application entry</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:text-blue-100 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4 overflow-y-auto">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              </div>
              
              {/* Name Input */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  <span>DApp Name<span className="text-red-500 ml-1">*</span></span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                  placeholder="Enter DApp name"
                />
              </div>

              {/* URL Input */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>URL<span className="text-red-500 ml-1">*</span></span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                  placeholder="Enter DApp URL"
                />
              </div>

              {/* Balance Input */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Balance<span className="text-red-500 ml-1">*</span></span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={balance}
                    onChange={handleBalanceChange}
                    className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter balance"
                    min="0"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-gray-500 text-sm">KAIA</span>
                  </div>
                </div>
              </div>

              {/* Termination Date Input */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Service End Date (KST)</span>
                </label>
                <input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                />
                <p className="mt-1 text-xs text-gray-500">Service will work normally on the selected date and stop on the next day in KST</p>
              </div>
            </div>

            {/* Access Control Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-800">Access Control</h3>
                  <span className="text-red-500 ml-1">*</span>
                </div>
              </div>

              {/* Mandatory Access Control Warning */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm text-yellow-700">
                      <p className="mb-2">At least one form of access control is required. You must either:</p>
                      <ul className="list-disc ml-5">
                        <li>Add API Keys (Primary Access Control), or</li>
                        <li>Add Contracts/Senders (Secondary Access Control)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Keys Section - Primary Filter */}
              <div className="space-y-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <h3 className="text-lg font-bold text-blue-800">API Keys</h3>
                  </div>
                  <span className="text-sm text-blue-600 font-medium">Primary Access Control</span>
                </div>

                <div className="bg-white border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        API keys are required to access the fee delegation service. You can add multiple keys for different purposes.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      className="flex-1 px-4 py-2.5 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                      placeholder="Enter API key name (e.g., Production, Development, Testing)"
                    />
                    <button
                      onClick={generateApiKey}
                      disabled={isGeneratingKey}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingKey ? 'Generating...' : 'Generate Key'}
                    </button>
                  </div>
                  {apiKeys.length > 0 && (
                    <div className="space-y-2">
                      {apiKeys.map((apiKey, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-blue-900 mb-1">{apiKey.name}</div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={apiKey.key}
                                readOnly
                                className="flex-1 px-3 py-1.5 bg-gray-50 border border-blue-200 rounded text-sm font-mono text-gray-600"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(apiKey.key);
                                  // You might want to add a toast notification here
                                }}
                                className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors duration-200"
                                title="Copy to clipboard"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => removeApiKey(index)}
                            className="ml-3 text-red-500 hover:text-red-600 transition-colors duration-200"
                            title="Delete API key"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Contracts & Senders Section - Secondary Filter */}
              <div className={`space-y-4 bg-purple-50 border-l-4 border-purple-400 rounded-lg p-4 shadow-sm ${apiKeys.length > 0 ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="text-lg font-bold text-purple-800">Transaction Filters</h3>
                  </div>
                  <span className="text-sm text-purple-600 font-medium">Secondary Access Control</span>
                </div>

                {/* Contracts Section */}
                <div className="space-y-4 bg-white rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-lg font-medium text-purple-800">Contracts</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex space-x-3">
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          ref={cInputRef}
                          value={contractAddress}
                          onChange={(e) => setContractAddress(e.target.value)}
                          onKeyPress={handleCAddKeyPress}
                          className="w-full px-4 py-2.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                          placeholder="Enter contract address"
                        />
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="hasSwap"
                            checked={hasSwap}
                            onChange={(e) => setHasSwap(e.target.checked)}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded transition-colors duration-200"
                          />
                          <label htmlFor="hasSwap" className="text-sm text-gray-700">
                            Enable Swap
                          </label>
                        </div>
                        {hasSwap && (
                          <input
                            type="text"
                            value={swapAddress}
                            onChange={(e) => setSwapAddress(e.target.value)}
                            className="w-full px-4 py-2.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                            placeholder="Enter swap IN/OUT Token address"
                          />
                        )}
                      </div>
                      <button
                        ref={cAddButtonRef}
                        onClick={handleAddContract}
                        className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow"
                      >
                        Add
                      </button>
                    </div>
                    {contracts.length > 0 && (
                      <div className="space-y-2">
                        {contracts.map((contract, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                          >
                            <div>
                              <div className="text-sm font-mono text-purple-900">{contract.address}</div>
                              {contract.hasSwap && contract.swapAddress && (
                                <div className="text-xs text-purple-500 mt-1">
                                  Swap IN/OUT: {contract.swapAddress}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setContracts(contracts.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-600 transition-colors duration-200"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Senders Section */}
                <div className="space-y-4 bg-white rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-purple-800">Senders</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        ref={sInputRef}
                        value={senderAddress}
                        onChange={(e) => setSenderAddress(e.target.value)}
                        onKeyPress={handleSAddKeyPress}
                        className="flex-1 px-4 py-2.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                        placeholder="Enter sender address"
                      />
                      <button
                        ref={sAddButtonRef}
                        onClick={handleAddSender}
                        className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow"
                      >
                        Add
                      </button>
                    </div>
                    {senders.length > 0 && (
                      <div className="space-y-2">
                        {senders.map((sender, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                          >
                            <span className="text-sm font-mono text-purple-900">{sender.address}</span>
                            <button
                              onClick={() => setSenders(senders.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-600 transition-colors duration-200"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow"
            >
              Cancel
            </button>
            <button
              onClick={handleAddDapp}
              className="px-4 py-2.5 text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow"
            >
              Add DApp
            </button>
          </div>
        </div>
      </Modal>

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </>
  );
}
