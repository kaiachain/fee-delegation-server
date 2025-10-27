"use client";

import React, { useEffect, useState } from "react";
import { fetchPublicData } from "@/lib/apiUtils";
import { formatBalance, truncateAddress } from "@/lib/balanceUtils"; // truncateAddress imported
// import { ContractUsage } from "../types";
// import ContractUsageTable from "../components/ContractUsageTable"; // New import

export default function Page() {
  const [dapps, setDapps] = useState<any[]>([]);
  // const [expandedDappId, setExpandedDappId] = useState<string | null>(null);
  // const [usageMap, setUsageMap] = useState<Record<string, ContractUsage[]>>({});

  useEffect(() => {
    const fetchDapps = async () => {
      try {
        const result = await fetchPublicData("/dapps?usageSummary=true", { method: "GET" });
        if (!result.status) {
          console.error("Failed to fetch DApps:", result.message);
          setDapps([]);
          return;
        }

        if (Array.isArray(result.data)) {
          setDapps(result.data);
        } else {
          console.error("Invalid DApps data received:", result.data);
          setDapps([]);
        }
      } catch (error) {
        console.error("Error fetching DApps:", error);
        setDapps([]);
      }
    };

    fetchDapps();
  }, []);

  // const toggleExpanded = async (dappId: string, hasUsageSummary: boolean) => {
  //   if (expandedDappId === dappId) {
  //     setExpandedDappId(null);
  //     return;
  //   }

  //   setExpandedDappId(dappId);

  //   // All contract usages provided by /dapps?usageSummary=true; no additional fetch needed
  // };

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

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-500 opacity-90"></div>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
              }}></div>
              <div className="relative px-8 py-12">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  DApp Leaderboard
                </h1>
                <p className="mt-2 text-indigo-100 max-w-3xl">
                  Discover the most active Kaia Wave decentralized applications and their performance metrics
                </p>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-8 py-6 bg-gray-50 border-b border-gray-200">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total DApps</p>
              <p className="text-2xl font-semibold text-gray-900">{dapps.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total Usage</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatBalance(dapps.reduce((acc, dapp) => acc + Number(dapp.totalUsed), 0).toLocaleString().replaceAll(',', ''))}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total Balance</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatBalance(dapps.reduce((acc, dapp) => acc + Number(dapp.balance), 0).toLocaleString().replaceAll(',', ''))}
              </p>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    DApp Name
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Used
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {/* Toggle */}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dapps
                  .slice()
                  .sort((a, b) => b.totalUsed - a.totalUsed)
                  .map((dapp, idx) => {
                    const dappId: string = dapp.id ?? `dapp-${idx}`;
                    // const isExpanded = expandedDappId === dappId;
                    // const entries = usageMap[dappId] || [];

                    return (
                      <React.Fragment key={dappId}>
                        <tr
                          className={`transition-all duration-200 ${
                            // isExpanded ? "bg-indigo-50/40" : "hover:bg-gray-50"
                            "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div
                                className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                                  idx === 0
                                    ? "bg-yellow-100 text-yellow-800"
                                    : idx === 1
                                    ? "bg-gray-100 text-gray-800"
                                    : idx === 2
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-gray-50 text-gray-600"
                                }`}
                              >
                                <span className="text-sm font-medium">#{idx + 1}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{dapp.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a
                              href={dapp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 hover:text-indigo-900 hover:underline"
                            >
                              {dapp.url}
                            </a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatBalance(dapp.totalUsed)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatBalance(dapp.balance)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{convertTime(dapp.createdAt)}</div>
                          </td>
                          {/* <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(dappId)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              title="Toggle contract usage"
                            >
                              <svg
                                className={`h-5 w-5 text-indigo-600 transform transition-transform ${
                                  // isExpanded ? "rotate-180" : ""
                                  ""
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </td> */}
                        </tr>
                        {/* {isExpanded && (
                          <tr className="bg-indigo-50/30">
                            <td colSpan={7} className="px-6 py-4">
                              <ContractUsageTable usages={entries} title="Contract Usage" highlightColor="indigo" />
                            </td>
                          </tr>
                        )} */}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
