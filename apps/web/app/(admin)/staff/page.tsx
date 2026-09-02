"use client";

import { useEffect, useState } from "react";
import { fetchStaff, createStaff, updateStaff, deleteStaff, type StaffUser, type AdminRole } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin",
  FULFILLMENT_STAFF: "Fulfillment staff",
};

export default function StaffPage() {
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("FULFILLMENT_STAFF");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    fetchStaff()
      .then(setStaff)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load staff accounts."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!username.trim() || !password || !name.trim()) {
      setFormError("Username, password, and name are all required.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const created = await createStaff({ username: username.trim(), password, name: name.trim(), role });
      setStaff((prev) => [...prev, created]);
      setUsername("");
      setPassword("");
      setName("");
      setRole("FULFILLMENT_STAFF");
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create staff account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: StaffUser, nextRole: AdminRole) {
    try {
      const updated = await updateStaff(member.id, { role: nextRole });
      setStaff((prev) => prev.map((s) => (s.id === member.id ? updated : s)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role.");
    }
  }

  async function handleResetPassword(member: StaffUser) {
    if (resetPassword.length < 8) return;
    try {
      await updateStaff(member.id, { password: resetPassword });
      setResettingId(null);
      setResetPassword("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reset password.");
    }
  }

  async function handleDelete(member: StaffUser) {
    if (!confirm(`Remove ${member.name}'s staff account? They'll lose access immediately.`)) return;
    try {
      await deleteStaff(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove staff account.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Staff</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Admin backoffice accounts — Admins can manage everything, Fulfillment staff has restricted access (see role checks throughout).
      </p>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">All accounts ({staff.length})</p>
          <button onClick={() => setShowCreate((v) => !v)} className="text-xs font-medium text-brand-600 hover:underline">
            {showCreate ? "Cancel" : "+ Add staff"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="border-b border-ink-100 bg-gray-50 px-5 py-4">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-ink-500">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-40 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-40 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="mt-1 w-40 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AdminRole)}
                  className="mt-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="FULFILLMENT_STAFF">Fulfillment staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create account"}
              </button>
            </div>
            {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          </form>
        )}

        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-500">Loading...</p>
        ) : error ? (
          <p className="px-5 py-6 text-sm text-red-600">{error}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Username</th>
                <th className="px-5 py-2 font-medium">Role</th>
                <th className="px-5 py-2 font-medium">Joined</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const isSelf = member.username === user?.username;
                return (
                  <tr key={member.id} className="border-b border-ink-100 last:border-0 align-top">
                    <td className="px-5 py-2 text-ink-900">
                      {member.name}
                      {isSelf && <span className="ml-1.5 text-xs text-ink-400">(you)</span>}
                    </td>
                    <td className="px-5 py-2 font-mono text-ink-700">{member.username}</td>
                    <td className="px-5 py-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as AdminRole)}
                        disabled={isSelf}
                        className="rounded-md border border-ink-100 px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100"
                      >
                        <option value="FULFILLMENT_STAFF">{ROLE_LABELS.FULFILLMENT_STAFF}</option>
                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                      </select>
                    </td>
                    <td className="px-5 py-2 text-ink-700">{new Date(member.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-2 text-right">
                      {resettingId === member.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="New password"
                            className="w-32 rounded-md border border-ink-100 px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                          <button
                            onClick={() => handleResetPassword(member)}
                            disabled={resetPassword.length < 8}
                            className="text-xs font-medium text-brand-600 hover:underline disabled:text-ink-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setResettingId(null);
                              setResetPassword("");
                            }}
                            className="text-xs font-medium text-ink-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setResettingId(member.id)}
                            className="text-xs font-medium text-brand-600 hover:underline"
                          >
                            Reset password
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => handleDelete(member)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
