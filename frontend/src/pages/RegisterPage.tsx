import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import {
  Layers,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Sparkles,
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /* ─── Password Strength Checker ─── */
  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
  }, [password]);

  const passwordStrength = useMemo(() => {
    const passed = Object.values(passwordChecks).filter(Boolean).length;
    if (passed <= 1) return { label: 'Weak', color: 'var(--color-error)', pct: 20 };
    if (passed <= 2) return { label: 'Weak', color: 'var(--color-error)', pct: 40 };
    if (passed <= 3) return { label: 'Fair', color: 'var(--color-warning)', pct: 60 };
    if (passed <= 4) return { label: 'Good', color: 'var(--color-success)', pct: 80 };
    return { label: 'Strong', color: 'var(--color-success)', pct: 100 };
  }, [passwordChecks]);

  const allChecksPassed = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex auth-bg" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Background patterns */}
      <div className="auth-grid" />

      {/* Left panel — Branding */}
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
              Start building<br />
              <span className="gradient-text">your data story.</span>
            </h1>
            <p className="mt-4 text-lg leading-relaxed max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
              Create your free account and start processing datasets in under 60 seconds. No credit card required.
            </p>
          </div>

          <div className="space-y-4 stagger-children">
            <FeatureItem
              icon={<Sparkles className="w-5 h-5 text-amber-400" />}
              title="Free Forever"
              description="No usage limits for portfolio projects — powered by serverless architecture"
            />
            <FeatureItem
              icon={<Shield className="w-5 h-5 text-emerald-400" />}
              title="Secure by Design"
              description="JWT authentication, data isolation, and encrypted storage for every user"
            />
          </div>
        </div>

        <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            © {new Date().getFullYear()} DataFlow Platform · Powered by AWS Serverless
          </p>
        </div>
      </div>

      {/* Right panel — Registration Form */}
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
                Create your account
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                Get started with DataFlow in just a few steps
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
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    id="register-name"
                    type="text"
                    required
                    placeholder="John Doe"
                    className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg-input)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-border-focus)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    id="register-email"
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

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Create a strong password"
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

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    {/* Strength Bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${passwordStrength.pct}%`,
                            backgroundColor: passwordStrength.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>

                    {/* Requirement Checklist */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <PasswordCheck label="8+ characters" passed={passwordChecks.length} />
                      <PasswordCheck label="Uppercase letter" passed={passwordChecks.uppercase} />
                      <PasswordCheck label="Lowercase letter" passed={passwordChecks.lowercase} />
                      <PasswordCheck label="Number" passed={passwordChecks.digit} />
                      <PasswordCheck label="Special character" passed={passwordChecks.special} />
                    </div>
                  </div>
                )}
              </div>

              <button
                id="register-submit"
                type="submit"
                disabled={loading || !allChecksPassed}
                className="w-full py-3.5 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent-gradient-from), var(--color-accent-gradient-to))',
                  boxShadow: '0 4px 15px var(--color-accent-glow)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold transition-colors hover:underline"
                  style={{ color: 'var(--color-accent-primary)' }}
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Password Check Item ─── */
const PasswordCheck: React.FC<{ label: string; passed: boolean }> = ({ label, passed }) => (
  <div className="flex items-center gap-1.5">
    <CheckCircle2
      className="w-3 h-3 transition-colors"
      style={{ color: passed ? 'var(--color-success)' : 'var(--color-text-muted)' }}
    />
    <span
      className="text-[11px] font-medium transition-colors"
      style={{ color: passed ? 'var(--color-success)' : 'var(--color-text-muted)' }}
    >
      {label}
    </span>
  </div>
);

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
