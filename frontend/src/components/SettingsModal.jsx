import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { api } from '../api/client';
import { playNotificationChime } from '../utils/sound';

export function SettingsModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuth();
  const { preferences, updatePreferences } = usePreferences();

  const [activeTab, setActiveTab] = useState('appearance'); // appearance, notifications, privacy, profile
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setProfileError(null);
      setProfileMessage(null);

      const res = await api.updateProfile({ fullName: fullName.trim(), bio: bio.trim() });
      if (res?.user) {
        updateUser(res.user);
        setProfileMessage('Profile updated successfully!');
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Desktop notifications are not supported by your browser.');
      return;
    }

    if (Notification.permission === 'granted') {
      updatePreferences({ desktop_notifications_enabled: !preferences.desktop_notifications_enabled });
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updatePreferences({ desktop_notifications_enabled: true });
      } else {
        updatePreferences({ desktop_notifications_enabled: false });
      }
    }
  };

  const toggleAppearanceSection = (id) => {
    const updates = { theme: id };
    updatePreferences(updates);
  };

  const themeOptions = [
    { id: 'light', label: 'Light', icon: 'light_mode', desc: 'Clean & crisp' },
    { id: 'dark', label: 'Dark', icon: 'dark_mode', desc: 'Deep slate tones' },
    { id: 'system', label: 'System', icon: 'settings_brightness', desc: 'Sync with OS' },
  ];

  const toggleGroup = ({ label, desc, checked, onChange, testAction }) => (
    <div className="glass-card p-3.5 rounded-xl border border-border-hairline/50 shadow-xs flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="text-xs font-bold text-primary">{label}</div>
        <div className="text-xs text-on-surface-variant">{desc}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {testAction && (
          <button
            type="button"
            onClick={testAction}
            className="px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg border border-border-hairline/50 transition-colors shadow-xs cursor-pointer"
            title="Test"
          >
            Test
          </button>
        )}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-india-green peer-checked:border-transparent peer-focus:outline-none">
            <span className="absolute top-0.5 left-0.5 h-3 w-3 bg-surface-container-lowest rounded-full shadow-sm ring ring-surface-container-highest transition-all peer-checked:translate-x-full peer-checked:ring-india-green/40" />
          </div>
        </label>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl glass-panel border border-border-hairline/50 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-hairline/50 flex items-center justify-between glass-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl glass-surface border border-border-hairline/50 flex items-center justify-center text-primary shadow-xs">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-primary">Settings & Preferences</h2>
              <p className="text-xs text-on-surface-variant">Customize your ConvoX experience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass-surface border border-border-hairline/50 hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors shadow-xs cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-hairline/50 bg-surface-container-lowest px-6 pt-2 gap-1 overflow-x-auto">
          {[
            { id: 'appearance', label: 'Appearance', icon: 'palette' },
            { id: 'notifications', label: 'Notifications', icon: 'notifications' },
            { id: 'privacy', label: 'Privacy', icon: 'security' },
            { id: 'profile', label: 'Profile', icon: 'person' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-india-green text-primary font-bold'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-primary block mb-1">Theme</label>
                <p className="text-xs text-on-surface-variant mb-3">
                  Choose how ConvoX looks on your device.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {themeOptions.map((themeOpt) => {
                    const isSelected = preferences.theme === themeOpt.id;
                    return (
                      <button
                        key={themeOpt.id}
                        type="button"
                        onClick={() => toggleAppearanceSection(themeOpt.id)}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                          isSelected
                            ? 'border-india-green bg-india-green/10 shadow-xs ring-1 ring-india-green/20'
                            : 'border-border-hairline/50 bg-surface-container-lowest hover:bg-surface-container-low'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-india-green' : 'text-outline'}`}>
                            {themeOpt.icon}
                          </span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-india-green"></span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-primary">{themeOpt.label}</div>
                          <div className="text-[10px] text-outline">{themeOpt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              {toggleGroup({
                label: 'Message Sounds',
                desc: 'Play a gentle chime when a new message arrives.',
                checked: preferences.sound_enabled,
                onChange: (e) => updatePreferences({ sound_enabled: e.target.checked }),
                testAction: () => playNotificationChime(),
              })}
              {toggleGroup({
                label: 'Desktop Notifications',
                desc: 'Receive browser notifications when ConvoX is in the background.',
                checked: preferences.desktop_notifications_enabled,
                onChange: handleRequestNotificationPermission,
              })}
            </div>
          )}

          {/* TAB 3: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-5">
              {toggleGroup({
                label: 'Read Receipts',
                desc: 'Show blue checkmarks when messages have been seen. When disabled, you will neither send nor receive read confirmations.',
                checked: preferences.read_receipts_enabled,
                onChange: (e) => updatePreferences({ read_receipts_enabled: e.target.checked }),
              })}
            </div>
          )}

          {/* TAB 4: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMessage && (
                <AlertBanner type="success" message={profileMessage} onClose={() => setProfileMessage(null)} />
              )}
              {profileError && (
                <AlertBanner type="error" message={profileError} onClose={() => setProfileError(null)} />
              )}

              <div>
                <label className="text-xs font-bold text-primary block mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-glass w-full px-3 py-2 text-xs text-on-surface rounded-xl border border-border-hairline/50 focus:border-secondary focus:outline-none transition-all shadow-xs placeholder:text-outline/70"
                  placeholder="Your Full Name"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-primary block mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="input-glass w-full px-3 py-2 text-xs text-on-surface rounded-xl border border-border-hairline/50 focus:border-secondary focus:outline-none transition-all resize-none shadow-xs placeholder:text-outline/70"
                  placeholder="Write a few words about yourself..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-outline">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-outline/60">Username</span>
                  <span className="text-on-surface-variant font-semibold">@{user?.username}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-outline/60">Email</span>
                  <span className="text-on-surface-variant font-semibold">{user?.email}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-hairline/50 glass-surface flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low rounded-lg border border-border-hairline/50 transition-colors shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
