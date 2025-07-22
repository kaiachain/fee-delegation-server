import { ethers } from "ethers";
import React, { useState, useEffect } from "react";
import EditModal from "./EditModal";
import EditDappModal from "./EditDappModal";
import { useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { Dapp, Contract, Sender, ApiKey } from "../types/index";
import { useRouter } from 'next/navigation';
import StatsModal from './StatsModal';
import ErrorModal from "./ErrorModal";
import Modal from "react-modal";
import DelDappBtn from "./DelDappBtn";

interface DappCardProps {
  dapp: Dapp;
  children?: React.ReactNode;
  deleteDapp?: (dappId: string) => void;
}

const DappCard: React.FC<DappCardProps> = ({ dapp, children, deleteDapp }) => {
  
  const [dappInfo, setDappInfo] = useState<Dapp>({
    ...dapp,
    apiKeys: dapp.apiKeys || [],
    emailAlerts: dapp.emailAlerts || []
  });
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [visibleApiKeys, setVisibleApiKeys] = useState<{ [key: string]: boolean }>({});
  const [showInactiveApiKeys, setShowInactiveApiKeys] = useState(false);
  const [showInactiveContracts, setShowInactiveContracts] = useState(false);
  const [showInactiveSenders, setShowInactiveSenders] = useState(false);
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const { data: session } = useSession();
  const router = useRouter();
  const [isDappEditModalOpen, setIsDappEditModalOpen] = useState(false);

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

  const handleDappUpdate = (updatedDapp: Dapp) => {
    setDappInfo(updatedDapp);
  };





  const toggleApiKeyVisibility = (apiKeyId: string) => {
    setVisibleApiKeys(prev => ({
      ...prev,
      [apiKeyId]: !prev[apiKeyId]
    }));
  };

  const toggleDappStatus = async () => {
    try {
      const result = await fetchData(
        "/dapps",
        {
          method: "PUT",
          body: {
            id: dappInfo.id,
            active: !dappInfo.active
          }
        },
        session
      );

      if (!result.status) {
        setErrorModal({
          isOpen: true,
          title: "Failed to Update DApp Status",
          message: result.message || "Failed to update the DApp status. Please try again."
        });
        return;
      }

      // Update the local state
      setDappInfo({ ...dappInfo, active: !dappInfo.active });
    } catch (error) {
      setErrorModal({
        isOpen: true,
        title: "Error",
        message: "An error occurred while updating the DApp status."
      });
    }
  };

  // Helper functions to filter active and inactive items
  const activeApiKeys = dappInfo.apiKeys.filter(key => key.active !== false);
  const inactiveApiKeys = dappInfo.apiKeys.filter(key => key.active === false);
  const activeContracts = dappInfo.contracts.filter(contract => contract.active !== false);
  const inactiveContracts = dappInfo.contracts.filter(contract => contract.active === false);
  const activeSenders = dappInfo.senders.filter(sender => sender.active !== false);
  const inactiveSenders = dappInfo.senders.filter(sender => sender.active === false);

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
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-gray-900">{dappInfo.name}</h2>
                {/* Balance Alert Indicator */}
                {(dappInfo.emailAlerts && dappInfo.emailAlerts.length > 0) && (
                  <div 
                    className="flex items-center space-x-1 px-2 py-1 bg-green-100 border border-green-200 rounded-full cursor-help"
                    title={`${dappInfo.emailAlerts.length} balance alert${dappInfo.emailAlerts.length > 1 ? 's' : ''} configured. Click Edit to manage.`}
                  >
                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium text-green-700">
                      {dappInfo.emailAlerts.length} Alert{dappInfo.emailAlerts.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Created {convertTime(dappInfo.createdAt as string)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {children}
            {/* Edit Button */}
            <button
              onClick={(e) => { e.stopPropagation(); setIsDappEditModalOpen(true); }}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
            
            {/* Active/Inactive Toggle Button */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleDappStatus(); }}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow ${
                dappInfo.active 
                  ? 'text-white bg-green-600 hover:bg-green-700' 
                  : 'text-white bg-gray-600 hover:bg-gray-700'
              }`}
            >
              <svg className={`w-4 h-4 mr-2 ${dappInfo.active ? 'text-white' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {dappInfo.active ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              {dappInfo.active ? 'Active' : 'Inactive'}
            </button>
            
            {/* Delete Button */}
            {deleteDapp && dappInfo.id && (
              <DelDappBtn
                dapp={dappInfo}
                deleteDapp={() => deleteDapp(dappInfo.id!)}
              />
            )}
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
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 mb-0.5">Balance</span>
                  {/* Balance Alert Icon */}
                  {dappInfo.emailAlerts && dappInfo.emailAlerts.length > 0 && (
                    <div className="flex items-center" title={`${dappInfo.emailAlerts.length} balance alert${dappInfo.emailAlerts.length > 1 ? 's' : ''} configured`}>
                      <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM4 5h6V4a1 1 0 00-1-1H5a1 1 0 00-1 1v1zM4 5h6V4a1 1 0 00-1-1H5a1 1 0 00-1 1v1z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">{dappInfo.balance} KAIA</span>
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
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API Keys Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-50 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h3 className="text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">API Keys</h3>
              {inactiveApiKeys.length > 0 && (
                <button
                  onClick={() => setShowInactiveApiKeys(!showInactiveApiKeys)}
                  className="ml-2 p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                  title={`Show ${inactiveApiKeys.length} inactive API key${inactiveApiKeys.length > 1 ? 's' : ''}`}
                >
                  <svg className={`w-4 h-4 transform transition-transform duration-200 ${showInactiveApiKeys ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

          </div>
          <div className="space-y-2">
            {/* Active API Keys */}
            {activeApiKeys.length > 0 && (
              activeApiKeys.map((apiKey) => (
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
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Inactive API Keys */}
            {showInactiveApiKeys && inactiveApiKeys.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inactive API Keys</div>
                {inactiveApiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-60"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-gray-600">{apiKey.name}</div>
                        <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-gray-100 rounded-md">
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
                          className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm font-mono text-gray-500"
                        />
                        <button
                          onClick={() => apiKey.id && toggleApiKeyVisibility(apiKey.id)}
                          className="p-1.5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                          title={apiKey.id && visibleApiKeys[apiKey.id] ? "Hide API key" : "Show API key"}
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
                          className="p-1.5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                          title="Copy to clipboard"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No API Keys Message */}
            {activeApiKeys.length === 0 && inactiveApiKeys.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No API keys added yet
              </div>
            )}
          </div>
        </div>

        {/* Email Alerts Section */}
        {dappInfo.emailAlerts && dappInfo.emailAlerts.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 bg-gradient-to-br from-green-100 via-green-50 to-emerald-50 px-3 py-1.5 rounded-lg border border-green-200 shadow-sm">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h3 className="text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Email Alerts</h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {dappInfo.emailAlerts.length}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {dappInfo.emailAlerts.map((alert, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-green-900">{alert.email}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        alert.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {alert.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-green-700">
                      Alert when balance falls below {alert.balanceThreshold} KAIA
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center space-x-2 bg-gradient-to-br from-purple-100 via-purple-50 to-indigo-50 px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm mb-4">
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h3 className="text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Transaction Filters</h3>
          </div>
          
          {/* Side by side layout for Contracts and Senders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contracts Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">Contracts</h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    {activeContracts.length}
                  </span>
                  {inactiveContracts.length > 0 && (
                    <button
                      onClick={() => setShowInactiveContracts(!showInactiveContracts)}
                      className="ml-2 p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                      title={`Show ${inactiveContracts.length} inactive contract${inactiveContracts.length > 1 ? 's' : ''}`}
                    >
                      <svg className={`w-4 h-4 transform transition-transform duration-200 ${showInactiveContracts ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {/* Active Contracts */}
                {activeContracts.length > 0 && (
                  activeContracts.map((contract: Contract) => (
                    <div
                      key={contract.address}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-blue-900">Contract</span>
                          {contract.hasSwap && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              Swap
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={contract.address}
                            readOnly
                            className="flex-1 px-3 py-1.5 bg-white border border-blue-200 rounded text-sm font-mono text-gray-600"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(contract.address);
                            }}
                            className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors duration-200"
                            title="Copy to clipboard"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          </button>
                        </div>
                        {contract.hasSwap && contract.swapAddress && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-500 mb-1">Swap IN/OUT Token:</div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={contract.swapAddress}
                                readOnly
                                className="flex-1 px-3 py-1.5 bg-white border border-purple-200 rounded text-sm font-mono text-gray-600"
                              />
                              <button
                                onClick={() => {
                                  if (contract.swapAddress) {
                                    navigator.clipboard.writeText(contract.swapAddress);
                                  }
                                }}
                                className="p-1.5 text-purple-500 hover:text-purple-600 transition-colors duration-200"
                                title="Copy swap address to clipboard"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Inactive Contracts */}
                {showInactiveContracts && inactiveContracts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inactive Contracts</div>
                    {inactiveContracts.map((contract: Contract) => (
                      <div
                        key={contract.address}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-60"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-600">Contract</span>
                            {contract.hasSwap && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                Swap
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={contract.address}
                              readOnly
                              className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm font-mono text-gray-500"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(contract.address);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            </button>
                          </div>
                          {contract.hasSwap && contract.swapAddress && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">Swap IN/OUT Token:</div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={contract.swapAddress}
                                  readOnly
                                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm font-mono text-gray-500"
                                />
                                <button
                                  onClick={() => {
                                    if (contract.swapAddress) {
                                      navigator.clipboard.writeText(contract.swapAddress);
                                    }
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                                  title="Copy swap address to clipboard"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No Contracts Message */}
                {activeContracts.length === 0 && inactiveContracts.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No contracts added yet
                  </div>
                )}
              </div>
            </div>

            {/* Senders Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">Senders</h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    {activeSenders.length}
                  </span>
                  {inactiveSenders.length > 0 && (
                    <button
                      onClick={() => setShowInactiveSenders(!showInactiveSenders)}
                      className="ml-2 p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                      title={`Show ${inactiveSenders.length} inactive sender${inactiveSenders.length > 1 ? 's' : ''}`}
                    >
                      <svg className={`w-4 h-4 transform transition-transform duration-200 ${showInactiveSenders ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {/* Active Senders */}
                {activeSenders.length > 0 && (
                  activeSenders.map((sender: any) => (
                    <div
                      key={sender.address}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-green-900">Sender</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={sender.address}
                            readOnly
                            className="flex-1 px-3 py-1.5 bg-white border border-green-200 rounded text-sm font-mono text-gray-600"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(sender.address);
                            }}
                            className="p-1.5 text-green-500 hover:text-green-600 transition-colors duration-200"
                            title="Copy to clipboard"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Inactive Senders */}
                {showInactiveSenders && inactiveSenders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inactive Senders</div>
                    {inactiveSenders.map((sender: any) => (
                      <div
                        key={sender.address}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-60"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-600">Sender</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={sender.address}
                              readOnly
                              className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm font-mono text-gray-500"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(sender.address);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No Senders Message */}
                {activeSenders.length === 0 && inactiveSenders.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No senders added yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>






      <EditDappModal
        isModalOpen={isDappEditModalOpen}
        setIsModalOpen={setIsDappEditModalOpen}
        dapp={dappInfo}
        onDappUpdate={handleDappUpdate}
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
