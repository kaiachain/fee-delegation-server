"use client";

import { useEffect, useState, useRef } from "react";
import { fetchData } from "@/lib/apiUtils";
import { useSession } from "next-auth/react";
import UserModal from "../components/UserModal";
import ErrorModal from "../components/ErrorModal";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN" | "EDITOR" | "VIEWER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastLoginAt?: string;
}

export default function UsersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const { data: session, status } = useSession();
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("email");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
  });

  const getUsers = async () => {
    const result = await fetchData("/users", { method: "GET" }, session);
    if (!result.status) {
      console.error("Failed to fetch users:", result.message);
      setErrorModal({
        isOpen: true,
        title: "Failed to Load Users",
        message: result.message || "Unable to load users. Please try again."
      });
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

    if (session?.user.role !== "super_admin") {
      setIsLoading(false);
      return;
    }

    getUsers().then((users) => {
      setUsers(users);
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

  const handleUserAdd = (user: User) => {
    setUsers([...users, user]);
  };

  const handleUserUpdate = (updatedUser: User) => {
    setUsers(users.map(user => user.id === updatedUser.id ? updatedUser : user));
  };

  const handleToggleUserStatus = async (userId: string, newStatus: boolean) => {
    const result = await fetchData(
      `/users/${userId}`,
      { 
        method: "PUT",
        body: { isActive: newStatus }
      },
      session
    );
    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: `Failed to ${newStatus ? 'Activate' : 'Deactivate'} User`,
        message: result.message || `Unable to ${newStatus ? 'activate' : 'deactivate'} user. Please try again.`
      });
      return;
    }
    
    setUsers(users.map(user => 
      user.id === userId ? { ...user, isActive: newStatus } : user
    ));

    setSuccessModal({
      isOpen: true,
      title: `User ${newStatus ? 'Activated' : 'Deactivated'}`,
      message: `User has been ${newStatus ? 'activated' : 'deactivated'} successfully.`
    });
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await fetchData(
      `/users/${userId}`,
      { method: "DELETE" },
      session
    );
    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Delete User",
        message: result.message || "Unable to delete user. Please try again."
      });
      return;
    }
    
    // For soft delete, just deactivate the user
    setUsers(users.map(user => 
      user.id === userId ? { ...user, isActive: false } : user
    ));

    setSuccessModal({
      isOpen: true,
      title: "User Deleted",
      message: "User has been deactivated successfully."
    });
  };

  const handleTriggerPasswordReset = async (userId: string) => {
    const result = await fetchData(
      `/users/${userId}/reset-password`,
      { method: "POST" },
      session
    );
    if (!result.status) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Send Password Reset",
        message: result.message || "Unable to send password reset email. Please try again."
      });
      return;
    }
    
    // Show success message
    setErrorModal({
      isOpen: true,
      title: "Password Reset Sent",
      message: "A password reset email has been sent to the user."
    });
  };

  const convertTime = (time: string) => {
    if (!time) return "Never";
    const date = new Date(time);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session || session?.sessionExpired || session?.user.role !== "super_admin") {
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
              You need Super Admin privileges to access user management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    return (activeTab === "all" || 
     (activeTab === "active" && user.isActive) || 
     (activeTab === "inactive" && !user.isActive)) &&
    (user.email.toLowerCase().includes(filter.toLowerCase()) ||
    user.firstName.toLowerCase().includes(filter.toLowerCase()) ||
    user.lastName.toLowerCase().includes(filter.toLowerCase()));
  });

  const sortedAndFilteredUsers = filteredUsers.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "name":
        comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        break;
      case "role":
        comparison = a.role.localeCompare(b.role);
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "lastLoginAt":
        const aLogin = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bLogin = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        comparison = aLogin - bLogin;
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const stats = {
    total: users.length,
    active: users.filter(user => user.isActive).length,
    inactive: users.filter(user => !user.isActive).length,
    editors: users.filter(user => user.role === 'EDITOR').length,
    viewers: users.filter(user => user.role === 'VIEWER').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 opacity-90"></div>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M50 20c-16.569 0-30 13.431-30 30s13.431 30 30 30 30-13.431 30-30-13.431-30-30-30zm0 10c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20zm-5 15a5 5 0 100 10 5 5 0 000-10zm10 0a5 5 0 100 10 5 5 0 000-10zm-5 10a5 5 0 100 10 5 5 0 000-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '100px 100px'
              }}></div>
              <div className="relative px-8 py-12">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  User Management
                </h1>
                <p className="mt-2 text-purple-100 max-w-3xl">
                  Manage email-authenticated users and their access permissions
                </p>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 px-8 py-6 bg-gray-50 border-b border-gray-200">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Active Users</p>
                <p className="text-2xl font-semibold text-green-600">{stats.active}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Inactive Users</p>
                <p className="text-2xl font-semibold text-gray-600">{stats.inactive}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Editors</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.editors}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-500">Viewers</p>
                <p className="text-2xl font-semibold text-purple-600">{stats.viewers}</p>
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
                    All Users
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
                        placeholder="Search users..."
                        className="w-64 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                      />
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
                            {[
                              { key: "email", label: "Email" },
                              { key: "name", label: "Name" },
                              { key: "role", label: "Role" },
                              { key: "createdAt", label: "Created Date" },
                              { key: "lastLoginAt", label: "Last Login" },
                            ].map(({ key, label }) => (
                              <button
                                key={key}
                                onClick={() => handleSort(key)}
                                className={`flex items-center justify-between w-full px-4 py-2 text-sm ${sortBy === key ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"}`}
                              >
                                <span>{label}</span>
                                {sortBy === key && (
                                  <svg className={`h-4 w-4 transform transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setEditingUser(undefined);
                    setIsUserModalOpen(true);
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add User
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedAndFilteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {user.firstName?.charAt(0) || '?'}{user.lastName?.charAt(0) || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'EDITOR' 
                            ? 'bg-blue-100 text-blue-800' 
                            : user.role === 'VIEWER'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.role.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {convertTime(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLoginAt ? convertTime(user.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setIsUserModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTriggerPasswordReset(user.id)}
                            className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                          >
                            Reset PW
                          </button>
                          {user.isActive ? (
                            <button
                              onClick={() => handleToggleUserStatus(user.id, false)}
                              className="text-orange-600 hover:text-orange-900 transition-colors duration-200"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleUserStatus(user.id, true)}
                              className="text-green-600 hover:text-green-900 transition-colors duration-200"
                            >
                              Activate
                            </button>
                          )}
                          {/* <button
                            onClick={() => setDeleteConfirmModal({
                              isOpen: true,
                              userId: user.id,
                              userName: `${user.firstName} ${user.lastName}`
                            })}
                            className="text-red-600 hover:text-red-900 transition-colors duration-200"
                          >
                            Delete
                          </button> */}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sortedAndFilteredUsers.length === 0 && (
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="mt-2 text-gray-500 text-lg">
                  No users found. Add your first user to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(undefined);
        }}
        onUserAdd={handleUserAdd}
        onUserUpdate={handleUserUpdate}
        editingUser={editingUser}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />

      {/* Success Modal */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{successModal.title}</h3>
              <p className="text-sm text-gray-500 mb-4">{successModal.message}</p>
              <button
                onClick={() => setSuccessModal({ ...successModal, isOpen: false })}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete User</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to delete <strong>{deleteConfirmModal.userName}</strong>? This will deactivate their account.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirmModal({ ...deleteConfirmModal, isOpen: false })}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleDeleteUser(deleteConfirmModal.userId);
                    setDeleteConfirmModal({ ...deleteConfirmModal, isOpen: false });
                  }}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


