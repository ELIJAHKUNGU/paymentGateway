import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CurrencyDollarIcon,
  CreditCardIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PlusIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { usePayment } from '../context/PaymentContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { transactions, paymentMethods, stats, isLoading } = usePayment();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Get recent transactions (last 5)
  const recentTransactions = transactions.slice(0, 5);

  // Calculate quick stats
  const quickStats = {
    totalBalance: stats?.totalAmount || 0,
    pendingAmount: transactions
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0),
    successfulTransactions: transactions.filter(t => t.status === 'completed').length,
    totalTransactions: transactions.length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircleIcon;
      case 'pending':
        return ClockIcon;
      case 'failed':
      case 'cancelled':
        return ExclamationTriangleIcon;
      default:
        return ClockIcon;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'mpesa':
      case 'm-pesa':
        return DevicePhoneMobileIcon;
      case 'card':
      case 'credit card':
      case 'debit card':
        return CreditCardIcon;
      case 'bank':
      case 'bank transfer':
        return BuildingOfficeIcon;
      default:
        return GlobeAltIcon;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-32 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-200 rounded-xl h-96 animate-pulse"></div>
          <div className="bg-gray-200 rounded-xl h-96 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}! 👋</h1>
            <p className="text-blue-100 text-lg">
              Manage your payments and transactions with ease
            </p>
            <p className="text-blue-200 text-sm mt-1">
              Last login: {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6">
              <p className="text-sm text-blue-100">Account Balance</p>
              <p className="text-4xl font-bold">{formatCurrency(quickStats.totalBalance)}</p>
              <p className="text-sm text-blue-200">Available funds</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Balance',
            value: formatCurrency(quickStats.totalBalance),
            change: '+12.5%',
            changeType: 'positive',
            icon: CurrencyDollarIcon,
            gradient: 'from-green-500 to-emerald-600'
          },
          {
            title: 'Pending Amount',
            value: formatCurrency(quickStats.pendingAmount),
            change: '-2.3%',
            changeType: 'negative',
            icon: ClockIcon,
            gradient: 'from-yellow-500 to-orange-600'
          },
          {
            title: 'Successful Payments',
            value: quickStats.successfulTransactions.toString(),
            change: '+8.2%',
            changeType: 'positive',
            icon: CheckCircleIcon,
            gradient: 'from-blue-500 to-indigo-600'
          },
          {
            title: 'Total Transactions',
            value: quickStats.totalTransactions.toString(),
            change: '+15.7%',
            changeType: 'positive',
            icon: BanknotesIcon,
            gradient: 'from-purple-500 to-pink-600'
          }
        ].map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card card-hover"
            >
              <div className="flex items-center">
                <div className={`p-3 rounded-lg bg-gradient-to-r ${stat.gradient}`}>
                  <IconComponent className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <div className="flex items-center mt-1">
                    {stat.changeType === 'positive' ? (
                      <ArrowTrendingUpIcon className="h-4 w-4 text-green-600 mr-1" />
                    ) : (
                      <ArrowTrendingDownIcon className="h-4 w-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">vs last {selectedPeriod}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <Link
                to="/transactions"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
              >
                <span>View All</span>
                <EyeIcon className="h-4 w-4 ml-1" />
              </Link>
            </div>

            <div className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => {
                  const StatusIcon = getStatusIcon(transaction.status);
                  const MethodIcon = getMethodIcon(transaction.method);
                  
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-lg ${
                            transaction.type === 'payment' ? 'bg-red-100' : 'bg-green-100'
                          }`}>
                            {transaction.type === 'payment' ? (
                              <ArrowUpIcon className={`h-5 w-5 ${
                                transaction.type === 'payment' ? 'text-red-600' : 'text-green-600'
                              }`} />
                            ) : (
                              <ArrowDownIcon className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {transaction.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <MethodIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-xs text-gray-500">{transaction.method}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(transaction.createdAt), 'MMM d, HH:mm')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${
                          transaction.type === 'payment' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.type === 'payment' ? '-' : '+'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <BanknotesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
                  <p className="text-gray-500 mb-4">Start by making your first payment or receiving funds.</p>
                  <Link
                    to="/payment-methods"
                    className="btn-primary inline-flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions & Payment Methods */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
            <div className="space-y-3">
              {[
                {
                  title: 'Send Money',
                  description: 'Transfer funds instantly',
                  icon: CurrencyDollarIcon,
                  gradient: 'from-blue-500 to-blue-600',
                  href: '/transactions?action=send'
                },
                {
                  title: 'Request Payment',
                  description: 'Generate payment request',
                  icon: BanknotesIcon,
                  gradient: 'from-green-500 to-green-600',
                  href: '/transactions?action=request'
                },
                {
                  title: 'Add Payment Method',
                  description: 'Link new account',
                  icon: CreditCardIcon,
                  gradient: 'from-purple-500 to-purple-600',
                  href: '/payment-methods'
                }
              ].map((action) => {
                const IconComponent = action.icon;
                return (
                  <Link
                    key={action.title}
                    to={action.href}
                    className={`flex items-center p-4 bg-gradient-to-r ${action.gradient} rounded-xl text-white hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl`}
                  >
                    <IconComponent className="h-6 w-6 mr-4" />
                    <div>
                      <p className="font-semibold">{action.title}</p>
                      <p className="text-sm opacity-90">{action.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* Payment Methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
              <Link
                to="/payment-methods"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Manage
              </Link>
            </div>

            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {paymentMethods.slice(0, 3).map((method) => {
                  const MethodIcon = getMethodIcon(method.type);
                  return (
                    <div
                      key={method.id}
                      className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <MethodIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{method.name}</p>
                        <p className="text-xs text-gray-500">{method.details}</p>
                      </div>
                      {method.isDefault && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Default
                        </span>
                      )}
                    </div>
                  );
                })}
                {paymentMethods.length > 3 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{paymentMethods.length - 3} more payment methods
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCardIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No payment methods added</p>
                <Link
                  to="/payment-methods"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Add your first payment method
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;