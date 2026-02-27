"use client";

import { useEffect, useState } from "react";
import { fetchData } from "@/lib/apiUtils";
import { useSession } from "next-auth/react";

interface RpcUrl {
  id: string;
  url: string;
  active: boolean;
  createdAt: string;
}

interface PingResult {
  healthy: boolean;
  latencyMs: number;
}

export default function RpcUrlsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [rpcUrls, setRpcUrls] = useState<RpcUrl[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pingResults, setPingResults] = useState<Record<string, PingResult | "loading">>({});
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getRpcUrls = async () => {
    const result = await fetchData("/rpc-urls", { method: "GET" }, session);
    if (!result.status) {
      setError(result.message || "Failed to load RPC URLs");
      return [];
    }
    return result.data;
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session?.user?.role !== "super_admin") {
      setIsLoading(false);
      return;
    }
    getRpcUrls().then((urls) => {
      setRpcUrls(urls);
      setIsLoading(false);
    });
  }, [session, status]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setIsAdding(true);
    setError("");

    const result = await fetchData(
      "/rpc-urls",
      { method: "POST", body: { url: newUrl.trim() } },
      session
    );

    if (!result.status) {
      setError(result.message || "Failed to add RPC URL");
      setIsAdding(false);
      return;
    }

    setRpcUrls([...rpcUrls, result.data]);
    setNewUrl("");
    setIsAdding(false);
    showSuccess("RPC URL added successfully");
  };

  const handleToggle = async (id: string, active: boolean) => {
    const result = await fetchData(
      `/rpc-urls/${id}`,
      { method: "PUT", body: { active } },
      session
    );
    if (!result.status) {
      setError(result.message || "Failed to update RPC URL");
      return;
    }
    setRpcUrls(rpcUrls.map((r) => (r.id === id ? { ...r, active } : r)));
    showSuccess(`RPC URL ${active ? "activated" : "deactivated"}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this RPC URL?")) return;

    const result = await fetchData(
      `/rpc-urls/${id}`,
      { method: "DELETE" },
      session
    );
    if (!result.status) {
      setError(result.message || "Failed to delete RPC URL");
      return;
    }
    setRpcUrls(rpcUrls.filter((r) => r.id !== id));
    showSuccess("RPC URL deleted");
  };

  const handlePing = async (id: string) => {
    setPingResults((prev) => ({ ...prev, [id]: "loading" }));
    const result = await fetchData(
      `/rpc-urls/${id}/ping`,
      { method: "POST" },
      session
    );
    if (!result.status) {
      setPingResults((prev) => ({ ...prev, [id]: { healthy: false, latencyMs: 0 } }));
      return;
    }
    setPingResults((prev) => ({ ...prev, [id]: result.data }));
  };

  const handlePingAll = async () => {
    for (const rpc of rpcUrls) {
      handlePing(rpc.id);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session || session?.user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
          <p className="text-gray-400">Only Super Admin can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">RPC URL Management</h1>
          <p className="mt-2 text-gray-600">
            Manage RPC endpoints used by the fee delegation server. Changes take effect immediately.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 font-bold">x</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Add URL Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New RPC URL</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="https://your-rpc-endpoint.com"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-400"
              disabled={isAdding}
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !newUrl.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isAdding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* URL List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              RPC URLs ({rpcUrls.length})
            </h2>
            {rpcUrls.length > 0 && (
              <button
                onClick={handlePingAll}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                Ping All
              </button>
            )}
          </div>

          {rpcUrls.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              <p className="text-lg font-medium">No RPC URLs configured</p>
              <p className="mt-1">Add an RPC URL above to get started. The server will fall back to the RPC_URL environment variable if no URLs are in the database.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rpcUrls.map((rpc) => {
                const ping = pingResults[rpc.id];
                return (
                  <div key={rpc.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rpc.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {rpc.active ? "Active" : "Inactive"}
                          </span>
                          <code className="text-sm text-gray-900 font-mono truncate block">
                            {rpc.url}
                          </code>
                        </div>
                        <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-500">
                          <span>Added {new Date(rpc.createdAt).toLocaleDateString()}</span>
                          {ping && ping !== "loading" && (
                            <span className={`font-medium ${ping.healthy ? "text-green-600" : "text-red-600"}`}>
                              {ping.healthy ? `Healthy (${ping.latencyMs}ms)` : "Unhealthy"}
                            </span>
                          )}
                          {ping === "loading" && (
                            <span className="text-blue-500 animate-pulse">Pinging...</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handlePing(rpc.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ping"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggle(rpc.id, !rpc.active)}
                          className={`p-2 rounded-lg transition-colors ${
                            rpc.active
                              ? "text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                              : "text-green-400 hover:text-green-600 hover:bg-green-50"
                          }`}
                          title={rpc.active ? "Deactivate" : "Activate"}
                        >
                          {rpc.active ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(rpc.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
