import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Activity,
  Database,
  Layers,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
      isActive
        ? 'text-white shadow-sm'
        : 'hover:opacity-90'
    }`;

  const navLinkStyle = (isActive: boolean): React.CSSProperties =>
    isActive
      ? {
          backgroundColor: 'var(--color-accent-glow)',
          color: 'var(--color-accent-primary)',
          border: '1px solid var(--color-accent-glow)',
        }
      : {
          color: 'var(--color-text-secondary)',
          border: '1px solid transparent',
        };

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        backdropFilter: `blur(var(--backdrop-blur))`,
        WebkitBackdropFilter: `blur(var(--backdrop-blur))`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6 lg:gap-8">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="tracking-tight font-bold text-lg gradient-text hidden sm:inline">
              DataFlow
            </span>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink
              to="/datasets"
              className={({ isActive }) => navLinkClass(isActive)}
              style={({ isActive }) => navLinkStyle(isActive)}
            >
              <Database className="w-3.5 h-3.5" />
              Datasets
            </NavLink>

            <NavLink
              to="/runs"
              className={({ isActive }) => navLinkClass(isActive)}
              style={({ isActive }) => navLinkStyle(isActive)}
            >
              <Activity className="w-3.5 h-3.5" />
              Pipeline Runs
            </NavLink>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            id="theme-toggle"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl text-sm transition-all duration-200 border"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Sign Out */}
          <button
            id="sign-out"
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden p-2.5 rounded-xl border transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          className="sm:hidden border-t animate-fade-in"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <div className="px-4 py-3 space-y-1">
            <NavLink
              to="/datasets"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? '' : ''
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'var(--color-accent-glow)' : 'transparent',
              })}
            >
              <Database className="w-4 h-4" />
              Datasets
            </NavLink>

            <NavLink
              to="/runs"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? '' : ''
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'var(--color-accent-glow)' : 'transparent',
              })}
            >
              <Activity className="w-4 h-4" />
              Pipeline Runs
            </NavLink>

            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-colors"
              style={{ color: 'var(--color-error)' }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
