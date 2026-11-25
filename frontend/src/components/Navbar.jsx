import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { TricolourBadge } from './TricolourBadge';

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme } = usePreferences();
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 w-full z-50 glass-panel border-b border-border-hairline/50 shadow-sm transition-colors"
    >
      <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div
            className="h-9 px-2 py-0.5 rounded-xl bg-white border border-border-hairline/50 flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
          >
            <img
              src="/ConvoX-logo.png"
              alt="ConvoX"
              className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>
        </Link>

        {/* Public Nav items */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 transition-colors font-medium"
          >
            Overview
          </Link>
          <a
            href="#features"
            className="px-3 py-1.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 transition-colors font-medium"
          >
            Features
          </a>
          <a
            href="#preview"
            className="px-3 py-1.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 transition-colors font-medium"
          >
            Product Preview
          </a>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-2">
          {/* Quick Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-low/50 hover:text-on-surface transition-colors cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[19px] transition-transform duration-300 ${
                isDarkMode ? 'text-amber-400 rotate-45' : 'text-slate-600 -rotate-45'
              }`}
            >
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-on-surface hidden sm:inline">
                {user?.fullName || user?.username}
              </span>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer focus-visible-ring"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 rounded-xl transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs cursor-pointer focus-visible-ring"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
