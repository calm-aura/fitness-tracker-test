const path = require('path');
require('dotenv').config();

// Log environment setup
console.log('Environment Setup:');
console.log('- STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✓ Present' : '✗ Missing');
console.log('- STRIPE_SECRET_KEY type:', typeof process.env.STRIPE_SECRET_KEY);
console.log('- STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.length : 0);
console.log('- CLIENT_URL:', process.env.CLIENT_URL || 'http://localhost:3000');

const express = require('express');
const cors = require('cors');

// Initialize Stripe with the secret key
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is required');
  process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Test Stripe connection
stripe.customers.list({ limit: 1 })
  .then(() => console.log('✓ Stripe connection successful'))
  .catch(err => {
    console.error('✗ Stripe connection failed:', err.message);
    process.exit(1);
  });

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes with more detailed configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe: '✓ Connected'
  });
});

// Create a checkout session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, userId, email } = req.body;
    console.log('Creating checkout session for price:', priceId);

    // First, create a customer
    const customer = await stripe.customers.create({
      metadata: {
        userId: userId
      },
      email: email
    });

    console.log('Created customer:', customer.id);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/`,
    });

    console.log('Checkout session created:', session.id);
    res.json({ id: session.id, customerId: customer.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check subscription status with user validation
app.get('/check-subscription/:customerId/:userId', async (req, res) => {
  try {
    const { customerId, userId } = req.params;
    console.log('🔍 [SECURE] Checking subscription for customer:', customerId, 'user:', userId);

    // Check if customerId looks like a userId (UUID format) instead of a Stripe customer ID
    if (customerId === userId || (customerId.length === 36 && customerId.includes('-'))) {
      console.log('⚠️ [SECURE] Customer ID appears to be a user ID, not a Stripe customer ID:', customerId);
      return res.json({ 
        isSubscribed: false, 
        error: 'Invalid customer ID format',
        clearData: true 
      });
    }

    // First verify the customer exists and belongs to the user
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      console.log('✅ [SECURE] Customer found:', customerId, 'Email:', customer.email, 'Metadata userId:', customer.metadata.userId);
    } catch (error) {
      if (error.code === 'resource_missing') {
        console.log('❌ [SECURE] Customer not found:', customerId);
        return res.json({ 
          isSubscribed: false,
          error: 'Customer not found',
          clearData: true 
        });
      }
      throw error;
    }

    // Validate that the customer belongs to the requesting user
    if (customer.metadata.userId !== userId) {
      console.log('🚫 [SECURE] Customer does not belong to user. Customer userId:', customer.metadata.userId, 'Requested userId:', userId);
      return res.json({ isSubscribed: false });
    }

    console.log('✅ [SECURE] User ownership validated');

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });

    console.log(`📊 [SECURE] Found ${subscriptions.data.length} active subscriptions for customer ${customerId}`);
    
    if (subscriptions.data.length > 0) {
      console.log('🎉 [SECURE] Active subscriptions:', subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        price_id: sub.items.data[0]?.price?.id,
        interval: sub.items.data[0]?.price?.recurring?.interval
      })));
    } else {
      console.log('❌ [SECURE] No active subscriptions found for customer:', customerId);
      
      // Also check for all subscriptions (including inactive ones) for debugging
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
      });
      console.log(`🔍 [SECURE] Total subscriptions (all statuses) for ${customerId}:`, allSubscriptions.data.length);
      if (allSubscriptions.data.length > 0) {
        console.log('📋 [SECURE] All subscriptions:', allSubscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          price_id: sub.items.data[0]?.price?.id,
          interval: sub.items.data[0]?.price?.recurring?.interval
        })));
      }
    }

    const isSubscribed = subscriptions.data.length > 0;
    let subscriptionDetails = null;
    
    if (isSubscribed) {
      const activeSubscription = subscriptions.data[0];
      subscriptionDetails = {
        priceId: activeSubscription.items.data[0]?.price?.id,
        interval: activeSubscription.items.data[0]?.price?.recurring?.interval,
        currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000).toISOString()
      };
    }
    
    console.log(`🏁 [SECURE] Final result for ${customerId}: isSubscribed = ${isSubscribed}`, subscriptionDetails);

    res.json({ isSubscribed, subscriptionDetails });
  } catch (error) {
    console.error('❌ [SECURE] Error checking subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check subscription status (legacy endpoint - now with basic security)
app.get('/check-subscription/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log('🔍 [LEGACY] Checking subscription for customer:', customerId);

    // First verify the customer exists
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      console.log('✅ [LEGACY] Customer found:', customerId, 'Email:', customer.email);
    } catch (error) {
      if (error.code === 'resource_missing') {
        console.log('❌ [LEGACY] Customer not found:', customerId);
        return res.json({ isSubscribed: false });
      }
      throw error;
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });

    console.log(`📊 [LEGACY] Found ${subscriptions.data.length} active subscriptions for customer ${customerId}`);
    
    if (subscriptions.data.length > 0) {
      console.log('🎉 [LEGACY] Active subscriptions:', subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        price_id: sub.items.data[0]?.price?.id,
        interval: sub.items.data[0]?.price?.recurring?.interval
      })));
    } else {
      console.log('❌ [LEGACY] No active subscriptions found for customer:', customerId);
      
      // Also check for all subscriptions (including inactive ones) for debugging
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
      });
      console.log(`🔍 [LEGACY] Total subscriptions (all statuses) for ${customerId}:`, allSubscriptions.data.length);
      if (allSubscriptions.data.length > 0) {
        console.log('📋 [LEGACY] All subscriptions:', allSubscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          price_id: sub.items.data[0]?.price?.id,
          interval: sub.items.data[0]?.price?.recurring?.interval
        })));
      }
    }

    const isSubscribed = subscriptions.data.length > 0;
    let subscriptionDetails = null;
    
    if (isSubscribed) {
      const activeSubscription = subscriptions.data[0];
      subscriptionDetails = {
        priceId: activeSubscription.items.data[0]?.price?.id,
        interval: activeSubscription.items.data[0]?.price?.recurring?.interval,
        currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000).toISOString()
      };
    }
    
    console.log(`🏁 [LEGACY] Final result for ${customerId}: isSubscribed = ${isSubscribed}`, subscriptionDetails);

    res.json({ isSubscribed, subscriptionDetails });
  } catch (error) {
    console.error('❌ [LEGACY] Error checking subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint to handle subscription events
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        console.log(`Subscription ${event.type}:`, subscription);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Cancel subscription
app.post('/cancel-subscription/:customerId/:userId', async (req, res) => {
  try {
    const { customerId, userId } = req.params;
    console.log('Attempting to cancel subscription for customer:', customerId, 'user:', userId);

    // First verify the customer exists and belongs to the user
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      console.log('Found customer:', customer.id);
    } catch (error) {
      console.error('Error retrieving customer:', error.message);
      if (error.code === 'resource_missing') {
        console.log('Customer not found, this means the stored customer ID is invalid');
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found. Your stored subscription data is invalid and needs to be cleared.',
          clearData: true  // Signal frontend to clear invalid data
        });
      }
      throw error;
    }

    // Validate that the customer belongs to the requesting user
    if (customer.metadata.userId !== userId) {
      console.log('Customer does not belong to user. Customer userId:', customer.metadata.userId, 'Requested userId:', userId);
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized: Customer does not belong to user' 
      });
    }

    // Get active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    console.log(`Found ${subscriptions.data.length} active subscriptions for customer:`, customerId);

    if (subscriptions.data.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No active subscription found' 
      });
    }

    // Cancel each active subscription
    for (const subscription of subscriptions.data) {
      console.log('Cancelling subscription:', subscription.id);
      await stripe.subscriptions.cancel(subscription.id);
      console.log('Successfully cancelled subscription:', subscription.id);
    }

    res.json({ 
      success: true, 
      message: 'Subscription cancelled successfully' 
    });
  } catch (error) {
    console.error('Error in cancel-subscription:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel subscription. Please try again or contact support.' 
    });
  }
});

// Cancel subscription (legacy endpoint - now with basic security)
app.post('/cancel-subscription/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log('Attempting to cancel subscription for customer:', customerId);

    // First verify the customer exists
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      console.log('Found customer:', customer.id);
    } catch (error) {
      console.error('Error retrieving customer:', error.message);
      if (error.code === 'resource_missing') {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found. Please try logging out and back in.' 
        });
      }
      throw error;
    }

    // Get active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    console.log(`Found ${subscriptions.data.length} active subscriptions for customer:`, customerId);

    if (subscriptions.data.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No active subscription found' 
      });
    }

    // Cancel each active subscription
    for (const subscription of subscriptions.data) {
      console.log('Cancelling subscription:', subscription.id);
      await stripe.subscriptions.cancel(subscription.id);
      console.log('Successfully cancelled subscription:', subscription.id);
    }

    res.json({ 
      success: true, 
      message: 'Subscription cancelled successfully' 
    });
  } catch (error) {
    console.error('Error in cancel-subscription:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel subscription. Please try again or contact support.' 
    });
  }
});

// Find customer by email (for recovering lost customer IDs)
app.post('/find-customer-by-email', async (req, res) => {
  try {
    const { email, userId } = req.body;
    
    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }

    console.log('🔍 Searching for customer with email:', email, 'for user:', userId);

    // Search for customers with this email
    const customers = await stripe.customers.list({
      email: email,
      limit: 10
    });

    console.log(`📊 Found ${customers.data.length} customers with email ${email}`);

    // Find a customer that belongs to this user or has an active subscription
    for (const customer of customers.data) {
      console.log(`🔍 Checking customer ${customer.id}:`, {
        email: customer.email,
        metadata_userId: customer.metadata.userId,
        created: new Date(customer.created * 1000).toISOString()
      });

      // Check if customer belongs to this user
      if (customer.metadata.userId === userId) {
        console.log(`✅ Found matching customer by userId: ${customer.id}`);
        return res.json({ customerId: customer.id });
      }

      // If no userId metadata, check if they have active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        console.log(`✅ Found customer with active subscription: ${customer.id}`);
        console.log('🔄 Updating customer metadata with userId');
        
        // Update the customer with the correct userId metadata
        await stripe.customers.update(customer.id, {
          metadata: { userId: userId }
        });
        
        return res.json({ customerId: customer.id });
      }
    }

    console.log('❌ No matching customer found for email:', email);
    res.json({ customerId: null });
  } catch (error) {
    console.error('❌ Error finding customer by email:', error);
    res.status(500).json({ error: 'Failed to find customer' });
  }
});

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Render deployment ready!');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please try a different port or kill the process using this port.`);
    process.exit(1);
  } else {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}); 