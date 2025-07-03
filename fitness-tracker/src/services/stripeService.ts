import { loadStripe } from '@stripe/stripe-js';

// Make sure to set REACT_APP_STRIPE_PUBLISHABLE_KEY in your .env file
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

// Server configuration with fallback
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

// Log server configuration for debugging
console.log('🔧 Server configuration:');
console.log('- REACT_APP_SERVER_URL:', process.env.REACT_APP_SERVER_URL);
console.log('- Final SERVER_URL:', SERVER_URL);
console.log('- Current location:', window.location.href);
console.log('- Is Vercel:', window.location.hostname.includes('vercel.app'));

const STRIPE_CUSTOMER_ID_KEY = 'stripe_customer_id';

// Helper function to get user-specific customer ID key
const getUserCustomerIdKey = (userId: string) => `stripe_customer_id_${userId}`;

// Helper function to get customer ID for current user
const getCustomerIdForUser = (userId: string) => {
  if (!userId) return null;
  return localStorage.getItem(getUserCustomerIdKey(userId));
};

// Helper function to set customer ID for current user
const setCustomerIdForUser = (userId: string, customerId: string) => {
  if (!userId) return;
  localStorage.setItem(getUserCustomerIdKey(userId), customerId);
  // Also clear any old global customer ID
  localStorage.removeItem(STRIPE_CUSTOMER_ID_KEY);
};

// Helper function to clear customer ID for current user
const clearCustomerIdForUser = (userId: string) => {
  if (!userId) return;
  localStorage.removeItem(getUserCustomerIdKey(userId));
  console.log('Cleared customer ID for user:', userId);
};

// Helper function to clear all Stripe data (for testing/debugging only - not for normal logout)
export const clearAllStripeData = () => {
  // Clear old global customer ID
  localStorage.removeItem(STRIPE_CUSTOMER_ID_KEY);
  
  // Clear all user-specific customer IDs
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('stripe_customer_id_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('⚠️  DEBUGGING: Cleared all Stripe data from localStorage - this should only be used for testing!');
};

// Helper function to clear invalid customer ID for a user when server returns errors
export const clearInvalidCustomerId = (userId: string) => {
  if (!userId) return;
  clearCustomerIdForUser(userId);
  console.log('🔧 Cleared invalid customer ID for user:', userId);
};

// Helper function to check server health
const checkServerHealth = async () => {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    if (!response.ok) {
      throw new Error('Server health check failed');
    }
    const data = await response.json();
    console.log('Server health check:', data);
    return data.status === 'ok';
  } catch (error) {
    console.error('Server health check failed:', error);
    return false;
  }
};

