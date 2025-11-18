import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import axios from 'axios';

interface SignupFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'explorer' | 'expert' | 'mentor' | 'patron';
}

interface FormErrors {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  form?: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'explorer',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
      
      await axios.post(`${apiUrl}/auth/signup/`, {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
      });

      // Redirect to login page with success message
      navigate('/login', { 
        state: { message: 'Account created successfully! Please log in.' } 
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const apiErrors = error.response.data as Record<string, unknown>;
        setErrors({
          email: Array.isArray(apiErrors.email) ? String(apiErrors.email[0]) : undefined,
          username: Array.isArray(apiErrors.username) ? String(apiErrors.username[0]) : undefined,
          password: Array.isArray(apiErrors.password) ? String(apiErrors.password[0]) : undefined,
          form: (apiErrors.detail as string) || 
                (Array.isArray(apiErrors.non_field_errors) ? String(apiErrors.non_field_errors[0]) : undefined) || 
                'Signup failed. Please try again.',
        });
      } else {
        setErrors({ form: 'Network error. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error for this field
    if (errors[e.target.name as keyof FormErrors]) {
      setErrors({
        ...errors,
        [e.target.name]: undefined,
      });
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.location.href = `${backendUrl}/accounts/${provider}/login/?process=login`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 transition-colors">
      <ThemeToggle />
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create Account</h1>
          <p className="text-gray-600 dark:text-gray-400">Join AllThrive AI today</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6 transition-colors">
          {/* OAuth Options */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('google')}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </button>

            <button
              onClick={() => handleOAuthLogin('github')}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm shadow-sm"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              Sign up with GitHub
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or sign up with email</span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                {errors.form}
              </div>
            )}

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 border ${errors.firstName ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all`}
                  placeholder="John"
                />
                {errors.firstName && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.firstName}</p>}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 border ${errors.lastName ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all`}
                  placeholder="Doe"
                />
                {errors.lastName && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3 py-2.5 border ${errors.email ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all`}
                placeholder="you@example.com"
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`w-full px-3 py-2.5 border ${errors.username ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all`}
                placeholder="johndoe"
              />
              {errors.username && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.username}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-3 py-2.5 border ${errors.password ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all`}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full px-3 py-2.5 border ${errors.confirmPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all`}
                placeholder="••••••••"
              />
              {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.confirmPassword}</p>}
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Account Type
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
              >
                <option value="explorer">Explorer - Basic access (Free)</option>
                <option value="expert">Expert - Enhanced features</option>
                <option value="mentor">Mentor - Advanced capabilities</option>
                <option value="patron">Patron - Premium features</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">You can upgrade your account later</p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 px-4 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">
              Sign in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
