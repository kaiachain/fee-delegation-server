"use client";

import { useEffect, useState, useRef } from "react";
import DappCard from "../components/DappCard";
import DelDappBtn from "../components/DelDappBtn";
import { fetchData } from "@/lib/apiUtils";
import { useSession, signOut } from "next-auth/react";
import AddDappBtn from "../components/AddDappBtn";
import { Dapp } from "../types";
import Modal from "react-modal";

export default function Management() {
  const [isLoading, setIsLoading] = useState(true);
  const [dapps, setDapps] = useState<any[]>([]);
  const { data: session, status } = useSession();
  const [filter, setFilter] = useState("");
  const [showSearchTooltip, setShowSearchTooltip] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const getDapps = async () => {
    const result = await fetchData("/dapps/management", { method: "GET" }, session);
    if (!result.status) {
      console.error("Failed to fetch DApps:", result.message);
      return [];
    }
    return result.data;
  };

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session) {
      setIsLoading(false);
      return;
    }

    if (session?.sessionExpired) {
      setIsLoading(false);
      return;
    }

    if (session?.user.role !== "editor") {
      setIsLoading(false);
      return;
    }

    getDapps().then((dapps) => {
      setDapps(dapps);
      setIsLoading(false);
    });
  }, [session, status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setIsSortMenuOpen(false);
  };

  const deleteDapp = async (dappId: string) => {
      const result = await fetchData(
        "/dapps/",
        { method: "DELETE", body: { id: dappId } },
        session
      );
      if (!result.status) {
        return;
      }
      setDapps(dapps.filter((dapp) => dapp.id !== dappId));
  };



  const onDappAdd = (dapp: Dapp) => {
    setDapps([...dapps, { ...dapp, active: true }]);
  };

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

  const filteredDapps = dapps.filter(
    (dapp) => {
      return (activeTab === "all" || 
       (activeTab === "active" && dapp.active) || 
       (activeTab === "inactive" && !dapp.active)) &&
      (dapp.name.toLowerCase().includes(filter.toLowerCase()) ||
      dapp.url.toLowerCase().includes(filter.toLowerCase()) ||
      dapp.contracts.some((contract: any) =>
        contract.address.toLowerCase().includes(filter.toLowerCase())
      ));
    }
  );

  const sortedAndFilteredDapps = filteredDapps.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "active":
        comparison = (a.active === b.active) ? 0 : a.active ? -1 : 1;
        break;
      case "balance":
        comparison = Number(a.balance) - Number(b.balance);
        break;
      case "totalUsed":
        comparison = Number(a.totalUsed) - Number(b.totalUsed);
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const stats = {
    total: dapps.length,
    active: dapps.filter(dapp => dapp.active).length,
    inactive: dapps.filter(dapp => !dapp.active).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-500 opacity-90"></div>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M50 20c-16.569 0-30 13.431-30 30s13.431 30 30 30 30-13.431 30-30-13.431-30-30-30zm0 10c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20zm-5 15a5 5 0 100 10 5 5 0 000-10zm10 0a5 5 0 100 10 5 5 0 000-10zm-5 10a5 5 0 100 10 5 5 0 000-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '100px 100px'
              }}></div>
              <div className="relative px-8 py-12">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  DApp Management
                </h1>
                <p className="mt-2 text-violet-100 max-w-3xl">
                  Manage your decentralized applications and monitor their performance
                </p>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-8 py-6 bg-gray-50 border-b border-gray-200">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Total DApps</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Active DApps</p>
                <p className="text-2xl font-semibold text-green-600">{stats.active}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Inactive DApps</p>
                <p className="text-2xl font-semibold text-gray-600">{stats.inactive}</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Search and Filter Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
              {/* Left side: Tabs */}
              <div className="flex items-center">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      activeTab === "all"
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    All DApps
                  </button>
                  <button
                    onClick={() => setActiveTab("active")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      activeTab === "active"
                        ? "bg-green-100 text-green-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setActiveTab("inactive")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      activeTab === "inactive"
                        ? "bg-gray-100 text-gray-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {/* Right side: Search, Sort and Add Button */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search dapps..."
                        className="w-64 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                      />
                      <button
                        onMouseEnter={() => setShowSearchTooltip(true)}
                        onMouseLeave={() => setShowSearchTooltip(false)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative" ref={sortMenuRef}>
                      <button
                        onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        <span>Sort</span>
                        <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isSortMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            <div className="px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                              Sort by
                            </div>
                            <button
                              onClick={() => handleSort("name")}
                              className={`flex items-center justify-between w-full px-4 py-2 text-sm ${sortBy === "name" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"}`}
                            >
                              <span>Name</span>
                              {sortBy === "name" && (
                                <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleSort("createdAt")}
                              className={`flex items-center justify-between w-full px-4 py-2 text-sm ${sortBy === "createdAt" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"}`}
                            >
                              <span>Created Date</span>
                              {sortBy === "createdAt" && (
                                <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleSort("active")}
                              className={`flex items-center justify-between w-full px-4 py-2 text-sm ${sortBy === "active" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"}`}
                            >
                              <span>Status</span>
                              {sortBy === "active" && (
                                <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleSort("balance")}
                              className={`flex items-center justify-between w-full px-4 py-2 text-sm ${sortBy === "balance" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"}`}
                            >
                              <span>Balance</span>
                              {sortBy === "balance" && (
                                <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleSort("totalUsed")}
                              className={`flex items-center justify-between w-full px-4 py-2 text-sm ${sortBy === "totalUsed" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"}`}
                            >
                              <span>Total Used</span>
                              {sortBy === "totalUsed" && (
                                <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <AddDappBtn onDappAdd={onDappAdd} />
              </div>
            </div>

            {/* DApps Grid */}
            <div className="grid grid-cols-1 gap-6">
              {sortedAndFilteredDapps.map((dapp) => (
                <DappCard key={dapp.id} dapp={dapp} deleteDapp={deleteDapp}>
                </DappCard>
              ))}
            </div>

            {sortedAndFilteredDapps.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg mt-6">
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
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="mt-2 text-gray-500 text-lg">
                  No dapps found. Add your first dapp to get started.
                </p>
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
}