import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  StarIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { usePayment } from '../context/PaymentContext';
import { mpesaKeysApi } from '../services/api';
import toast from 'react-hot-toast';

const PaymentMethods: React.FC = () => {
  const { paymentMethods, addPaymentMethod, removePaymentMethod, setDefaultPaymentMethod } = usePayment();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newMethod, setNewMethod] = useState({
    type: 'mpesa' as 'mpesa' | 'card' | 'bank' | 'paypal',
    name: '',
    details: '',
    metadata: {} as Record<string, any>,
  });
  const [useCustomCredentials, setUseCustomCredentials] = useState(false);

  const methodTypes = [
    {
      type: 'mpesa',
      name: 'M-Pesa',
      description: 'Safaricom M-Pesa integration',
      icon: DevicePhoneMobileIcon,
      color: 'from-green-500 to-emerald-600',
      enabled: true,
      fields: [
        { key: 'phoneNumber', label: 'Phone Number *', type: 'tel', placeholder: '743770216', required: true },
        { key: 'callbackUrl', label: 'Callback URL *', type: 'url', placeholder: 'https://yourdomain.com/callback', required: true },
      ],
      customFields: [
        { key: 'consumerKey', label: 'Consumer Key *', type: 'text', placeholder: 'Your M-Pesa Consumer Key', required: true },
        { key: 'consumerSecret', label: 'Consumer Secret *', type: 'password', placeholder: 'Your M-Pesa Consumer Secret', required: true },
        { key: 'businessShortCode', label: 'Business Short Code *', type: 'text', placeholder: '174379', required: true },
        { key: 'passKey', label: 'Pass Key *', type: 'password', placeholder: 'Your M-Pesa Pass Key', required: true },
      ]
    },
    {
      type: 'card',
      name: 'Credit/Debit Card',
      description: 'Visa, MasterCard, etc.',
      icon: CreditCardIcon,
      color: 'from-blue-500 to-indigo-600',
      enabled: false,
      comingSoon: true,
      fields: []
    },
    {
      type: 'bank',
      name: 'Bank Transfer',
      description: 'Direct bank account',
      icon: BuildingOfficeIcon,
      color: 'from-purple-500 to-pink-600',
      enabled: false,
      comingSoon: true,
      fields: []
    },
    {
      type: 'paypal',
      name: 'PayPal',
      description: 'Online payments',
      icon: GlobeAltIcon,
      color: 'from-yellow-500 to-orange-600',
      enabled: false,
      comingSoon: true,
      fields: []
    }
  ];

  const getMethodIcon = (type: string) => {
    const methodType = methodTypes.find(m => m.type === type);
    return methodType?.icon || GlobeAltIcon;
  };

  const getMethodColor = (type: string) => {
    const methodType = methodTypes.find(m => m.type === type);
    return methodType?.color || 'from-gray-500 to-gray-600';
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const fullPhoneNumber = (newMethod.metadata.countryCode || '+254') + 
                             (newMethod.metadata.phoneNumber || '').replace(/^0/, '');
      
      await addPaymentMethod({
        type: newMethod.type,
        name: newMethod.name || `M-Pesa ${fullPhoneNumber}`,
        details: `M-Pesa Account - ${fullPhoneNumber}`,
        metadata: {
          ...newMethod.metadata,
          fullPhoneNumber,
          useCustomCredentials
        },
      });
      
      toast.success('M-Pesa payment method added successfully!');
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add payment method');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMethod = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this payment method?')) {
      try {
        await removePaymentMethod(id);
        toast.success('Payment method removed successfully!');
      } catch (error: any) {
        let errorMessage = 'Failed to remove payment method';
        
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
          errorMessage = error.response.data.errors[0].message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage);
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultPaymentMethod(id);
      toast.success('Default payment method updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update default payment method');
    }
  };

  const resetForm = () => {
    setNewMethod({
      type: 'mpesa',
      name: '',
      details: '',
      metadata: {
        countryCode: '+254',
        phoneNumber: '',
        callbackUrl: ''
      },
    });
  };

  const selectedMethodType = methodTypes.find(m => m.type === newMethod.type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-600">Manage your payment methods and preferences</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setUseCustomCredentials(false);
            setIsAddModalOpen(true);
          }}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Payment Method
        </button>
      </div>

      {/* Payment Methods Grid - Beautiful Cards */}
      {paymentMethods.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paymentMethods.map((method) => {
            const MethodIcon = getMethodIcon(method.type);
            const colorClass = getMethodColor(method.type);
            
            return (
              <motion.div
                key={method.id || method._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card card-hover relative"
              >
                {/* Default Badge */}
                {method.isDefault && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <StarIcon className="h-3 w-3 mr-1" />
                      Default
                    </span>
                  </div>
                )}

                {/* Method Icon */}
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${colorClass} mb-4`}>
                  <MethodIcon className="h-6 w-6 text-white" />
                </div>

                {/* Method Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{method.name}</h3>
                    <p className="text-sm text-gray-600">{method.details}</p>
                    {method.metadata?.fullPhoneNumber && (
                      <p className="text-xs text-gray-500">📱 {method.metadata.fullPhoneNumber}</p>
                    )}
                  </div>

                  {/* M-Pesa Encryption Badge */}
                  {method.type === 'mpesa' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="flex items-center space-x-2">
                        <ShieldCheckIcon className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-900 font-medium">
                          Encrypted & Secure
                        </span>
                      </div>
                      <div className="text-xs text-green-700 mt-1">
                        {method.metadata?.credentialType === 'custom' ? 'Custom Keys' : 'Default Keys'} • Production
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex items-center space-x-2">
                    {method.verified ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className={`text-xs font-medium ${
                      method.verified ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {method.verified ? 'Active' : 'Pending Verification'}
                    </span>
                  </div>

                  {method.lastUsed && (
                    <p className="text-xs text-gray-500">
                      Last used: {new Date(method.lastUsed).toLocaleDateString()}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    {!method.isDefault ? (
                      <button
                        onClick={() => handleSetDefault(method._id || method.id)}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <div></div>
                    )}
                    
                    <button
                      onClick={() => handleRemoveMethod(method._id || method.id)}
                      className="text-sm text-red-600 hover:text-red-800 flex items-center"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-gray-400 mb-4">
            <CreditCardIcon className="mx-auto h-16 w-16" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h3>
          <p className="text-gray-500 mb-6">
            Add your first payment method to start processing transactions.
          </p>
          <button
            onClick={() => {
              resetForm();
              setUseCustomCredentials(false);
              setIsAddModalOpen(true);
            }}
            className="btn-primary"
          >
            Add Payment Method
          </button>
        </div>
      )}

      {/* Add Payment Method Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Add Payment Method</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleAddMethod} className="space-y-6">
                {/* Method Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Payment Method Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {methodTypes.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <button
                          key={type.type}
                          type="button"
                          onClick={() => type.enabled && setNewMethod(prev => ({ ...prev, type: type.type as any }))}
                          disabled={!type.enabled}
                          className={`p-4 border-2 rounded-lg text-left transition-all relative ${
                            newMethod.type === type.type && type.enabled
                              ? 'border-green-500 bg-green-50'
                              : type.enabled
                              ? 'border-gray-200 hover:border-gray-300'
                              : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <IconComponent className={`h-6 w-6 mb-2 ${
                            newMethod.type === type.type && type.enabled ? 'text-green-600' : 
                            type.enabled ? 'text-gray-400' : 'text-gray-300'
                          }`} />
                          <div className={`text-sm font-medium ${type.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                            {type.name}
                          </div>
                          <div className={`text-xs ${type.enabled ? 'text-gray-500' : 'text-gray-400'}`}>
                            {type.description}
                          </div>
                          
                          {type.comingSoon && (
                            <div className="absolute top-2 right-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Coming Soon
                              </span>
                            </div>
                          )}
                          
                          {type.enabled && (
                            <div className="absolute top-2 right-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Available
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* M-Pesa Configuration */}
                {selectedMethodType?.enabled && newMethod.type === 'mpesa' && (
                  <div className="space-y-6">
                    
                    {/* Credentials Option */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">M-Pesa Credentials</h4>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id="defaultCredentials"
                            name="credentialsType"
                            checked={!useCustomCredentials}
                            onChange={() => setUseCustomCredentials(false)}
                            className="h-4 w-4 text-green-600 focus:ring-green-500"
                          />
                          <label htmlFor="defaultCredentials" className="flex-1">
                            <div className="text-sm font-medium text-gray-900 flex items-center">
                              Use Default Configuration 
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Recommended
                              </span>
                            </div>
                            <div className="text-xs text-gray-600">
                              Use our pre-configured M-Pesa settings - perfect for testing and quick setup
                            </div>
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id="customCredentials"
                            name="credentialsType"
                            checked={useCustomCredentials}
                            onChange={() => setUseCustomCredentials(true)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="customCredentials" className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Use My Own Credentials</div>
                            <div className="text-xs text-gray-600">
                              Provide your own M-Pesa app credentials from Safaricom Developer Portal
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Default Configuration Preview */}
                    {!useCustomCredentials && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          <h4 className="text-sm font-medium text-green-900">Default M-Pesa Configuration</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-white rounded p-3 border border-green-200">
                            <span className="font-medium text-green-700">Consumer Key:</span>
                            <div className="text-green-600 font-mono">eCuv****</div>
                          </div>
                          <div className="bg-white rounded p-3 border border-green-200">
                            <span className="font-medium text-green-700">Business Short Code:</span>
                            <div className="text-green-600 font-mono">7573525</div>
                          </div>
                          <div className="bg-white rounded p-3 border border-green-200">
                            <span className="font-medium text-green-700">Status:</span>
                            <div className="text-green-600">Ready for Testing</div>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-2 bg-green-100 rounded">
                          <p className="text-xs text-green-800">
                            ✅ <strong>Ready to use:</strong> Default configuration is pre-approved for testing and development
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Phone Number and Callback */}
                    {selectedMethodType?.fields.map((field) => (
                      <div key={field.key}>
                        <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label}
                        </label>
                        
                        {field.key === 'phoneNumber' ? (
                          <div className="flex space-x-2">
                            <select
                              value={newMethod.metadata.countryCode || '+254'}
                              onChange={(e) => setNewMethod(prev => ({
                                ...prev,
                                metadata: { ...prev.metadata, countryCode: e.target.value }
                              }))}
                              className="w-24 px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="+254">🇰🇪 +254</option>
                              <option value="+256">🇺🇬 +256</option>
                              <option value="+255">🇹🇿 +255</option>
                              <option value="+250">🇷🇼 +250</option>
                            </select>
                            <input
                              type={field.type}
                              id={field.key}
                              value={newMethod.metadata[field.key] || ''}
                              onChange={(e) => setNewMethod(prev => ({
                                ...prev,
                                metadata: { ...prev.metadata, [field.key]: e.target.value }
                              }))}
                              placeholder={field.placeholder}
                              className="flex-1 form-input"
                              required
                            />
                          </div>
                        ) : (
                          <input
                            type={field.type}
                            id={field.key}
                            value={newMethod.metadata[field.key] || ''}
                            onChange={(e) => setNewMethod(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, [field.key]: e.target.value }
                            }))}
                            placeholder={field.placeholder}
                            className="form-input"
                            required
                          />
                        )}
                        
                        {field.key === 'phoneNumber' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Enter without leading 0 (e.g., 743770216)
                          </p>
                        )}
                        {field.key === 'callbackUrl' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Enter your webhook URL where M-Pesa will send payment confirmations
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Custom Credentials Fields */}
                    {useCustomCredentials && selectedMethodType.customFields && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-4">
                          <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                          <h4 className="text-sm font-medium text-blue-900">Your Custom M-Pesa Credentials</h4>
                        </div>
                        
                        <div className="space-y-4">
                          {selectedMethodType.customFields.map((field) => (
                            <div key={field.key}>
                              <label htmlFor={field.key} className="block text-sm font-medium text-blue-700 mb-2">
                                {field.label}
                              </label>
                              <input
                                type={field.type}
                                id={field.key}
                                value={newMethod.metadata[field.key] || ''}
                                onChange={(e) => setNewMethod(prev => ({
                                  ...prev,
                                  metadata: { ...prev.metadata, [field.key]: e.target.value }
                                }))}
                                placeholder={field.placeholder}
                                className="form-input"
                                required={useCustomCredentials}
                              />
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                          <p className="text-xs text-blue-800">
                            💡 <strong>Tip:</strong> Make sure your M-Pesa app is approved by Safaricom before using custom credentials. The keys will be whitelisted within 24hrs
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !selectedMethodType?.enabled}
                    className={`${
                      selectedMethodType?.enabled ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? 'Adding M-Pesa...' : 
                     selectedMethodType?.enabled ? 'Add M-Pesa Method' : 'Select M-Pesa to Continue'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* M-Pesa Setup Guide */}
      <div className="card bg-green-50 border-green-200">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <DevicePhoneMobileIcon className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-green-900">M-Pesa Integration Setup</h3>
            <div className="text-xs text-green-700 mt-2 space-y-1">
              <p><strong>Step 1:</strong> Register on Safaricom Developer Portal</p>
              <p><strong>Step 2:</strong> Create a new app and get your credentials</p>
              <p><strong>Step 3:</strong> Configure your business short code</p>
              <p><strong>Step 4:</strong> Set up callback URL for notifications</p>
            </div>
            <a 
              href="https://developer.safaricom.co.ke" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:text-green-800 font-medium mt-2 inline-block"
            >
              Visit Safaricom Developer Portal →
            </a>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <CheckCircleIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-900">Your M-Pesa credentials are secure</h3>
            <p className="text-sm text-blue-700 mt-1">
              We use industry-standard encryption to protect your M-Pesa configuration. 
              Your consumer secret and other sensitive data are encrypted and stored securely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethods;