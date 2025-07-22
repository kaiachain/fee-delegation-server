"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";

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
  const { data: session, status } = useSession();

  const fetchEmailAlertLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (showUnreadOnly) {
        params.append("isRead", "false");
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
        body: { id: logId, isRead: true }
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

  const formatBalance = (balance: string) => {
    return (BigInt(balance) / BigInt(10 ** 18)).toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  useEffect(() => {
    if (status === "loading") return;
    
    if (!session || session?.sessionExpired || session?.user.role !== "editor") {
      setIsLoading(false);
      return;
    }

    fetchEmailAlertLogs();
  }, [session, status, showUnreadOnly]);

  const filteredLogs = emailAlertLogs.filter(log =>
    log.dappName.toLowerCase().includes(filter.toLowerCase()) ||
    log.email.toLowerCase().includes(filter.toLowerCase())
  );

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session || session?.sessionExpired || session?.user.role !== "editor") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-100 via-pink-100 to-orange-100 rounded-full blur-xl opacity-70"></div>
                <div className="relative bg-gradient-to-br from-red-500 via-pink-500 to-orange-500 p-8 rounded-full">
                  <div className="relative">
                    <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-red-500 mb-2">
              Access Denied
            </div>
            <p className="text-gray-600">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-red-500 to-pink-500 opacity-90"></div>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M50 20c-16.569 0-30 13.431-30 30s13.431 30 30 30 30-13.431 30-30-13.431-30-30-30zm0 10c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20zm-5 15a5 5 0 100 10 5 5 0 000-10zm10 0a5 5 0 100 10 5 5 0 000-10zm-5 10a5 5 0 100 10 5 5 0 000-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '100px 100px'
              }}></div>
              <div className="relative px-8 py-12">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  Email Alert Tracking
                </h1>
                <p className="mt-2 text-orange-100 max-w-3xl">
                  Monitor all sent email alerts for low balance thresholds
                </p>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-8 py-6 bg-gray-50 border-b border-gray-200">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Total Alerts</p>
                <p className="text-2xl font-semibold text-gray-900">{emailAlertLogs.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Unread Alerts</p>
                <p className="text-2xl font-semibold text-orange-600">{emailAlertLogs.filter(log => !log.isRead).length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Read Alerts</p>
                <p className="text-2xl font-semibold text-green-600">{emailAlertLogs.filter(log => log.isRead).length}</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Search and Filter Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search by DApp name or email..."
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                />
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showUnreadOnly}
                    onChange={(e) => setShowUnreadOnly(e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Show unread only</span>
                </label>
              </div>
              <button
                onClick={fetchEmailAlertLogs}
                className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Refresh
              </button>
            </div>

            {/* Email Alert Logs */}
            <div className="space-y-4">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-6 rounded-lg border transition-all duration-200 ${
                      log.isRead
                        ? "bg-gray-50 border-gray-200"
                        : "bg-orange-50 border-orange-200 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {log.dappName}
                          </h3>
                          {!log.isRead && (
                            <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Email</p>
                            <p className="text-gray-900">{log.email}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Current Balance</p>
                            <p className="text-red-600 font-semibold">{formatBalance(log.newBalance)} KAIA</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Threshold</p>
                            <p className="text-orange-600 font-semibold">{formatBalance(log.threshold)} KAIA</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500">
                            Sent: {formatDate(log.sentAt)}
                          </p>
                          {!log.isRead && (
                            <button
                              onClick={() => markAsRead(log.id)}
                              className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors duration-200"
                            >
                              Mark as Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-gray-500 text-lg">
                    No email alerts found.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 