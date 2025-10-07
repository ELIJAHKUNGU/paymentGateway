import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  CreditCardIcon,
  DocumentTextIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  current: boolean;
  badge?: string;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, current: false },
    { name: 'Transactions', href: '/transactions', icon: DocumentTextIcon, current: false, badge: '3' },
    { name: 'Payment Methods', href: '/payment-methods', icon: CreditCardIcon, current: false },
    { name: 'Profile', href: '/profile', icon: UserCircleIcon, current: false },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, current: false },
  ];

  // Update current navigation item based on route
  const updatedNavigation = navigation.map(item => ({
    ...item,
    current: location.pathname === item.href
  }));

  const notifications = [
    { id: 1, title: 'Payment Received', description: 'KES 1,500 from John Doe', time: '5 min ago', unread: true },
    { id: 2, title: 'Transaction Failed', description: 'KES 2,000 to Jane Smith', time: '1 hour ago', unread: true },
    { id: 3, title: 'New Payment Method', description: 'M-Pesa account added successfully', time: '2 hours ago', unread: false },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
              className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl"
            >
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                      <CurrencyDollarIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <span className="text-xl font-bold text-gradient">PayGateway</span>
                      <p className="text-xs text-gray-500 -mt-1">Customer Portal</p>
                    </div>
                  </div>
                </div>
                <nav className="mt-6 px-2">
                  <div className="space-y-1">
                    {updatedNavigation.map((item) => {
                      const IconComponent = item.icon;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`${
                            item.current
                              ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-700 font-semibold'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          } group flex items-center justify-between px-3 py-3 text-sm font-medium rounded-l-lg transition-all duration-150`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <div className="flex items-center">
                            <IconComponent
                              className={`${
                                item.current ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                              } mr-3 h-5 w-5`}
                            />
                            {item.name}
                          </div>
                          {item.badge && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </nav>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200 shadow-sm">
            {/* Logo */}
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <CurrencyDollarIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-white">PayGateway</span>
                  <p className="text-xs text-blue-100 -mt-1">Customer Portal</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              <nav className="flex-1 px-2 py-4">
                <div className="space-y-1">
                  {updatedNavigation.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`${
                          item.current
                            ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-700 font-semibold shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } group flex items-center justify-between px-3 py-3 text-sm font-medium rounded-l-lg transition-all duration-150`}
                      >
                        <div className="flex items-center">
                          <IconComponent
                            className={`${
                              item.current ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                            } mr-3 h-5 w-5`}
                          />
                          {item.name}
                        </div>
                        {item.badge && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Bottom section */}
              <div className="flex-shrink-0 border-t border-gray-200 p-4">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center space-x-3">
                    <ShieldCheckIcon className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-green-900">Secure Payments</p>
                      <p className="text-xs text-green-700">256-bit SSL encryption</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top nav */}
        <header className="relative z-10 flex-shrink-0 flex h-16 bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-200/50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 border-r border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden transition-colors"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex-1 px-6 flex justify-between items-center">
            {/* Left section - Search */}
            <div className="flex-1 flex items-center max-w-lg">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 hover:bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* Right section - Actions & Profile */}
            <div className="ml-4 flex items-center space-x-3">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <BellIcon className="h-6 w-6" />
                  {notifications.some(n => n.unread) && (
                    <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200/50 py-2 z-50"
                      onMouseLeave={() => setNotificationsOpen(false)}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                              notification.unread ? 'border-blue-500' : 'border-transparent'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${notification.unread ? 'text-gray-900' : 'text-gray-600'}`}>
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">{notification.description}</p>
                              </div>
                              <span className="text-xs text-gray-400 ml-2">{notification.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-white">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.name || 'User'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Customer
                    </div>
                  </div>
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                </button>

                {/* Profile Dropdown Menu */}
                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/50 py-2"
                      onMouseLeave={() => setProfileDropdownOpen(false)}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {user?.name || 'User'}
                            </div>
                            <div className="text-xs text-gray-500">{user?.email}</div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 bg-green-100 text-green-800">
                              {user?.verified ? 'Verified' : 'Unverified'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <UserCircleIcon className="h-4 w-4 mr-3" />
                          View Profile
                        </Link>
                        <Link
                          to="/settings"
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <Cog6ToothIcon className="h-4 w-4 mr-3" />
                          Settings
                        </Link>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;