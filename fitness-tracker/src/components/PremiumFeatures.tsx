import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession, checkSubscriptionStatus, cancelSubscription, clearInvalidCustomerId, SubscriptionStatus } from '../services/stripeService';

interface SubscriptionDetails {
  priceId: string;
  interval: string;
  currentPeriodEnd: string;
}

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
      try {
        const status = await checkSubscriptionStatus(user.id);
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
        const updatedStatus = await checkSubscriptionStatus(user.id);
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
              const updatedStatus = await checkSubscriptionStatus(user.id);
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



  if (loading) {
    return <div>Loading...</div>;
  }



  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-center">Premium Features</h2>
      

      
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