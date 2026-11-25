import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { TricolourBadge } from './TricolourBadge';
import { ProfileModal } from './ProfileModal';
import { SettingsModal } from './SettingsModal';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Messages', icon: 'forum' },
  { to: '/find-people', label: 'Find People', icon: 'group_add' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = usePreferences();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitials = (user?.fullName || user?.username || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full z-50 flex flex-col items-center justify-between py-6 transition-all duration-300 ${
          collapsed ? 'w-[64px]' : 'w-[72px]'
        }`}
      >
        {/* Top brand */}
        <div className="flex flex-col items-center w-full gap-8">
          <NavLink
            to="/dashboard"
            className="flex flex-col items-center gap-1.5 group"
            title="ConvoX Dashboard"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-white/90 border border-border-hairline flex items-center justify-center p-1.5 shadow-sm transition-all group-hover:scale-105 overflow-hidden ${
                collapsed ? 'mx-auto' : ''
              }`}
            >
              <img
                src="/ConvoX-logo.png"
                alt="ConvoX"
                className="w-full h-full object-contain"
              />
            </div>
            {!collapsed && (
              <span className="text-xs font-bold text-on-surface tracking-tight leading-none">
                ConvoX
              </span>
            )}
          </NavLink>

          {/* Navigation icons */}
          <nav className="flex flex-col items-center gap-3 w-full px-1.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'glass-surface text-on-surface shadow-xs'
                      : 'text-on-surface-variant hover:bg-surface-container-low/50 hover:text-on-surface hover:border-border-hairline/50'
                  } border border-transparent`
                }
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? '' : 'opacity-80'}`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span
                    className={`absolute left-[74px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap bg-surface-container-lowest border border-border-hairline/60 text-on-surface shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none ${
                      isActive ? 'text-primary' : ''
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom actions & user profile */}
        <div className="flex flex-col items-center gap-2 w-full px-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-low/50 hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>

          {/* Quick Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-low/50 hover:text-on-surface transition-all cursor-pointer active:scale-95"
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${
                isDarkMode ? 'text-amber-400 group-hover:rotate-45' : 'text-slate-600 group-hover:-rotate-45'
              }`}
            >
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings & Preferences"
            className="w-12 h-12 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-low/50 hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>

          <button
            onClick={handleLogout}
            type="button"
            title="Sign Out"
            className="w-12 h-12 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-red-500/10 hover:text-error transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="relative w-12 h-12 flex items-center justify-center rounded-full cursor-pointer border-0 bg-transparent focus:outline-none"
            title={`Edit Profile: ${user?.fullName} (@${user?.username})`}
          >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold shadow-md group-hover:ring-2 group-hover:ring-primary/40 transition-all">
              {userInitials}
            </div>
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-india-green rounded-full ring-2 ring-surface-container-lowest"
              title="Online"
            ></span>
          </button>
        </div>
      </aside>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        mode="edit"
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
