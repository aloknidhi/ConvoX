import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { api } from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { TricolourBadge } from '../components/TricolourBadge';
import { AlertBanner } from '../components/AlertBanner';
import { ChatPanel } from '../components/ChatPanel';
import { ProfileModal } from '../components/ProfileModal';
import { NewGroupModal } from '../components/NewGroupModal';
import { formatPreviewTime, getPresenceStatus } from '../utils/date';

export function DashboardPage() {
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = usePreferences();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'direct', 'groups', 'messages'

  const [selfProfileOpen, setSelfProfileOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Phase 5: Conversation Removal & Contacts State
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'remove_chat'|'remove_contact', conv, user }
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const dropdownRef = useRef(null);

  const pollIntervalRef = useRef(null);
  const activeConversationIdRef = useRef(conversationId);
  activeConversationIdRef.current = conversationId;

  const fetchConversations = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await api.getConversations();
      const rawList = data?.conversations || [];

      // If a conversation is currently open, force its unreadCount to 0 locally
      const currentActiveId = activeConversationIdRef.current;
      const normalizedList = rawList.map((c) => {
        if (currentActiveId && String(c.id) === String(currentActiveId)) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });

      setConversations(normalizedList);
      setError(null);
    } catch (err) {
      if (isInitial) {
        setError(err.message || 'Failed to load conversations.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Fetch contacts on mount
  useEffect(() => {
    api.getContacts()
      .then((res) => {
        if (res?.contacts) setContacts(res.contacts);
      })
      .catch(() => {});
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdownId(null);
      }
    };
    if (activeDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdownId]);

  // Phase 5 Action Handlers
  const handleConfirmRemoveChat = async (targetConv) => {
    if (!targetConv?.id || actionLoading) return;
    try {
      setActionLoading(true);
      setModalError(null);
      await api.removeConversation(targetConv.id);

      // If active conversation is the removed one, navigate to dashboard root
      if (activeConversationIdRef.current && String(activeConversationIdRef.current) === String(targetConv.id)) {
        navigate('/dashboard');
      }

      // Immediately filter from local conversation list
      setConversations((prev) => prev.filter((c) => String(c.id) !== String(targetConv.id)));
      setConfirmModal(null);

      // Refresh from server to ensure complete sync
      fetchConversations(false);
    } catch (err) {
      setModalError(err.message || 'Failed to remove conversation from your chat list.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRemoveContact = async (targetUser) => {
    if (!targetUser?.id || actionLoading) return;
    try {
      setActionLoading(true);
      setModalError(null);
      await api.removeContact(targetUser.id);
      setContacts((prev) => prev.filter((c) => String(c.id) !== String(targetUser.id)));
      setConfirmModal(null);
    } catch (err) {
      setModalError(err.message || 'Failed to remove contact.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddContact = async (targetUser) => {
    if (!targetUser?.id) return;
    try {
      const res = await api.addContact(targetUser.id);
      if (res?.contacts) {
        setContacts(res.contacts);
      } else {
        setContacts((prev) => [...prev, targetUser]);
      }
    } catch (err) {
      console.error('Failed to add contact:', err);
    }
  };

  useEffect(() => {
    fetchConversations(true);

    let failureCount = 0;
    let isCancelled = false;

    const scheduleNext = (delay) => {
      if (isCancelled) return;
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = setTimeout(async () => {
        if (isCancelled) return;
        const hidden = typeof document !== 'undefined' && document.hidden;
        if (hidden) {
          scheduleNext(15000);
          return;
        }
        try {
          await fetchConversations(false);
          failureCount = 0;
          scheduleNext(4000);
        } catch {
          failureCount++;
          const backoff = Math.min(30000, 4000 * Math.pow(1.5, failureCount));
          scheduleNext(backoff);
        }
      }, delay);
    };

    scheduleNext(4000);

    const handleVisibilityChange = () => {
      if (!document.hidden && !isCancelled) {
        failureCount = 0;
        scheduleNext(500);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCancelled = true;
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchConversations]);

  // Debounced global message search effect when 'messages' tab is selected
  useEffect(() => {
    if (activeTab !== 'messages') return;
    if (!searchQuery.trim()) {
      setGlobalResults([]);
      setGlobalLoading(false);
      return;
    }

    let ignore = false;
    setGlobalLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchGlobalMessages(searchQuery.trim());
        if (!ignore) {
          setGlobalResults(res?.messages || []);
        }
      } catch (err) {
        if (!ignore) setGlobalResults([]);
      } finally {
        if (!ignore) setGlobalLoading(false);
      }
    }, 250);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  // When conversationId changes in URL, clear unread count for that conversation in state
  useEffect(() => {
    if (conversationId) {
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(conversationId) ? { ...c, unreadCount: 0 } : c
        )
      );
    }
  }, [conversationId]);

  // Callback from ChatPanel whenever a message is sent or received
  const handleConversationActivity = useCallback(
    ({ conversationId: activityId, lastMessage, isSentByMe, incomingCount = 1 }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => String(c.id) === String(activityId));
        if (index === -1) {
          fetchConversations(false);
          return prev;
        }

        const current = prev[index];
        const isCurrentOpen =
          activeConversationIdRef.current &&
          String(activeConversationIdRef.current) === String(activityId);

        const deltaUnread = (isCurrentOpen || isSentByMe) ? 0 : incomingCount;

        const updated = {
          ...current,
          lastMessage,
          updatedAt: lastMessage.createdAt,
          unreadCount: isCurrentOpen ? 0 : (current.unreadCount || 0) + deltaUnread,
        };

        const remaining = prev.filter((_, i) => i !== index);
        return [updated, ...remaining];
      });
    },
    [fetchConversations]
  );

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const isGroup = c.type === 'group';
      const other = c.participant;
      const name = isGroup ? (c.name || '').toLowerCase() : (other?.fullName?.toLowerCase() || '');
      const handle = isGroup ? '' : (other?.username?.toLowerCase() || '');
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || handle.includes(q);
      if (!matchesSearch) return false;

      if (activeTab === 'unread') {
        return c.unreadCount > 0;
      }
      if (activeTab === 'direct') {
        return !isGroup;
      }
      if (activeTab === 'groups') {
        return isGroup;
      }
      return true;
    });
  }, [conversations, searchQuery, activeTab]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  return (
    <div className="min-h-screen bg-surface flex text-on-surface">
      {/* 72px Fixed Sidebar (collapsible) */}
      <Sidebar />

      {/* Main Content Area offset by sidebar width */}
      <div className={`pl-[72px] flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300`}>
        {/* Top Header Bar */}
        <header className="h-16 glass-panel border-b border-border-hairline/50 z-40 flex items-center justify-between px-6 shrink-0 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="h-9 px-2 py-0.5 rounded-xl bg-white border border-border-hairline/50 flex items-center justify-center shadow-xs cursor-pointer transition-transform hover:scale-105"
              onClick={() => navigate('/dashboard')}
              title="ConvoX Dashboard"
            >
              <img
                src="/ConvoX-logo.png"
                alt="ConvoX"
                className="h-7 w-auto object-contain"
              />
            </div>
            <span className="w-0.5 h-0.5 rounded-full bg-outline-variant"></span>
            <span className="text-sm font-medium text-on-surface-variant">Messages</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-10 h-10 rounded-xl glass-surface text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 transition-all flex items-center justify-center cursor-pointer focus-visible-ring active:scale-95"
            >
              <span className={`material-symbols-outlined text-[19px] ${isDarkMode ? 'text-amber-400' : 'text-slate-700'}`}>
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-container-low border border-border-hairline/50 text-xs font-mono text-on-surface-variant glass-surface">
              <span className="w-2 h-2 rounded-full bg-india-green"></span>
              <span>Logged in as @{user?.username}</span>
            </div>

            <button
              type="button"
              onClick={() => setSelfProfileOpen(true)}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold shadow-md hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer focus-visible-ring"
              title="Edit Profile"
            >
              {(user?.fullName || user?.username || 'U')[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* Dashboard Body: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation List Sidebar: visible always on desktop, hidden on mobile if chat open */}
          <aside
            className={`${
              conversationId ? 'hidden md:flex' : 'flex'
            } w-full md:w-[360px] shrink-0 glass-panel border-r border-border-hairline/50 flex-col h-full z-10 flex-shrink-0`}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-bold text-primary tracking-tight">Messages</h1>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold">
                    {conversations.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setNewGroupOpen(true)}
                    className="w-9 h-9 rounded-xl glass-surface text-on-surface hover:bg-surface-container-low/50 transition-all flex items-center justify-center cursor-pointer focus-visible-ring active:scale-95"
                    title="Create New Group"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">group_add</span>
                  </button>

                  <button
                    onClick={() => navigate('/find-people')}
                    className="w-9 h-9 rounded-xl glass-surface text-on-surface hover:bg-surface-container-low/50 transition-all flex items-center justify-center cursor-pointer focus-visible-ring active:scale-95"
                    title="Find People to message"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform">
                      person_add
                    </span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full flex-shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'messages'
                      ? 'Search all message history...'
                      : 'Search conversations & groups...'
                  }
                  className="w-full pl-9 pr-3 py-2 input-glass text-xs placeholder:text-on-surface-variant/60"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 mt-3 pt-1 overflow-x-auto no-scrollbar flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 cursor-pointer focus-visible-ring ${
                    activeTab === 'all'
                      ? 'btn-glass-primary shadow-xs'
                      : 'btn-glass-secondary text-on-surface-variant hover:bg-surface-container-low/50'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 focus-visible-ring ${
                    activeTab === 'unread'
                      ? 'btn-glass-primary shadow-xs'
                      : 'btn-glass-secondary text-on-surface-variant hover:bg-surface-container-low/50'
                  }`}
                >
                  <span>Unread</span>
                  {totalUnread > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-saffron text-[10px] text-white font-bold">
                      {totalUnread}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('direct')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 cursor-pointer focus-visible-ring ${
                    activeTab === 'direct'
                      ? 'btn-glass-primary shadow-xs'
                      : 'btn-glass-secondary text-on-surface-variant hover:bg-surface-container-low/50'
                  }`}
                >
                  Direct
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('groups')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 cursor-pointer focus-visible-ring ${
                    activeTab === 'groups'
                      ? 'btn-glass-primary shadow-xs'
                      : 'btn-glass-secondary text-on-surface-variant hover:bg-surface-container-low/50'
                  }`}
                >
                  Groups
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('messages')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-1 focus-visible-ring ${
                    activeTab === 'messages'
                      ? 'btn-glass-primary shadow-xs'
                      : 'btn-glass-secondary text-on-surface-variant hover:bg-surface-container-low/50'
                  }`}
                  title="Search message history across all conversations"
                >
                  <span className="material-symbols-outlined text-[14px]">search</span>
                  <span>Messages</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3 flex-shrink-0">
                <AlertBanner type="error" message={error} onClose={() => setError(null)} />
              </div>
            )}

            {/* Global Message Search Results View */}
            {activeTab === 'messages' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!searchQuery.trim() ? (
                  <div className="px-4 py-8 text-center flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-2">
                      <span className="material-symbols-outlined text-[20px]">search</span>
                    </div>
                    <div className="text-xs font-semibold text-primary mb-1">Search Message History</div>
                    <p className="text-[11px] text-on-surface-variant max-w-[200px]">
                      Enter keywords in the search bar above to find matching messages across all your chats.
                    </p>
                  </div>
                ) : globalLoading ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="p-3 rounded-xl bg-surface-container-low animate-pulse space-y-2">
                        <div className="h-3 w-28 bg-surface-container-high rounded"></div>
                        <div className="h-3.5 w-44 bg-surface-container rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : globalResults.length === 0 ? (
                  <div className="px-4 py-8 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-[24px] text-outline mb-2">search_off</span>
                    <div className="text-xs font-semibold text-primary mb-1">No messages found</div>
                    <p className="text-[11px] text-on-surface-variant">
                      No messages matched "{searchQuery}".
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-hairline/60">
                    <div className="px-3.5 py-2 bg-surface-container-low/50 text-[11px] font-mono text-outline flex items-center justify-between">
                      <span>Found {globalResults.length} {globalResults.length === 1 ? 'match' : 'matches'}</span>
                    </div>
                    {globalResults.map((msg) => {
                      const isMe = user && String(msg.senderId) === String(user.id);
                      const displayName = isMe ? 'You' : (msg.senderFullName || `@${msg.senderUsername}`);
                      const dateStr = formatPreviewTime(msg.createdAt);
                      return (
                        <div
                          key={msg.id}
                          onClick={() => navigate(`/dashboard/${msg.conversationId}`)}
                          className="p-3 hover:bg-surface-container-low/50 cursor-pointer transition-colors border-b border-border-hairline/40 last:border-0"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-primary truncate">
                              {displayName}
                            </span>
                            <span className="text-[10px] text-outline font-mono shrink-0">
                              {dateStr}
                            </span>
                          </div>
                          <p className={`text-xs ${msg.isDeleted ? 'italic text-outline' : 'text-on-surface-variant'} line-clamp-2`}>
                            {msg.isDeleted ? 'This message was deleted' : msg.body}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Loading Skeletons */}
            {activeTab !== 'messages' && loading && (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="p-3 rounded-xl bg-surface-container-low animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0"></div>
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-24 bg-surface-container-high rounded"></div>
                      <div className="h-3 w-36 bg-surface-container rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Conversation Empty State List */}
            {activeTab !== 'messages' && !loading && filteredConversations.length === 0 && (
              <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center text-center custom-scrollbar">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-3">
                  <span className="material-symbols-outlined text-[24px]">chat_bubble_outline</span>
                </div>
                <h2 className="text-sm font-semibold text-primary mb-1">
                  {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                </h2>
                <p className="text-xs text-on-surface-variant max-w-[240px] leading-relaxed mb-4">
                  {searchQuery
                    ? 'Try searching for another member name or handle.'
                    : 'Start by finding someone to connect with. New chats will appear here.'}
                </p>
                <button
                  onClick={() => navigate('/find-people')}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl btn-glass-primary shadow-xs cursor-pointer focus-visible-ring"
                  type="button"
                >
                  Find People
                </button>
              </div>
            )}

            {/* Populated Conversation List */}
            {activeTab !== 'messages' && !loading && filteredConversations.length > 0 && (
              <div className="flex-1 overflow-y-auto divide-y divide-border-hairline/60 custom-scrollbar">
                {filteredConversations.map((conv) => {
                  const isGroup = conv.type === 'group';
                  const peer = conv.participant;
                  const initials = isGroup
                    ? (conv.name || 'G')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()
                    : (peer?.fullName || peer?.username || 'U')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase();

                  const lastMsg = conv.lastMessage;
                  let snippet = 'No messages yet';
                  if (lastMsg) {
                    if (isGroup) {
                      const sender = lastMsg.senderId === user?.id ? 'You' : (lastMsg.senderName || `@${lastMsg.senderUsername}`);
                      snippet = `${sender}: ${lastMsg.attachment ? (lastMsg.body || '📎 Attachment') : lastMsg.body}`;
                    } else {
                      snippet = lastMsg.attachment ? (lastMsg.body || '📎 Attachment') : lastMsg.body;
                    }
                  }

                  const timestamp = formatPreviewTime(lastMsg?.createdAt || conv.updatedAt);
                  const hasUnread = conv.unreadCount > 0;
                  const isActive = String(conv.id) === String(conversationId);

                  const isPeerOnline = !isGroup && getPresenceStatus(peer?.lastActiveAt).isOnline;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => navigate(`/dashboard/${conv.id}`)}
                      className={`relative p-3.5 flex items-center justify-between transition-all duration-200 cursor-pointer group border-b border-border-hairline/40 last:border-0 ${
                        isActive
                          ? 'glass-surface bg-surface-container-low/30'
                          : hasUnread
                          ? 'hover:bg-surface-container-low/40'
                          : 'hover:bg-surface-container-low/30'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"></span>
                      )}

                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          {isGroup ? (
                            <div className="w-10 h-10 rounded-xl bg-primary-container text-white flex items-center justify-center text-xs font-bold shadow-xs select-none">
                              <span className="material-symbols-outlined text-[20px]">groups</span>
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center text-xs shadow-xs select-none">
                              {initials}
                            </div>
                          )}
                          {isPeerOnline && (
                            <span
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-india-green rounded-full ring-2 ring-surface-container-lowest"
                              title="Active now"
                            ></span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-xs truncate ${isActive || hasUnread ? 'text-primary font-bold' : 'text-on-surface'}`}
                              >
                                {isGroup ? conv.name : (peer?.fullName || `@${peer?.username}`)}
                              </span>
                              {isGroup && (
                                <span className="px-1.5 py-0.2 rounded bg-surface-container text-[9px] font-mono font-medium text-outline shrink-0">
                                  Group
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-outline font-mono shrink-0 ml-1">
                              {timestamp}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <p
                              className={`text-xs truncate ${hasUnread ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}
                            >
                              {snippet}
                            </p>
                            {hasUnread && !isActive && (
                              <span className="px-1.5 py-0.2 rounded-full bg-primary text-[10px] text-on-primary font-bold shrink-0 ml-1">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contextual Action Menu (Three-dot options) */}
                      <div className="relative shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === conv.id ? null : conv.id);
                          }}
                          className="w-8 h-8 rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-container-low/50 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all cursor-pointer"
                          title="Options"
                          aria-label="Options"
                        >
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>

                        {activeDropdownId === conv.id && (
                          <div
                            ref={dropdownRef}
                            className="absolute right-0 top-9 w-48 glass-panel border border-border-hairline/50 rounded-xl shadow-xl py-1 z-30 animate-fade-in text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdownId(null);
                                setModalError(null);
                                setConfirmModal({ type: 'remove_chat', conv });
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-error/10 text-error transition-colors cursor-pointer font-medium"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete_outline</span>
                              <span>Remove chat</span>
                            </button>

                            {!isGroup && peer && (
                              contacts.some((c) => String(c.id) === String(peer.id)) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    setModalError(null);
                                    setConfirmModal({ type: 'remove_contact', user: peer, conv });
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-surface-container-low/50 text-on-surface transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[17px]">person_remove</span>
                                  <span>Remove contact</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    handleAddContact(peer);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-surface-container-low/50 text-on-surface transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[17px]">person_add</span>
                                  <span>Add contact</span>
                                </button>
                              )
                            )}

                            <div className="border-t border-border-hairline/60 my-1"></div>

                            <button
                              type="button"
                              onClick={() => setActiveDropdownId(null)}
                              className="w-full px-3 py-1.5 text-left text-outline hover:text-on-surface transition-colors cursor-pointer text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Directory Link Card */}
            <div className="p-3 m-3 glass-surface border border-border-hairline/50 rounded-xl flex items-center justify-between shadow-xs flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-on-surface">Member Directory</div>
                  <div className="text-[10px] text-outline font-mono">Connect with peers</div>
                </div>
              </div>
              <button
                onClick={() => navigate('/find-people')}
                className="w-7 h-7 rounded-xl hover:bg-surface-container-low/50 flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
                title="Open Directory"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </aside>

          {/* Right Stage: In-place Active Chat or Empty State */}
          <section
            className={`${
              conversationId ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col h-full bg-surface min-w-0 overflow-hidden relative`}
          >
            {conversationId ? (
              <ChatPanel
                conversationId={conversationId}
                onConversationActivity={handleConversationActivity}
                onBack={() => navigate('/dashboard')}
              />
            ) : (
              /* Approved Stitch Empty State Stage */
              <div className="flex-1 flex flex-col justify-between items-center relative overflow-hidden select-none p-6">
                {/* Ambient Decorative Motif */}
                <div className="absolute -top-32 right-12 w-96 h-96 rounded-full bg-gradient-to-br from-primary/10 via-surface-container-high to-transparent blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-gradient-to-tr from-secondary/10 via-india-green/10 to-transparent blur-3xl pointer-events-none"></div>

                {/* Top Stage Header */}
                <header className="w-full flex items-center justify-between z-10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-outline font-mono">
                      Direct Communication Fabric
                    </span>
                    <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                    <span className="text-xs text-on-surface-variant">Authenticated Session</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TricolourBadge size="sm" />
                  </div>
                </header>

                {/* Centered Minimal Hero Panel */}
                <div className="w-full max-w-lg px-6 flex flex-col items-center text-center my-auto z-10">
                  <div className="relative mb-6 flex items-center justify-center">
                    <div className="w-16 h-16 p-3.5 rounded-2xl glass-surface border border-border-hairline/50 shadow-md flex items-center justify-center relative">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="29" cy="11" fill="#F58220" r="3.5" />
                        <circle cx="11" cy="29" fill="#138808" r="2.5" />
                        <path d="M12 28L28 12" stroke="#0A1128" strokeDasharray="2 2" strokeLinecap="round" strokeWidth="2" />
                        <rect fill="#0A1128" height="14" rx="4" width="16" x="8" y="10" />
                        <path d="M14 24L11 27V24H14Z" fill="#0A1128" />
                        <rect fill="#2D4FCF" height="12" rx="3.5" width="14" x="18" y="18" />
                        <circle cx="13.5" cy="17" fill="#FFFFFF" r="1.25" />
                        <circle cx="18.5" cy="17" fill="#FFFFFF" r="1.25" />
                        <path d="M23 24H27" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="1.5" />
                      </svg>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-primary tracking-tight mb-2">
                    Your conversations start here.
                  </h2>

                  <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
                    Choose someone from your chats or find a person on the ConvoX network to send your first message.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => navigate('/find-people')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl btn-glass-primary shadow-xs cursor-pointer focus-visible-ring flex items-center justify-center gap-2 group font-semibold text-sm transition-all active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-[19px] group-hover:scale-110 transition-transform">
                        person_search
                      </span>
                      <span>Find People</span>
                    </button>
                  </div>

                  <div className="mt-8 flex items-center gap-2 text-outline text-xs">
                    <span>Welcome to ConvoX,</span>
                    <span className="font-semibold text-primary">{user?.fullName || user?.username}</span>
                  </div>
                </div>

                {/* Bottom Status Footer */}
                <footer className="w-full flex items-center justify-center z-10 flex-shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-border-hairline/50 text-xs font-medium text-on-surface-variant glass-surface">
                    <span className="w-2 h-2 rounded-full bg-india-green"></span>
                    <span>Connected to ConvoX Server • Active</span>
                  </div>
                </footer>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Self Profile Modal (Edit Mode) */}
      <ProfileModal
        isOpen={selfProfileOpen}
        onClose={() => setSelfProfileOpen(false)}
        mode="edit"
      />

      {/* Safe Deletion & Contact Removal Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-sm glass-panel border border-border-hairline/50 rounded-2xl shadow-2xl p-5 text-on-surface"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">
                  {confirmModal.type === 'remove_chat' ? 'delete_sweep' : 'person_remove'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-primary">
                  {confirmModal.type === 'remove_chat' ? 'Remove this chat?' : 'Remove from contacts?'}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  {confirmModal.type === 'remove_chat'
                    ? "This will remove the conversation from your chat list. The other participant's chat history will not be deleted."
                    : `Are you sure you want to remove ${confirmModal.user?.fullName || confirmModal.user?.username || 'this user'} from your contacts? Your conversation history will remain intact, and you can still find them in the Member Directory.`}
                </p>
              </div>
            </div>

            {modalError && (
              <div className="mb-3">
                <AlertBanner type="error" message={modalError} onClose={() => setModalError(null)} />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-hairline/60">
              <button
                type="button"
                onClick={() => {
                  if (!actionLoading) {
                    setConfirmModal(null);
                    setModalError(null);
                  }
                }}
                disabled={actionLoading}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl btn-glass-secondary hover:bg-surface-container-low/50 transition-colors cursor-pointer disabled:opacity-50 focus-visible-ring"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirmModal.type === 'remove_chat') {
                    handleConfirmRemoveChat(confirmModal.conv);
                  } else {
                    handleConfirmRemoveContact(confirmModal.user);
                  }
                }}
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl btn-glass-error shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible-ring"
              >
                {actionLoading && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>
                  {confirmModal.type === 'remove_chat' ? 'Remove chat' : 'Remove contact'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      <NewGroupModal
        isOpen={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onGroupCreated={(newGroup) => {
          fetchConversations(false);
          if (newGroup?.id) {
            navigate(`/dashboard/${newGroup.id}`);
          }
        }}
      />
    </div>
  );
}

export default DashboardPage;