// Test server connectivity - for debugging
export const testServerConnection = async () => {
  try {
    console.log('Testing server connection to:', SERVER_URL);
    const response = await fetch(`${SERVER_URL}/health`);
    console.log('Health check response status:', response.status);
    console.log('Health check response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Health check response text:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('Health check response JSON:', data);
      return { success: true, data };
    } catch (jsonError) {
      console.log('Response is not JSON:', text);
      return { success: response.ok, text };
    }
  } catch (error) {
    console.error('Server connection test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// Simple health check for Vercel deployment testing
export const simpleHealthCheck = async () => {
  try {
    console.log('🔍 Simple health check to:', SERVER_URL);
    const response = await fetch(`${SERVER_URL}/health`);
    console.log('✅ Health check status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check data:', data);
      return { success: true, status: response.status, data };
    } else {
      console.log('❌ Health check failed with status:', response.status);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.error('❌ Health check error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      serverUrl: SERVER_URL,
      currentUrl: window.location.href
    };
  }
};

export interface PriceOption {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

export const PREMIUM_FEATURES = [
  'AI-powered workout analysis',
  'Advanced workout statistics',
  'Custom workout plans',
  'Priority support'
];

export const createCheckoutSession = async (priceId: string, userId: string, email: string) => {
  try {
    // Check server health first
    const isServerHealthy = await checkServerHealth();
    if (!isServerHealthy) {
      throw new Error('Server is not responding. Please try again later.');
    }

    const stripe = await stripePromise;
    if (!stripe) throw new Error('Stripe failed to initialize');

    const response = await fetch(`${SERVER_URL}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const { id: sessionId, customerId } = await response.json();

    // Store the customer ID
    if (customerId) {
      setCustomerIdForUser(userId, customerId);
      console.log('Stored Stripe customer ID:', customerId);
    }

    const result = await stripe.redirectToCheckout({
      sessionId,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const cancelSubscription = async (userId: string, userEmail?: string) => {
  try {
    let customerId = getCustomerIdForUser(userId);
    
    // If no customer ID found, try to find it by email
    if (!customerId && userEmail) {
      console.log('No Stripe customer ID found, attempting to find by email:', userEmail);
      customerId = await findCustomerIdByEmail(userEmail, userId);
    }
    
    if (!customerId) {
      console.log('No Stripe customer ID found for user:', userId);
      return { success: false, error: 'No Stripe customer ID found. Please try logging out and back in.' };
    }

    console.log('Attempting to cancel subscription for customer:', customerId, 'user:', userId);
    console.log('Using server URL:', SERVER_URL);
    
    // Test server connectivity first
    console.log('Testing server connection before cancellation...');
    const connectionTest = await testServerConnection();
    console.log('Connection test result:', connectionTest);
    
    if (!connectionTest.success) {
      return { success: false, error: 'Cannot connect to server. Please check your connection and try again.' };
    }
    
    const cancelUrl = `${SERVER_URL}/cancel-subscription/${customerId}/${userId}`;
    console.log('Making request to:', cancelUrl);
    
    let response;
    try {
      response = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (networkError) {
      console.error('Network error during fetch:', networkError);
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }

    console.log('Response received. Status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    let responseText;
    try {
      responseText = await response.text();
      console.log('Response text:', responseText);
    } catch (textError) {
      console.error('Error reading response text:', textError);
      return { success: false, error: 'Could not read server response. Please try again.' };
    }

    // Handle cases where response is not JSON (e.g., HTML error pages)
    if (!responseText.trim()) {
      console.error('Empty response from server');
      return { success: false, error: 'Empty response from server. Please try again.' };
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Response data:', data);
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      console.log('Raw response was:', responseText);
      
      // Check if it's an HTML error page or other non-JSON response
      if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
        return { success: false, error: 'Server returned an unexpected response. Please refresh the page and try again.' };
      }
      
      return { success: false, error: 'Invalid response format from server. Please try again.' };
    }

    // Handle customer not found error (404) - clear invalid customer ID
    if (response.status === 404 && data?.error?.includes('Customer not found')) {
      console.log('Customer not found, clearing invalid customer ID for user:', userId);
      clearInvalidCustomerId(userId);
      
      // Check if server specifically told us to clear data
      if (data?.clearData) {
        return { success: false, error: 'Invalid subscription data has been cleared. Please refresh the page to see updated status.' };
      }
      
      return { success: false, error: 'Your subscription information is outdated. Please refresh the page and try again.' };
    }

    if (!response.ok) {
      console.error('Server returned error:', response.status, data);
      return { success: false, error: data.error || `Server error (${response.status}). Please try again.` };
    }

    // Server should return { success: true, message: '...' }
    if (data && data.success) {
      console.log('Subscription cancelled successfully:', data.message);
      return data;
    } else {
      console.error('Server returned success:false or invalid format:', data);
      return { success: false, error: data?.error || 'Cancellation failed. Please try again.' };
    }
  } catch (error) {
    console.error('Unexpected error in cancelSubscription:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

export interface SubscriptionDetails {
  priceId: string;
  interval: 'month' | 'year';
  currentPeriodEnd: string;
}

export interface SubscriptionStatus {
  isSubscribed: boolean;
  subscriptionDetails?: SubscriptionDetails;
}

export const checkSubscriptionStatus = async (userId: string, userEmail?: string): Promise<SubscriptionStatus> => {
  try {
    console.log('🔍 Starting subscription status check for user:', userId, 'email:', userEmail);
    let customerId = getCustomerIdForUser(userId);
    console.log('📋 Retrieved customer ID from storage:', customerId);
    
    // If no customer ID found, try to find it by email
    if (!customerId) {
      console.log('❌ No Stripe customer ID found for user:', userId);
      // Try to get user email from parameter, localStorage, or sessionStorage
      const email = userEmail || localStorage.getItem('user_email') || sessionStorage.getItem('user_email');
      console.log('📧 Using email for customer lookup:', email);
      if (email) {
        console.log('🔍 Attempting to find customer ID by email:', email);
        customerId = await findCustomerIdByEmail(email, userId);
        if (customerId) {
          console.log('✅ Found customer ID by email:', customerId);
        } else {
          console.log('❌ No customer ID found by email');
        }
      } else {
        console.log('❌ No email available for customer lookup');
      }
      
      if (!customerId) {
        console.log('❌ No customer ID found, returning not subscribed');
        return { isSubscribed: false };
      }
    }

    console.log('Checking subscription status for customer:', customerId, 'user:', userId);
    
    // Try the secure endpoint first
    const response = await fetch(`${SERVER_URL}/check-subscription/${customerId}/${userId}`);
    
    if (!response.ok) {
      console.log('Secure endpoint failed, trying legacy endpoint...');
      // Fallback to legacy endpoint for customers created before userId metadata
      const legacyResponse = await fetch(`${SERVER_URL}/check-subscription/${customerId}`);
      
      if (!legacyResponse.ok) {
        // If legacy also fails, check if it's because customer doesn't exist
        try {
          const errorData = await legacyResponse.json();
          if (legacyResponse.status === 500 && errorData.error?.includes('No such customer')) {
            console.log('Customer does not exist in Stripe, clearing invalid customer ID');
            clearInvalidCustomerId(userId);
            return { isSubscribed: false };
          }
          throw new Error(errorData.error || 'Failed to check subscription status');
        } catch (jsonError) {
          // If we can't parse the error response, just return false
          console.error('Error parsing legacy endpoint response:', jsonError);
          return { isSubscribed: false };
        }
      }
      
      const legacyData = await legacyResponse.json();
      console.log('Legacy endpoint returned:', legacyData);
      
      // Check if server told us to clear data
      if (legacyData.clearData) {
        console.log('🔧 Server indicated invalid data, clearing customer ID');
        clearInvalidCustomerId(userId);
        return { isSubscribed: false };
      }
      
      return {
        isSubscribed: legacyData.isSubscribed,
        subscriptionDetails: legacyData.subscriptionDetails
      };
    }

    const data = await response.json();
    console.log('Secure endpoint returned:', data);
    
    // Check if server told us to clear data (e.g., invalid customer ID format)
    if (data.clearData) {
      console.log('🔧 Server indicated invalid data, clearing customer ID');
      clearInvalidCustomerId(userId);
      return { isSubscribed: false };
    }
    
    return {
      isSubscribed: data.isSubscribed,
      subscriptionDetails: data.subscriptionDetails
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    // If error mentions customer not found, clear the invalid ID
    if (error instanceof Error && error.message.includes('No such customer')) {
      console.log('Clearing invalid customer ID due to error:', error.message);
      clearInvalidCustomerId(userId);
    }
    return { isSubscribed: false };
  }
};

// Helper function to find customer ID by email when none is stored
const findCustomerIdByEmail = async (email: string, userId: string): Promise<string | null> => {
  try {
    console.log('🔍 Attempting to find customer ID for email:', email, 'user:', userId);
    console.log('📡 Making request to:', `${SERVER_URL}/find-customer-by-email`);
    
    const response = await fetch(`${SERVER_URL}/find-customer-by-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, userId }),
    });

    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      console.log('❌ Find customer endpoint failed:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('📡 Response data:', data);
    
    if (data.customerId) {
      console.log('✅ Found customer ID:', data.customerId);
      // Store it for future use
      setCustomerIdForUser(userId, data.customerId);
      return data.customerId;
    } else {
      console.log('❌ No customer ID in response');
    }

    return null;
  } catch (error) {
    console.error('❌ Error finding customer by email:', error);
    return null;
  }
}; 