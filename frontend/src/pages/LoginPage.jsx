import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import api from '../api/axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call backend login endpoint (handles both TEST_MODE and production)
      const { data: loginData } = await api.post('/api/auth/login', { email, password });

      setAuth({
        user: {
          id: loginData.user.id,
          email: email,
          fullName: loginData.user.fullName,
          role: loginData.user.role,
          assignedVillageIds: loginData.user.assignedVillageIds || [],
        },
        token: loginData.token,
      });

      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Login failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left pane — decorative */}
      <div className="hidden lg:flex lg:w-1/2 gradient-header items-center justify-center relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-32 right-16 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-white/25 blur-2xl" />
        </div>

        <div className="relative text-center text-white px-12 max-w-lg">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 shadow-lg">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">GraamSwasthya</h1>
          <p className="text-lg text-white/80 leading-relaxed">
            Household-centric rural healthcare platform for maternal &amp; child health
          </p>
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-white/60">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">22+</p>
              <p>Tables</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">8</p>
              <p>Alert Types</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">4</p>
              <p>Roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right pane — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl gradient-header flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-neutral-800">GraamSwasthya</h1>
          </div>

          <h2 className="text-2xl font-bold text-neutral-800 mb-1">Welcome back</h2>
          <p className="text-sm text-neutral-500 mb-8">Sign in to continue to your dashboard</p>

          {error && (
            <div className="mb-6 px-4 py-3 bg-danger-light border border-danger/20 text-danger text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold
                hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-neutral-400">
            Contact your administrator for account access
          </p>
        </div>
      </div>
    </div>
  );
}
