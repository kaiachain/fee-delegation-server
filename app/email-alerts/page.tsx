"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { formatEther } from "ethers";

interface EmailAlertLog {
  id: string;
  email: string;
  dappId: string;
  dappName: string;
  newBalance: string;
  threshold: string;
  sentAt: string;
  isRead: boolean;
}

export default function EmailAlertsPage() {
  const [emailAlertLogs, setEmailAlertLogs] = useState<EmailAlertLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedDappId, setSelectedDappId] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const { data: session, status } = useSession();

  const fetchEmailAlertLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (showUnreadOnly) {
        params.append("isRead", "false");
      }
      if (selectedDappId) {
        params.append("dappId", selectedDappId);
      }
      if (selectedEmail) {
        params.append("email", selectedEmail);
      }
      
      const result = await fetchData(`/email-alert-logs?${params.toString()}`, { method: "GET" }, session);
      if (result.status) {
        setEmailAlertLogs(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch email alert logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (logId: string) => {
    try {
      const result = await fetchData("/email-alert-logs", {
        method: "PUT",
        body: { id: logId }
      }, session);
      
      if (result.status) {
        setEmailAlertLogs(prev => 
          prev.map(log => 
            log.id === logId ? { ...log, isRead: true } : log
          )
        );
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markDappAsRead = async (dappId: string) => {
    try {
      const result = await fetchData("/email-alert-logs", {
        method: "PUT",
        body: { dappId }
      }, session);
      
      if (result.status) {
        setEmailAlertLogs(prev => 
          prev.map(log => 
            log.dappId === dappId ? { ...log, isRead: true } : log
          )
        );
      }
    } catch (error) {
      console.error("Failed to mark DApp as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const result = await fetchData("/email-alert-logs", {
        method: "PUT",
        body: { markAllAsRead: true }
      }, session);
      
      if (result.status) {
        setEmailAlertLogs(prev => 
          prev.map(log => ({ ...log, isRead: true }))
        );
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const formatBalance = (balance: string) => {
    return formatEther(balance);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  useEffect(() => {
    if (status === "loading") return;
    
    if (!session || session?.sessionExpired || (session?.user.role !== "editor" && session?.user.role !== "super_admin")) {
      setIsLoading(false);
      return;
    }

    fetchEmailAlertLogs();
  }, [session, status, showUnreadOnly, selectedDappId, selectedEmail]);

  const filteredLogs = emailAlertLogs.filter(log =>
    log.dappName.toLowerCase().includes(filter.toLowerCase()) ||
    log.email.toLowerCase().includes(filter.toLowerCase())
  );

  const uniqueDapps = [...new Set(emailAlertLogs.map(log => ({ id: log.dappId, name: log.dappName })))];
  const uniqueEmails = [...new Set(emailAlertLogs.map(log => log.email))];

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            {/* Header Skeleton */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 opacity-90"></div>
                <div className="relative px-8 py-12">
                  <div className="animate-pulse">
                    <div className="h-8 bg-white/20 rounded-lg mb-4 w-3/4"></div>
                    <div className="h-4 bg-white/20 rounded-lg w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Skeleton */}
            <div className="px-8 py-6 bg-gray-50 border-b border-gray-200">
              <div className="animate-pulse">
                <div className="h-10 bg-gray-200 rounded-lg mb-4"></div>
                <div className="flex gap-4">
                  <div className="h-8 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-32"></div>
                  <div className="h-8 bg-gray-200 rounded w-28"></div>
                </div>
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    {['Status', 'DApp', 'Email', 'New Balance', 'Threshold', 'Sent At', 'Actions'].map((header) => (
                      <th key={header} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[1, 2, 3, 4, 5].map((row) => (
                    <tr key={row} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-8 bg-gray-200 rounded w-20"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session || session?.sessionExpired || (session?.user.role !== "editor" && session?.user.role !== "super_admin")) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">You don't have permission to view this page.</p>
            <button
              onClick={() => signOut()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 opacity-90"></div>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
              }}></div>
              <div className="relative px-8 py-12">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  Email Alert Logs
                </h1>
                <p className="mt-2 text-blue-100 max-w-3xl">
                  Monitor and manage email alert notifications sent to DApp administrators
                </p>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="px-8 py-6 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by DApp name or email..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                {/* DApp Filter */}
                <select
                  value={selectedDappId}
                  onChange={(e) => setSelectedDappId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All DApps</option>
                  {uniqueDapps.map((dapp) => (
                    <option key={dapp.id} value={dapp.id}>{dapp.name}</option>
                  ))}
                </select>

                {/* Email Filter */}
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Emails</option>
                  {uniqueEmails.map((email) => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>

                {/* Unread Only Toggle */}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUnreadOnly}
                    onChange={(e) => setShowUnreadOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Unread only</span>
                </label>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="mt-4 flex flex-wrap gap-3">
              {emailAlertLogs.filter(log => !log.isRead).length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Mark All as Read</span>
                  </button>
                  
                  <span className="text-sm text-gray-500 self-center">
                    {emailAlertLogs.filter(log => !log.isRead).length} unread alerts
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-8 py-6 bg-white border-b border-gray-200">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-600">Total Alerts</p>
              <p className="text-2xl font-semibold text-blue-900">{emailAlertLogs.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-600">Read</p>
              <p className="text-2xl font-semibold text-green-900">
                {emailAlertLogs.filter(log => log.isRead).length}
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-yellow-600">Unread</p>
              <p className="text-2xl font-semibold text-yellow-900">
                {emailAlertLogs.filter(log => !log.isRead).length}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-purple-600">Unique DApps</p>
              <p className="text-2xl font-semibold text-purple-900">{uniqueDapps.length}</p>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Email Alert Logs</h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    Total: <span className="font-semibold">{emailAlertLogs.length}</span>
                  </span>
                  <span className="text-sm text-yellow-600">
                    Unread: <span className="font-semibold">{emailAlertLogs.filter(log => !log.isRead).length}</span>
                  </span>
                  <span className="text-sm text-green-600">
                    Read: <span className="font-semibold">{emailAlertLogs.filter(log => log.isRead).length}</span>
                  </span>
                </div>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    DApp
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    New Balance
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Threshold
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className={`hover:bg-gray-50 transition-all duration-200 ${!log.isRead ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-3 w-3 rounded-full ${log.isRead ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                        <span className="ml-2 text-sm text-gray-500">
                          {log.isRead ? 'Read' : 'Unread'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{log.dappName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{log.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatBalance(log.newBalance)} KAIA</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatBalance(log.threshold)} KAIA</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(log.sentAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        {!log.isRead && (
                          <>
                            <button
                              onClick={() => markAsRead(log.id)}
                              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                            >
                              Mark Read
                            </button>
                            <button
                              onClick={() => markDappAsRead(log.dappId)}
                              className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                              title={`Mark all alerts for ${log.dappName} as read`}
                            >
                              Mark DApp Read
                            </button>
                          </>
                        )}
                        {log.isRead && (
                          <span className="text-sm text-gray-400 px-3 py-1">Already read</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="px-8 py-12 text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No email alerts found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search terms.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 