"use client";

import { useEffect, useState } from "react";
import {
  fetchStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  fetchPermissionCatalog,
  type StaffUser,
  type AdminRole,
  type PermissionCatalog,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  FULFILLMENT_STAFF: "Fulfillment staff",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Add new",
  edit: "Edit",
  delete: "Delete",
  changeStatus: "Change status",
  refund: "Refund",
  adjustStock: "Adjust stock",
  logActivity: "Log activity",
  respond: "Respond",
  manage: "Manage",
  resetData: "Reset data",
};

// Union of every action any module defines, in a stable display order, so
// the grid can render as a real table with one column per action rather
// than a ragged list.
const ACTION_ORDER = [
  "view",
  "create",
  "edit",
  "delete",
  "changeStatus",
  "refund",
  "adjustStock",
  "logActivity",
  "respond",
  "manage",
  "resetData",
];

function PermissionGrid({
  catalog,
  selected,
  onToggle,
  onApplyPreset,
  disabled,
}: {
  catalog: PermissionCatalog;
  selected: Set<string>;
  onToggle: (token: string) => void;
  onApplyPreset: (role: AdminRole) => void;
  disabled?: boolean;
}) {
  const columns = ACTION_ORDER.filter((a) => catalog.catalog.some((m) => m.actions.includes(a)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Start from a preset:</span>
        {(Object.keys(ROLE_LABELS) as AdminRole[]).map((role) => (
          <button
            key={role}
            type="button"
            disabled={disabled}
            onClick={() => onApplyPreset(role)}
            className="rounded-md border border-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
        <span className="text-xs text-ink-400">then fine-tune below</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-ink-100">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-ink-100 bg-gray-50 uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2 font-medium">Module</th>
              {columns.map((a) => (
                <th key={a} className="px-2 py-2 text-center font-medium">
                  {ACTION_LABELS[a] ?? a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.catalog.map((mod) => (
              <tr key={mod.module} className="border-b border-ink-100 last:border-0">
                <td className="px-3 py-2 text-ink-900">{mod.label}</td>
                {columns.map((action) => {
                  const token = `${mod.module}:${action}`;
                  const supported = mod.actions.includes(action);
                  return (
                    <td key={action} className="px-2 py-2 text-center">
                      {supported ? (
                        <input
                          type="checkbox"
                          checked={selected.has(token)}
                          disabled={disabled}
                          onChange={() => onToggle(token)}
                          className="h-4 w-4"
                        />
                      ) : (
                        <span className="text-ink-100">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("FULFILLMENT_STAFF");
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
  const [editSaving, setEditSaving] = useState(false);

  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([fetchStaff(), fetchPermissionCatalog()])
      .then(([users, cat]) => {
        setStaff(users);
        setCatalog(cat);
        // Default the create form to the Fulfillment Staff preset so it's
        // never an empty grid that silently creates a useless account.
        setNewPerms(new Set(cat.presets.FULFILLMENT_STAFF ?? []));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load staff accounts."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, token: string) {
    const next = new Set(set);
    if (next.has(token)) next.delete(token);
    else next.add(token);
    setter(next);
  }

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
      const created = await createStaff({
        username: username.trim(),
        password,
        name: name.trim(),
        role,
        permissions: [...newPerms],
      });
      setStaff((prev) => [...prev, created]);
      setUsername("");
      setPassword("");
      setName("");
      setRole("FULFILLMENT_STAFF");
      setNewPerms(new Set(catalog?.presets.FULFILLMENT_STAFF ?? []));
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create staff account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePermissions(member: StaffUser) {
    setEditSaving(true);
    try {
      const updated = await updateStaff(member.id, { permissions: [...editPerms] });
      setStaff((prev) => prev.map((s) => (s.id === member.id ? updated : s)));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save permissions.");
    } finally {
      setEditSaving(false);
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
      <h1 className="text-2xl font-semibold text-ink-900">Staff</h1>
      <p className="mt-1 text-sm text-ink-500">
        Each account gets its own module access — tick exactly what they can see and do. Admins always have full
        access regardless of these boxes.
      </p>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">All accounts ({staff.length})</p>
          <button onClick={() => setShowCreate((v) => !v)} className="text-xs font-medium text-brand-600 hover:underline">
            {showCreate ? "Cancel" : "+ Add staff"}
          </button>
        </div>

        {showCreate && catalog && (
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
                <label className="block text-xs text-ink-500">Account type</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AdminRole)}
                  className="mt-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="FULFILLMENT_STAFF">Fulfillment staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin (full access)</option>
                </select>
              </div>
            </div>

            {role === "ADMIN" ? (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Admin accounts always have full access to everything, including Staff and Configuration — individual
                permissions below don&apos;t apply to them.
              </p>
            ) : (
              <div className="mt-4">
                <PermissionGrid
                  catalog={catalog}
                  selected={newPerms}
                  onToggle={(t) => toggle(newPerms, setNewPerms, t)}
                  onApplyPreset={(r) => setNewPerms(new Set(catalog.presets[r] ?? []))}
                />
              </div>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create account"}
              </button>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>
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
                <th className="px-5 py-2 font-medium">Access</th>
                <th className="px-5 py-2 font-medium">Joined</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const isSelf = member.username === user?.username;
                const isEditing = editingId === member.id;
                return (
                  <>
                    <tr key={member.id} className="border-b border-ink-100 align-top last:border-0">
                      <td className="px-5 py-2 text-ink-900">
                        {member.name}
                        {isSelf && <span className="ml-1.5 text-xs text-ink-400">(you)</span>}
                      </td>
                      <td className="px-5 py-2 font-mono text-ink-700">{member.username}</td>
                      <td className="px-5 py-2 text-ink-700">
                        {member.isSuperAdmin ? (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                            Full access (Admin)
                          </span>
                        ) : (
                          <span className="text-xs text-ink-500">
                            {member.permissions.length} permission{member.permissions.length === 1 ? "" : "s"}
                          </span>
                        )}
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
                            {!member.isSuperAdmin && (
                              <button
                                onClick={() => {
                                  setEditingId(isEditing ? null : member.id);
                                  setEditPerms(new Set(member.permissions));
                                }}
                                className="text-xs font-medium text-brand-600 hover:underline"
                              >
                                {isEditing ? "Close" : "Permissions"}
                              </button>
                            )}
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
                    {isEditing && catalog && (
                      <tr key={`${member.id}-perms`} className="border-b border-ink-100 bg-gray-50">
                        <td colSpan={5} className="px-5 py-4">
                          <PermissionGrid
                            catalog={catalog}
                            selected={editPerms}
                            onToggle={(t) => toggle(editPerms, setEditPerms, t)}
                            onApplyPreset={(r) => setEditPerms(new Set(catalog.presets[r] ?? []))}
                          />
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => handleSavePermissions(member)}
                              disabled={editSaving}
                              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              {editSaving ? "Saving..." : "Save permissions"}
                            </button>
                            <p className="text-xs text-ink-400">
                              Saving signs {member.name} out of any open sessions.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
