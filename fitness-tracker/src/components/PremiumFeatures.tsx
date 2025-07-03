import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession, checkSubscriptionStatus, cancelSubscription, clearInvalidCustomerId, clearAllStripeData, simpleHealthCheck, SubscriptionStatus, SubscriptionDetails, testServerConnection } from '../services/stripeService';

const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'price_1RfnsLKf0eM00yCnj2T2lXRN',
    price: 9.99,
    interval: 'month'
  },
  yearly: {
    id: 'price_1Rfw1EKf0eM00yCnluJSp94k', // Updated with actual yearly plan price ID
    price: 100,
    interval: 'year'
  }
};

export const PremiumFeatures: React.FC = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ isSubscribed: false });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Helper function to get plan display name from subscription details
  const getPlanDisplayName = (subscriptionDetails?: SubscriptionDetails): string => {
    if (!subscriptionDetails) {
      return '';
    }
    
    // Map price IDs to plan names
    if (subscriptionDetails.priceId === SUBSCRIPTION_PLANS.monthly.id) {
      return 'Monthly Plan ($9.99/month)';
    } else if (subscriptionDetails.priceId === SUBSCRIPTION_PLANS.yearly.id) {
      return 'Yearly Plan ($100/year)';
    } else if (subscriptionDetails.interval === 'month') {
      return 'Monthly Plan';
    } else if (subscriptionDetails.interval === 'year') {
      return 'Yearly Plan';
    }
    
    return `${subscriptionDetails.interval === 'month' ? 'Monthly' : 'Yearly'} Plan`;
  };

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      // Store user email for subscription status checking
      if (user.email) {
        localStorage.setItem('user_email', user.email);
        console.log('Stored user email for subscription checking:', user.email);
      } else {
        console.log('No user email available for subscription checking');
      }
      
      try {
        console.log('Checking subscription status for user:', user.id, 'email:', user.email);
        const status = await checkSubscriptionStatus(user.id, user.email);
        console.log('Subscription status result:', status);
        setSubscriptionStatus(status);
      } catch (err) {
        console.error('Error checking subscription status:', err);
        setError('Failed to check subscription status');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    
    // Also check if we just returned from a successful payment
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      // Remove the session_id from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Delay a bit to ensure the subscription is processed by Stripe
      setTimeout(() => {
        checkStatus();
      }, 2000);
    }
  }, [user]);

  const handleSubscribe = async (planType: 'monthly' | 'yearly') => {
    if (!user?.email) {
      setError('Please log in to subscribe');
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await createCheckoutSession(SUBSCRIPTION_PLANS[planType].id, user.id, user.email);
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError('Failed to start subscription process');
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.id) {
      setError('User not found');
      return;
    }

    setError(null);
    setSuccess(null);
    setCancelling(true);
    try {
      const result = await cancelSubscription(user.id, user.email);
      
      if (result.success) {
        setSuccess('Your subscription has been successfully cancelled.');
        setShowConfirmDialog(false);
        
        // Refresh subscription status from server to get accurate state
        const updatedStatus = await checkSubscriptionStatus(user.id, user.email);
        setSubscriptionStatus(updatedStatus);
        
        if (!updatedStatus.isSubscribed) {
          setSuccess('✅ Your subscription has been successfully cancelled. You no longer have access to premium features.');
        }
      } else {
        // Check if the error indicates invalid data was cleared OR any customer not found error
        if (result.error?.includes('Invalid subscription data has been cleared') || 
            result.error?.includes('Customer not found') ||
            result.error?.includes('Server returned an unexpected response')) {
          
          setError('🔧 Fixing subscription data...');
          
          // Step 1: Clear customer data
          if (user?.id) {
            clearInvalidCustomerId(user.id);
            localStorage.removeItem('stripe_customer_id');
          }
          
          // Step 2: Wait a moment, then refresh status
          setTimeout(async () => {
            setError('🔄 Refreshing subscription status...');
            
            try {
              const updatedStatus = await checkSubscriptionStatus(user.id, user.email);
              setSubscriptionStatus(updatedStatus);
              setError(null);
              setSuccess('✅ Subscription data fixed! Status updated successfully.');
            } catch (refreshError) {
              console.error('Error during auto-refresh:', refreshError);
              setError('❌ Auto-fix failed. Please try again.');
            }
          }, 1500);
        } else {
          setError(result.error || 'Failed to cancel subscription');
        }
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setError('Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  // Debug function to manually trigger customer ID lookup
  const debugCustomerLookup = async () => {
    if (!user?.email || !user?.id) {
      setDebugInfo('No user email or ID available');
      return;
    }

    setDebugInfo('🔍 Starting debug customer lookup...');
    
    try {
      // Test server connection
      setDebugInfo('📡 Testing server connection...');
      const connectionTest = await testServerConnection();
      setDebugInfo(prev => prev + '\n📡 Server connection: ' + JSON.stringify(connectionTest, null, 2));
      
      // Check localStorage
      const storedEmail = localStorage.getItem('user_email');
      const customerIdKey = `stripe_customer_id_${user.id}`;
      const storedCustomerId = localStorage.getItem(customerIdKey);
      
      setDebugInfo(prev => prev + `\n📋 localStorage check:
        - user_email: ${storedEmail}
        - customer_id_key: ${customerIdKey}
        - stored_customer_id: ${storedCustomerId}
        - current_user_email: ${user.email}
        - current_user_id: ${user.id}`);
      
      // Try to find customer by email
      setDebugInfo(prev => prev + '\n🔍 Attempting to find customer by email...');
      const status = await checkSubscriptionStatus(user.id, user.email);
      setDebugInfo(prev => prev + '\n✅ Subscription check result: ' + JSON.stringify(status, null, 2));
      
    } catch (error) {
      setDebugInfo(prev => prev + '\n❌ Error during debug: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Function to manually set customer ID for testing
  const setCustomerIdManually = () => {
    if (!user?.id) {
      setDebugInfo('No user ID available');
      return;
    }
    
    // Set the known customer ID from backend logs
    const customerId = 'cus_SbLzMs1joDkTwu';
    const customerIdKey = `stripe_customer_id_${user.id}`;
    localStorage.setItem(customerIdKey, customerId);
    
    setDebugInfo(prev => prev + `\n🔧 Manually set customer ID:
      - Key: ${customerIdKey}
      - Value: ${customerId}`);
    
    // Refresh subscription status
    setTimeout(async () => {
      try {
        const status = await checkSubscriptionStatus(user.id, user.email);
        setDebugInfo(prev => prev + '\n✅ Updated subscription status: ' + JSON.stringify(status, null, 2));
        setSubscriptionStatus(status);
      } catch (error) {
        setDebugInfo(prev => prev + '\n❌ Error refreshing status: ' + (error instanceof Error ? error.message : String(error)));
      }
    }, 1000);
  };

  // Function to clear all Stripe data
  const clearAllData = () => {
    clearAllStripeData();
    setDebugInfo(prev => prev + '\n🧹 Cleared all Stripe data from localStorage');
    
    // Refresh subscription status
    setTimeout(async () => {
      if (!user?.id || !user?.email) {
        setDebugInfo(prev => prev + '\n❌ No user available for status refresh');
        return;
      }
      
      try {
        const status = await checkSubscriptionStatus(user.id, user.email);
        setDebugInfo(prev => prev + '\n✅ Updated subscription status after clear: ' + JSON.stringify(status, null, 2));
        setSubscriptionStatus(status);
      } catch (error) {
        setDebugInfo(prev => prev + '\n❌ Error refreshing status: ' + (error instanceof Error ? error.message : String(error)));
      }
    }, 1000);
  };

  // Debug function to check environment variables
  const debugEnvironment = () => {
    const envInfo = {
      serverUrl: process.env.REACT_APP_SERVER_URL || 'NOT SET',
      stripeKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ? 'SET' : 'NOT SET',
      nodeEnv: process.env.NODE_ENV,
      currentUrl: window.location.href,
      isLocalhost: window.location.hostname === 'localhost',
      isVercel: window.location.hostname.includes('vercel.app')
    };
    
    setDebugInfo(prev => prev + '\n🌍 Environment Check:\n' + JSON.stringify(envInfo, null, 2));
  };

  // Debug function to test backend connectivity
  const testBackendConnectivity = async () => {
    setDebugInfo(prev => prev + '\n🔗 Testing backend connectivity...');
    
    try {
      const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
      setDebugInfo(prev => prev + `\n📡 Testing connection to: ${serverUrl}`);
      
      const response = await fetch(`${serverUrl}/health`);
      const text = await response.text();
      
      setDebugInfo(prev => prev + `\n✅ Backend response status: ${response.status}`);
      setDebugInfo(prev => prev + `\n📄 Response: ${text}`);
      
      if (response.ok) {
        setDebugInfo(prev => prev + '\n🎉 Backend is accessible!');
      } else {
        setDebugInfo(prev => prev + '\n❌ Backend returned error status');
      }
    } catch (error) {
      setDebugInfo(prev => prev + `\n❌ Backend connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Debug function to test Vercel deployment
  const testVercelDeployment = async () => {
    setDebugInfo(prev => prev + '\n🚀 Testing Vercel deployment...');
    
    try {
      // Test 1: Check if we're on Vercel
      const isVercel = window.location.hostname.includes('vercel.app');
      setDebugInfo(prev => prev + `\n📍 Deployment: ${isVercel ? 'Vercel' : 'Local'}`);
      setDebugInfo(prev => prev + `\n🌐 URL: ${window.location.href}`);
      
      // Test 2: Check environment variables
      const serverUrl = process.env.REACT_APP_SERVER_URL;
      const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
      setDebugInfo(prev => prev + `\n🔧 Server URL: ${serverUrl || 'NOT SET'}`);
      setDebugInfo(prev => prev + `\n💳 Stripe Key: ${stripeKey ? 'SET' : 'NOT SET'}`);
      
      // Test 3: Test backend connectivity
      if (serverUrl) {
        setDebugInfo(prev => prev + `\n📡 Testing backend at: ${serverUrl}`);
        
        try {
          const response = await fetch(`${serverUrl}/health`);
          const text = await response.text();
          
          setDebugInfo(prev => prev + `\n✅ Backend Status: ${response.status}`);
          setDebugInfo(prev => prev + `\n📄 Response: ${text}`);
          
          if (response.ok) {
            setDebugInfo(prev => prev + '\n🎉 Backend is accessible from Vercel!');
          } else {
            setDebugInfo(prev => prev + '\n❌ Backend returned error status');
          }
        } catch (error) {
          setDebugInfo(prev => prev + `\n❌ Backend connection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        setDebugInfo(prev => prev + '\n❌ No server URL configured');
      }
      
      // Test 4: Test subscription check
      if (user?.id && user?.email) {
        setDebugInfo(prev => prev + `\n👤 Testing subscription for user: ${user.id}`);
        
        try {
          const status = await checkSubscriptionStatus(user.id, user.email);
          setDebugInfo(prev => prev + `\n📊 Subscription Status: ${JSON.stringify(status, null, 2)}`);
        } catch (error) {
          setDebugInfo(prev => prev + `\n❌ Subscription check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      setDebugInfo(prev => prev + `\n❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Simple health check function
  const runSimpleHealthCheck = async () => {
    setDebugInfo(prev => prev + '\n🔍 Running simple health check...');
    
    try {
      const result = await simpleHealthCheck();
      setDebugInfo(prev => prev + '\n📊 Health Check Result: ' + JSON.stringify(result, null, 2));
      
      if (result.success) {
        setDebugInfo(prev => prev + '\n🎉 Backend is accessible!');
      } else {
        setDebugInfo(prev => prev + '\n❌ Backend is not accessible');
      }
    } catch (error) {
      setDebugInfo(prev => prev + `\n❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Comprehensive debug function for Vercel deployment issues
  const debugVercelSubscriptionIssue = async () => {
    if (!user?.email || !user?.id) {
      setDebugInfo('❌ No user email or ID available');
      return;
    }

    setDebugInfo('🔍 Starting comprehensive Vercel subscription debug...\n');
    
    try {
      // Step 1: Environment check
      setDebugInfo(prev => prev + '📋 Step 1: Environment Variables\n');
      const envInfo = {
        serverUrl: process.env.REACT_APP_SERVER_URL,
        stripeKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ? 'Present' : 'Missing',
        currentUrl: window.location.href,
        isVercel: window.location.hostname.includes('vercel.app'),
        userAgent: navigator.userAgent
      };
      setDebugInfo(prev => prev + JSON.stringify(envInfo, null, 2) + '\n\n');
      
      // Step 2: Server connectivity test
      setDebugInfo(prev => prev + '📡 Step 2: Server Connectivity Test\n');
      const healthCheck = await simpleHealthCheck();
      setDebugInfo(prev => prev + JSON.stringify(healthCheck, null, 2) + '\n\n');
      
      // Step 3: Local storage check
      setDebugInfo(prev => prev + '💾 Step 3: Local Storage Check\n');
      const storedEmail = localStorage.getItem('user_email');
      const customerIdKey = `stripe_customer_id_${user.id}`;
      const storedCustomerId = localStorage.getItem(customerIdKey);
      const storageInfo = {
        userEmail: storedEmail,
        customerIdKey,
        storedCustomerId,
        currentUserEmail: user.email,
        currentUserId: user.id
      };
      setDebugInfo(prev => prev + JSON.stringify(storageInfo, null, 2) + '\n\n');
      
      // Step 4: Direct subscription check
      setDebugInfo(prev => prev + '🔍 Step 4: Direct Subscription Check\n');
      try {
        const subscriptionStatus = await checkSubscriptionStatus(user.id, user.email);
        setDebugInfo(prev => prev + JSON.stringify(subscriptionStatus, null, 2) + '\n\n');
      } catch (subError) {
        setDebugInfo(prev => prev + `❌ Subscription check failed: ${subError}\n\n`);
      }
      
      // Step 5: Customer lookup by email
      setDebugInfo(prev => prev + '🔍 Step 5: Customer Lookup by Email\n');
      try {
        const response = await fetch(`${process.env.REACT_APP_SERVER_URL || 'http://localhost:3001'}/find-customer-by-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.email, userId: user.id }),
        });
        
        const customerData = await response.json();
        setDebugInfo(prev => prev + `Status: ${response.status}\nData: ${JSON.stringify(customerData, null, 2)}\n\n`);
      } catch (customerError) {
        setDebugInfo(prev => prev + `❌ Customer lookup failed: ${customerError}\n\n`);
      }
      
      // Step 6: Direct subscription check with known customer ID
      setDebugInfo(prev => prev + '🔍 Step 6: Direct Check with Known Customer ID\n');
      try {
        // Based on backend logs, we know the customer ID for hervedovbus@gmail.com
        const knownCustomerId = 'cus_SbLzMs1joDkTwu';
        const directResponse = await fetch(`${process.env.REACT_APP_SERVER_URL || 'http://localhost:3001'}/check-subscription/${knownCustomerId}/${user.id}`);
        
        const directData = await directResponse.json();
        setDebugInfo(prev => prev + `Status: ${directResponse.status}\nData: ${JSON.stringify(directData, null, 2)}\n\n`);
      } catch (directError) {
        setDebugInfo(prev => prev + `❌ Direct check failed: ${directError}\n\n`);
      }
      
      setDebugInfo(prev => prev + '✅ Comprehensive debug complete!\n');
      
    } catch (error) {
      setDebugInfo(prev => prev + `❌ Debug failed: ${error}\n`);
    }
  };

  // Set known customer ID for testing (based on backend logs)
  const setKnownCustomerId = () => {
    if (!user?.id) {
      setDebugInfo('❌ No user ID available');
      return;
    }
    
    // Based on backend logs, we know the customer ID for hervedovbus@gmail.com
    const knownCustomerId = 'cus_SbLzMs1joDkTwu';
    const customerIdKey = `stripe_customer_id_${user.id}`;
    
    localStorage.setItem(customerIdKey, knownCustomerId);
    localStorage.setItem('user_email', user.email || '');
    
    setDebugInfo(prev => prev + `✅ Set known customer ID: ${knownCustomerId} for user: ${user.id}\n`);
    setDebugInfo(prev => prev + `📧 User email: ${user.email}\n`);
    
    // Refresh subscription status
    setTimeout(async () => {
      try {
        const status = await checkSubscriptionStatus(user.id, user.email);
        setSubscriptionStatus(status);
        setDebugInfo(prev => prev + `🔄 Refreshed subscription status: ${JSON.stringify(status, null, 2)}\n`);
      } catch (error) {
        setDebugInfo(prev => prev + `❌ Failed to refresh status: ${error}\n`);
      }
    }, 1000);
  };

  // Simple connectivity test - bypasses all subscription logic
  const testBasicConnectivity = async () => {
    try {
      const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
      setDebugInfo('🔍 Testing basic connectivity...\\n');
      setDebugInfo(prev => prev + `📡 Server URL: ${serverUrl}\\n`);
      setDebugInfo(prev => prev + `🌐 Current location: ${window.location.href}\\n`);
      
      // Test 1: Simple fetch to health endpoint
      setDebugInfo(prev => prev + '\\n📋 Test 1: Health endpoint\\n');
      const healthResponse = await fetch(`${serverUrl}/health`);
      setDebugInfo(prev => prev + `Status: ${healthResponse.status}\\n`);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setDebugInfo(prev => prev + `✅ Health check successful: ${JSON.stringify(healthData)}\\n`);
        
        // Test 2: Try the subscription endpoint with the known customer ID
        setDebugInfo(prev => prev + '\\n📋 Test 2: Subscription endpoint\\n');
        const knownCustomerId = 'cus_SbLzMs1joDkTwu';
        const knownUserId = '5bc0eb9f-9943-4a44-a234-38679fcadeae';
        
        const subResponse = await fetch(`${serverUrl}/check-subscription/${knownCustomerId}/${knownUserId}`);
        setDebugInfo(prev => prev + `Subscription endpoint status: ${subResponse.status}\\n`);
        
        if (subResponse.ok) {
          const subData = await subResponse.json();
          setDebugInfo(prev => prev + `✅ Subscription check successful: ${JSON.stringify(subData)}\\n`);
        } else {
          const errorText = await subResponse.text();
          setDebugInfo(prev => prev + `❌ Subscription check failed: ${errorText}\\n`);
        }
      } else {
        const errorText = await healthResponse.text();
        setDebugInfo(prev => prev + `❌ Health check failed: ${errorText}\\n`);
      }
      
    } catch (error) {
      setDebugInfo(prev => prev + `❌ Connectivity test failed: ${error instanceof Error ? error.message : String(error)}\\n`);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-center">Premium Features</h2>
      
      {/* Test text to see if component is rendering */}
      <div className="mb-4 p-2 bg-yellow-100 border border-yellow-400 rounded">
        <p className="text-yellow-800 text-sm">🔧 DEBUG: Component is rendering! User ID: {user?.id || 'none'}</p>
      </div>
      
      {/* Debug section */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Information</h3>
        <button 
          onClick={debugCustomerLookup}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Debug Customer Lookup
        </button>
        <button 
          onClick={setCustomerIdManually}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Set Customer ID Manually
        </button>
        <button 
          onClick={clearAllData}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Clear All Stripe Data
        </button>
        <button 
          onClick={debugEnvironment}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Debug Environment
        </button>
        <button 
          onClick={testBackendConnectivity}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Test Backend Connectivity
        </button>
        <button 
          onClick={testVercelDeployment}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Test Vercel Deployment
        </button>
        <button 
          onClick={runSimpleHealthCheck}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Run Simple Health Check
        </button>
        <button 
          onClick={debugVercelSubscriptionIssue}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Debug Vercel Subscription Issue
        </button>
        <button 
          onClick={setKnownCustomerId}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Set Known Customer ID
        </button>
        <button 
          onClick={testBasicConnectivity}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2"
        >
          Test Basic Connectivity
        </button>
        {debugInfo && (
          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
            {debugInfo}
          </pre>
        )}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {subscriptionStatus.isSubscribed ? (
        <div>
          <div className="mb-4">
            <p className="text-green-600 text-lg font-semibold">✓ You have access to premium features!</p>
            {subscriptionStatus.subscriptionDetails ? (
              <div className="text-gray-600 mt-2">
                <p>
                  <span className="font-medium">Current Plan:</span> {getPlanDisplayName(subscriptionStatus.subscriptionDetails)}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Subscription ends:</span> {new Date(subscriptionStatus.subscriptionDetails.currentPeriodEnd).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 mt-2 text-sm">
                <em>Loading plan details...</em>
              </p>
            )}
          </div>
          
          {showConfirmDialog ? (
            <div className="bg-yellow-50 border border-yellow-400 p-4 rounded mb-4">
              <p className="text-yellow-800 mb-4">Are you sure you want to cancel your subscription? You'll lose access to all premium features.</p>
              <div className="flex space-x-4">
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  No, Keep Subscription
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-center">Upgrade to access premium features:</p>
          <div className="mb-6 space-y-2 text-center">
            <p>AI-powered workout analysis</p>
            <p>Advanced workout statistics</p>
            <p>Custom workout plans</p>
            <p>Priority support</p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <table style={{ margin: '0 auto', maxWidth: '600px', width: 'auto' }} className="border-collapse">
              <thead>
                <tr>
                  <th className="border-b-2 p-4 text-center" style={{ width: '300px' }}>Monthly Plan</th>
                  <th className="border-b-2 p-4 text-center" style={{ width: '300px' }}>Yearly Plan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b p-4 text-center">
                    <div className="text-2xl font-bold">$9.99/month</div>
                    <button
                      onClick={() => handleSubscribe('monthly')}
                      disabled={loading}
                      className="mt-4 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Subscribe Monthly'}
                    </button>
                  </td>
                  <td className="border-b p-4 text-center">
                    <div className="text-2xl font-bold">
                      $100/year
                      <div className="text-sm text-green-600 font-normal">Save $20/year</div>
                    </div>
                    <button
                      onClick={() => handleSubscribe('yearly')}
                      disabled={loading}
                      className="mt-4 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Subscribe Yearly'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}; 