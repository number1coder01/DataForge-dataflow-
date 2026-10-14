import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchApi } from '../lib/api';
import {
  Layers,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Zap,
  Database,
  BarChart3,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      login(data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex auth-bg" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Background patterns */}
      <div className="auth-grid" />

      {/* Left panel — Branding + Feature highlights */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 xl:p-16">
        <div className="animate-fade-in">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text tracking-tight">DataFlow</span>
          </Link>
        </div>

        <div className="space-y-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Your data,<br />
              <span className="gradient-text">analyzed in seconds.</span>
            </h1>
            <p className="mt-4 text-lg leading-relaxed max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
              Upload any CSV and watch it transform through a fully automated ETL pipeline — from raw ingestion to interactive dashboards.
            </p>
          </div>

          <div className="space-y-4 stagger-children">
            <FeatureItem
              icon={<Zap className="w-5 h-5 text-amber-400" />}
              title="Automated ETL Pipeline"
              description="Schema detection, profiling, quality checks, and Parquet transformation"
            />
            <FeatureItem
              icon={<Database className="w-5 h-5 text-cyan-400" />}
              title="Serverless SQL Explorer"
              description="Query your processed data with Athena-powered SQL — no infrastructure to manage"
            />
            <FeatureItem
              icon={<BarChart3 className="w-5 h-5 text-emerald-400" />}
              title="Auto-Generated Dashboards"
              description="AI-recommended visualizations based on your data's schema and patterns"
            />
          </div>
        </div>

        <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            © {new Date().getFullYear()} DataFlow Platform · Powered by AWS Serverless
          </p>
        </div>
      </div>

      {/* Right panel — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md animate-fade-in-scale">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text tracking-tight">DataFlow</span>
          </div>

          <div className="glass-card rounded-3xl p-8 sm:p-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Welcome back
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                Sign in to continue to your analytics workspace
              </p>
            </div>

            {error && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl mb-6 text-sm animate-fade-in"
                style={{
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                }}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg-input)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-border-focus)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg-input)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-border-focus)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent-gradient-from), var(--color-accent-gradient-to))',
                  boxShadow: '0 4px 15px var(--color-accent-glow)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold transition-colors hover:underline"
                  style={{ color: 'var(--color-accent-primary)' }}
                >
                  Create one for free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Feature Card sub-component ─── */
const FeatureItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-4 group">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 duration-200"
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
      }}
    >
      {icon}
    </div>
    <div>
      <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h4>
      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
    </div>
  </div>
);
