"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import UserModal, { UserForm } from "@/app/components/UserModal";
import { fetchData } from "@/lib/apiUtils";

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    if (session?.user.role !== "super_admin") {
      setLoading(false);
      return;
    }
    (async () => {
      const res = await fetchData("/users", { method: "GET" }, session);
      if (!res.status) {
        setError(res.message || "Failed to load users");
      } else {
        setUsers(res.data);
      }
      setLoading(false);
    })();
  }, [session, status]);

  const onCreate = async (data: UserForm) => {
    const res = await fetchData("/users", { method: "POST", body: data }, session);
    if (!res.status) throw new Error(res.message || "Create failed");
    setUsers((prev) => [{ id: res.data.id, email: data.email, firstName: data.firstName, lastName: data.lastName, role: data.role, isActive: true }, ...prev]);
  };

  const onUpdate = async (data: UserForm) => {
    const res = await fetchData(`/users/${data.id}`, { method: "PUT", body: { firstName: data.firstName, lastName: data.lastName, role: data.role, isActive: data.isActive } }, session);
    if (!res.status) throw new Error(res.message || "Update failed");
    setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
  };

  const onDeactivate = async (id: string) => {
    const res = await fetchData(`/users/${id}`, { method: "DELETE" }, session);
    if (!res.status) return;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: false } : u)));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (session?.user.role !== "super_admin") {
    return <div className="min-h-screen flex items-center justify-center">Access denied</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Users</h1>
            <button onClick={() => { setEditing(null); setOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create User</button>
          </div>
          {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Email', 'Name', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{u.firstName} {u.lastName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">{u.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {u.isActive ? <span className="text-green-600">Active</span> : <span className="text-gray-500">Inactive</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm flex space-x-2">
                      <button onClick={() => { setEditing(u); setOpen(true); }} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Edit</button>
                      {u.isActive && (
                        <button onClick={() => onDeactivate(u.id)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <UserModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initialUser={editing}
        onSubmit={(data) => (editing ? onUpdate(data) : onCreate(data))}
      />
    </div>
  );
}


