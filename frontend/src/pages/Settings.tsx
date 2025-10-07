import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  MoonIcon,
  SunIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  CreditCardIcon,
  KeyIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const { user } = useAuth();
  
  // Settings state
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      sms: false,
      push: true,
      marketing: false,
      security: true,
      transactions: true,
    },
    privacy: {
      profileVisibility: 'private',
      activityStatus: true,
      dataSharing: false,
    },
    preferences: {
      theme: 'light',
      language: 'en',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: 30,
      loginNotifications: true,
    }
  });

  const handleNotificationChange = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
    toast.success('Notification preferences updated');
  };

  const handlePrivacyChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value
      }
    }));
    toast.success('Privacy settings updated');
  };

  const handlePreferenceChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      }
    }));
    toast.success('Preferences updated');
  };

  const handleSecurityChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [key]: value
      }
    }));
    
    if (key === 'twoFactorAuth') {
      if (value) {
        toast.success('Two-factor authentication enabled');
      } else {
        toast.success('Two-factor authentication disabled');
      }
    } else {
      toast.success('Security settings updated');
    }
  };

  const ToggleSwitch: React.FC<{ 
    enabled: boolean; 
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
  }> = ({ enabled, onChange, disabled = false }) => (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      className={`${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      relative inline-flex h-6 w-11 flex-shrink-0 border-2 border-transparent rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
      disabled={disabled}
    >
      <span
        className={`${
          enabled ? 'translate-x-5' : 'translate-x-0'
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Notification Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BellIcon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            </div>

            <div className="space-y-4">
              {[
                { key: 'email', label: 'Email Notifications', description: 'Receive notifications via email' },
                { key: 'sms', label: 'SMS Notifications', description: 'Receive notifications via SMS' },
                { key: 'push', label: 'Push Notifications', description: 'Receive browser push notifications' },
                { key: 'transactions', label: 'Transaction Alerts', description: 'Get notified about all transactions' },
                { key: 'security', label: 'Security Alerts', description: 'Important security notifications' },
                { key: 'marketing', label: 'Marketing Communications', description: 'Product updates and offers' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900">{item.label}</h4>
                      {(item.key === 'security' || item.key === 'transactions') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.notifications[item.key as keyof typeof settings.notifications]}
                    onChange={(value) => handleNotificationChange(item.key, value)}
                    disabled={item.key === 'security' || item.key === 'transactions'}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Privacy Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Privacy</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Visibility
                </label>
                <select
                  value={settings.privacy.profileVisibility}
                  onChange={(e) => handlePrivacyChange('profileVisibility', e.target.value)}
                  className="form-input"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="contacts">Contacts Only</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Activity Status</h4>
                  <p className="text-xs text-gray-500 mt-1">Show when you're online</p>
                </div>
                <ToggleSwitch
                  enabled={settings.privacy.activityStatus}
                  onChange={(value) => handlePrivacyChange('activityStatus', value)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Data Sharing</h4>
                  <p className="text-xs text-gray-500 mt-1">Allow anonymous usage data collection</p>
                </div>
                <ToggleSwitch
                  enabled={settings.privacy.dataSharing}
                  onChange={(value) => handlePrivacyChange('dataSharing', value)}
                />
              </div>
            </div>
          </motion.div>

          {/* Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <GlobeAltIcon className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handlePreferenceChange('theme', 'light')}
                    className={`flex items-center p-3 border rounded-lg ${
                      settings.preferences.theme === 'light'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <SunIcon className="h-5 w-5 mr-2" />
                    Light
                  </button>
                  <button
                    onClick={() => handlePreferenceChange('theme', 'dark')}
                    className={`flex items-center p-3 border rounded-lg ${
                      settings.preferences.theme === 'dark'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <MoonIcon className="h-5 w-5 mr-2" />
                    Dark
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={settings.preferences.language}
                  onChange={(e) => handlePreferenceChange('language', e.target.value)}
                  className="form-input"
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                  <option value="fr">French</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={settings.preferences.currency}
                  onChange={(e) => handlePreferenceChange('currency', e.target.value)}
                  className="form-input"
                >
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={settings.preferences.timezone}
                  onChange={(e) => handlePreferenceChange('timezone', e.target.value)}
                  className="form-input"
                >
                  <option value="Africa/Nairobi">Africa/Nairobi</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Security Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-red-100 rounded-lg">
                <KeyIcon className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
                  <p className="text-xs text-gray-500 mt-1">Add an extra layer of security to your account</p>
                </div>
                <ToggleSwitch
                  enabled={settings.security.twoFactorAuth}
                  onChange={(value) => handleSecurityChange('twoFactorAuth', value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Timeout (minutes)
                </label>
                <select
                  value={settings.security.sessionTimeout}
                  onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                  className="form-input"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Login Notifications</h4>
                  <p className="text-xs text-gray-500 mt-1">Get notified when someone logs into your account</p>
                </div>
                <ToggleSwitch
                  enabled={settings.security.loginNotifications}
                  onChange={(value) => handleSecurityChange('loginNotifications', value)}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Export Data</div>
                    <div className="text-xs text-gray-500">Download your account data</div>
                  </div>
                </div>
              </button>
              
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <UserGroupIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Invite Friends</div>
                    <div className="text-xs text-gray-500">Share PaymentGateway with others</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Account Status */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-900">Email Verified</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-900">Phone Pending</span>
                </div>
                <button className="text-xs text-blue-600 hover:text-blue-800">Verify</button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-900">Identity Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-2">Need Help?</h4>
                <p className="text-xs text-blue-700 mb-3">
                  Our support team is here to help you with any questions or issues.
                </p>
                <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;