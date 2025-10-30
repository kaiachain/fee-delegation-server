"use client";

import React from "react";
import { ContractUsage } from "../types";
import { formatBalance, truncateAddress } from "@/lib/balanceUtils";

const CONTRACT_USAGE_START_DATE = process.env.NEXT_PUBLIC_CONTRACT_USAGE_START_DATE || "Oct 30, 2025, 07:00:00 UTC";

interface ContractUsageTableProps {
  usages: ContractUsage[];
  title?: string;
  highlightColor?: "blue" | "indigo";
}

const colorMap = {
  blue: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    headerBg: "bg-blue-100/60",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-700",
    rankBadge: "bg-blue-100 text-blue-600",
    button: "text-blue-500 hover:text-blue-700",
    tooltipBg: "bg-blue-900",
    accent: "text-blue-800",
  },
  indigo: {
    border: "border-indigo-100",
    bg: "bg-indigo-50/30",
    headerBg: "bg-indigo-100/70",
    text: "text-indigo-900",
    badge: "bg-indigo-100 text-indigo-700",
    rankBadge: "bg-indigo-100 text-indigo-600",
    button: "text-indigo-500 hover:text-indigo-700",
    tooltipBg: "bg-indigo-900",
    accent: "text-indigo-800",
  },
};

const ContractUsageTable: React.FC<ContractUsageTableProps> = ({ usages, title, highlightColor = "blue" }) => {
  const colors = colorMap[highlightColor];
  const sorted = (usages || [])
    .map((usage) => ({
      ...usage,
      totalUsed: usage.totalUsed || "0",
      totalUsedBigInt: BigInt(usage.totalUsed || "0"),
    }))
    .sort((a, b) => {
      if (a.totalUsedBigInt === b.totalUsedBigInt) {
        return 0;
      }
      return a.totalUsedBigInt < b.totalUsedBigInt ? 1 : -1;
    });

  const total = sorted.reduce((acc, usage) => acc + usage.totalUsedBigInt, BigInt(0));

  if (sorted.length === 0) {
    return (
      <div className={`text-sm ${colors.text}`}>No contract usage recorded for this DApp yet.</div>
    );
  }

  return (
    <div className={`border ${colors.border} ${colors.bg} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {title && <h3 className={`text-base font-semibold ${colors.text}`}>{title}</h3>}
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.badge}`}>
            {sorted.length}
          </span>
        </div>
        <div className="flex flex-col items-end text-xs">
          <div className={`${colors.accent}`}>
            Total recorded contract usage (starting from {CONTRACT_USAGE_START_DATE}): <span className="font-semibold">{formatBalance(total.toString())} KAIA</span>
          </div>
          <div className="text-gray-500">Showing {sorted.length} contracts sorted by usage</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className={colors.headerBg}>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Contract Address
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Total Used (KAIA)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.map((usage, idx) => (
              <tr key={`${usage.contractAddress}-${idx}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm font-mono text-gray-700 relative">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full ${colors.rankBadge}`}>
                      {idx + 1}
                    </span>
                    <div className="relative flex items-center space-x-2 group">
                      <span className="text-gray-700 cursor-default">
                        {truncateAddress(usage.contractAddress)}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(usage.contractAddress)}
                        className={`p-1 ${colors.button}`}
                        title="Copy contract address"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <div className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex z-20 px-2 py-1 ${colors.tooltipBg} text-white text-xs rounded shadow-lg whitespace-nowrap`}>
                        {usage.contractAddress}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-right font-medium text-gray-700">
                  {formatBalance(usage.totalUsed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContractUsageTable;

