"use client";

import { useEffect, useState } from "react";

export type UserForm = {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "editor" | "viewer";
  isActive?: boolean;
};

export default function UserModal({
  isOpen,
  onClose,
  onSubmit,
  initialUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserForm) => Promise<void> | void;
  initialUser?: UserForm | null;
}) {
  const [form, setForm] = useState<UserForm>({
    email: "",
    firstName: "",
    lastName: "",
    role: "viewer",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUser) {
      setForm({
        id: initialUser.id,
        email: initialUser.email,
        firstName: initialUser.firstName,
        lastName: initialUser.lastName,
        role: initialUser.role,
        isActive: initialUser.isActive,
      });
    } else {
      setForm({ email: "", firstName: "", lastName: "", role: "viewer", isActive: true });
    }
    setError(null);
    setSaving(false);
  }, [initialUser, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.email || !/.+@.+\..+/.test(form.email)) {
        setError("Invalid email");
        setSaving(false);
        return;
      }
      if (!form.firstName || !form.lastName) {
        setError("First and last name are required");
        setSaving(false);
        return;
      }
      await onSubmit(form);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{form.id ? "Edit User" : "Create User"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              placeholder="you@example.com"
              required
              disabled={!!form.id}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            {form.id && (
              <div className="flex items-end">
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={!!form.isActive}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            )}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


