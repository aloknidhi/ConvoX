import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AlertBanner } from './AlertBanner';

export function NewGroupModal({ isOpen, onClose, onGroupCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDescription('');
    setSelectedUserIds([]);
    setSearchQuery('');
    setError(null);

    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const data = await api.searchUsers('', 100);
        // Exclude current logged in user from member choices
        const filtered = (data?.users || []).filter((u) => u.id !== user?.id);
        setAvailableUsers(filtered);
      } catch (err) {
        setError(err.message || 'Failed to load available members.');
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, [isOpen, user?.id]);

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
    );
  }, [availableUsers, searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedUserIds,
      });

      if (res?.conversation) {
        onGroupCreated?.(res.conversation);
        onClose?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md glass-panel border border-border-hairline/50 rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-hairline/50 flex items-center justify-between shrink-0 glass-surface">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl glass-surface border border-border-hairline/50 flex items-center justify-center text-primary shadow-xs">
              <span className="material-symbols-outlined text-[19px]">group_add</span>
            </div>
            <div>
              <h2 id="new-group-modal-title" className="text-base font-bold text-primary leading-tight">
                Create New Group
              </h2>
              <p className="text-[11px] text-outline font-mono">Chat with multiple team members</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass-surface border border-border-hairline/50 hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors shadow-xs cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

            {/* Group Name */}
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">
                Group Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering Core Team"
                maxLength={100}
                required
                className="input-glass w-full px-3 py-2 text-xs rounded-xl border border-border-hairline/50 focus:border-secondary focus:outline-none transition-all shadow-xs placeholder:text-outline/70"
                autoFocus
              />
              <div className="text-[10px] text-outline font-mono text-right mt-0.5">
                {name.length}/100
              </div>
            </div>

            {/* Group Description */}
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">
                Description <span className="text-outline text-[11px] font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group about?"
                maxLength={500}
                rows={2}
                className="input-glass w-full px-3 py-2 text-xs rounded-xl border border-border-hairline/50 focus:border-secondary focus:outline-none transition-all resize-none shadow-xs placeholder:text-outline/70"
              />
            </div>

            {/* Member Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-primary">
                  Select Members
                </label>
                <span className="text-[11px] font-mono text-secondary font-semibold">
                  {selectedUserIds.length} selected
                </span>
              </div>

              {/* Search User Input */}
              <div className="relative mb-2">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter people..."
                  className="input-glass w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border-hairline/50 focus:border-secondary focus:outline-none shadow-xs placeholder:text-outline/70"
                />
              </div>

              {/* User List */}
              <div className="border border-border-hairline/50 rounded-xl max-h-48 overflow-y-auto divide-y divide-border-hairline/60 shadow-xs">
                {loadingUsers ? (
                  <div className="py-6 text-center text-xs text-outline flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                    <span>Loading people...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-outline">
                    {searchQuery ? 'No members match your filter.' : 'No other users registered.'}
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleUserSelection(u.id)}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-surface-container-low font-medium' : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary-container text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs">
                            {(u.fullName || u.username)[0].toUpperCase()}
                          </div>
                          <div className="truncate text-xs">
                            <span className="font-semibold text-on-surface">{u.fullName}</span>
                            <span className="ml-1.5 text-outline font-mono text-[10px]">@{u.username}</span>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-secondary focus:ring-secondary/20 cursor-pointer pointer-events-none"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 border-t border-border-hairline/50 glass-surface flex items-center justify-end gap-3 shrink-0 shadow-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-surface-container-low text-on-surface-variant transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Group</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewGroupModal;
