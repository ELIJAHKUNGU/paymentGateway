import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+254');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const loginEmail = loginMode === 'email' ? email : countryCode + phone.replace(/^0/, '');
    
    if (!loginEmail || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (loginMode === 'phone' && countryCode === '+254' && phone.length !== 9) {
      toast.error('Kenyan phone number should be 9 digits (without leading 0)');
      return;
    }

    try {
      await login(loginEmail, password);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in the context
    }
  };

  // Demo credentials for testing
  const demoCredentials = [
    { role: 'Customer', email: 'customer@paygateway.com', phone: '+254743770216', password: 'Customer123!' },
    { role: 'Business', email: 'business@paygateway.com', phone: '+254700000002', password: 'Business123!' },
    { role: 'Admin', email: 'admin@paygateway.com', phone: '+254700000003', password: 'Admin123!' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white rounded-full shadow-lg">
              <CurrencyDollarIcon className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-blue-200">Sign in to your PaymentGateway account</p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="glass-morphism rounded-2xl p-8 shadow-2xl"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Login Mode Toggle */}
            <div className="flex bg-white/10 rounded-lg p-1 mb-4">
              <button
                type="button"
                onClick={() => setLoginMode('email')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                  loginMode === 'email' 
                    ? 'bg-white/20 text-white shadow-sm' 
                    : 'text-blue-200 hover:text-white'
                }`}
              >
                <EnvelopeIcon className="h-4 w-4 inline mr-2" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('phone')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                  loginMode === 'phone' 
                    ? 'bg-white/20 text-white shadow-sm' 
                    : 'text-blue-200 hover:text-white'
                }`}
              >
                <DevicePhoneMobileIcon className="h-4 w-4 inline mr-2" />
                Phone
              </button>
            </div>

            {/* Email/Phone Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                {loginMode === 'email' ? 'Email Address' : 'Phone Number'}
              </label>
              
              {loginMode === 'email' ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-blue-300" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-white/20 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                  />
                </div>
              ) : (
                <div className="flex space-x-2">
                  {/* Country Code Selector */}
                  <div className="relative">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="block w-24 px-3 py-3 border border-white/20 rounded-lg bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                    >
                      <option value="+254" className="bg-gray-800 text-white">🇰🇪 +254</option>
                      <option value="+256" className="bg-gray-800 text-white">🇺🇬 +256</option>
                      <option value="+255" className="bg-gray-800 text-white">🇹🇿 +255</option>
                      <option value="+250" className="bg-gray-800 text-white">🇷🇼 +250</option>
                      <option value="+1" className="bg-gray-800 text-white">🇺🇸 +1</option>
                      <option value="+44" className="bg-gray-800 text-white">🇬🇧 +44</option>
                    </select>
                  </div>
                  
                  {/* Phone Number Input */}
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DevicePhoneMobileIcon className="h-5 w-5 text-blue-300" />
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-white/20 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                      placeholder={countryCode === '+254' ? '743770216' : 'Phone number'}
                    />
                  </div>
                </div>
              )}
              
              {loginMode === 'phone' && (
                <p className="text-xs text-blue-200 mt-1">
                  {countryCode === '+254' ? 
                    'Enter without leading 0 (e.g., 743770216)' : 
                    'Enter your local phone number'
                  }
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-blue-300" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-white/20 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-blue-300 hover:text-white transition-colors" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-blue-300 hover:text-white transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-blue-200">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <button 
                  type="button"
                  className="font-medium text-blue-300 hover:text-white transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </motion.button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-blue-200">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-blue-300 hover:text-white transition-colors">
                Sign up here
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Demo Credentials */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
        >
          <p className="text-xs text-blue-200 text-center mb-3">Demo Login Credentials:</p>
          <div className="text-xs text-blue-300 space-y-2">
            {demoCredentials.map((cred, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-white/5 rounded border border-white/10">
                <div>
                  <p className="text-white font-medium">{cred.role}</p>
                  <p className="text-blue-200 text-xs">{cred.phone}</p>
                  <p className="text-blue-300 text-xs">{cred.email}</p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      setLoginMode('email');
                      setEmail(cred.email);
                      setPassword(cred.password);
                    }}
                    className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded text-xs transition-colors"
                  >
                    Email
                  </button>
                  <button
                    onClick={() => {
                      setLoginMode('phone');
                      setCountryCode('+254');
                      setPhone(cred.phone.replace('+254', ''));
                      setPassword(cred.password);
                    }}
                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded text-xs transition-colors"
                  >
                    Phone
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-200 text-center mt-3 italic">Click "Use" to auto-fill credentials</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;