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
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://fitness-tracker-frontend.vercel.app',
  'https://fitness-tracker-frontend-git-main.vercel.app',
  'https://fitness-tracker-frontend-git-develop.vercel.app'
];

// Add the CLIENT_URL if it's set
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Allow any Vercel deployment
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Allow specific allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
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
    console.log('Creating checkout session for price:', priceId, 'user:', userId, 'email:', email);

    // First, check if a customer already exists for this email
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log('Found existing customer:', customer.id, 'for email:', email);
      
      // Update the customer's metadata if needed
      if (customer.metadata.userId !== userId) {
        console.log('Updating customer metadata from:', customer.metadata.userId, 'to:', userId);
        customer = await stripe.customers.update(customer.id, {
          metadata: {
            userId: userId
          }
        });
      }
    } else {
      // Create a new customer
      customer = await stripe.customers.create({
        metadata: {
          userId: userId
        },
        email: email
      });
      console.log('Created new customer:', customer.id);
    }

    // Check if the customer already has an active subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (existingSubscriptions.data.length > 0) {
      console.log('Customer already has an active subscription:', existingSubscriptions.data[0].id);
      return res.status(400).json({ 
        error: 'You already have an active subscription. Please cancel your current subscription before creating a new one.' 
      });
    }

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

    // Validate customer ID format - Stripe customer IDs start with 'cus_'
    if (!customerId.startsWith('cus_')) {
      console.log('❌ [LEGACY] Invalid customer ID format (probably user ID):', customerId);
      console.log('🔧 [LEGACY] This looks like a user ID instead of a customer ID - clearing data');
      return res.json({ 
        isSubscribed: false, 
        clearData: true,
        error: 'Invalid customer ID format'
      });
    }

    // First verify the customer exists
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      console.log('✅ [LEGACY] Customer found:', customerId, 'Email:', customer.email);
    } catch (error) {
      if (error.code === 'resource_missing') {
        console.log('❌ [LEGACY] Customer not found:', customerId);
        return res.json({ 
          isSubscribed: false,
          clearData: true  // Signal frontend to clear invalid data
        });
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

// ================== WORKOUT MANAGEMENT ENDPOINTS ==================

// File-based workout storage for persistence
const fs = require('fs');

const WORKOUTS_FILE = path.join(__dirname, 'workouts.json');

// Load workouts from file or initialize empty array
let workouts = [];
let nextWorkoutId = 1;

function loadWorkouts() {
  try {
    if (fs.existsSync(WORKOUTS_FILE)) {
      const data = fs.readFileSync(WORKOUTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      workouts = parsed.workouts || [];
      nextWorkoutId = parsed.nextWorkoutId || 1;
      console.log(`📂 Loaded ${workouts.length} workouts from file`);
    } else {
      console.log('📂 No workouts file found, starting with empty storage');
    }
  } catch (error) {
    console.error('❌ Error loading workouts:', error);
    workouts = [];
    nextWorkoutId = 1;
  }
}

function saveWorkouts() {
  try {
    const data = {
      workouts: workouts,
      nextWorkoutId: nextWorkoutId
    };
    fs.writeFileSync(WORKOUTS_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${workouts.length} workouts to file`);
  } catch (error) {
    console.error('❌ Error saving workouts:', error);
  }
}

// Load workouts on server start
loadWorkouts();

// Get all workouts for a user
app.get('/api/workouts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📋 Getting workouts for user:', userId);
    
    // Filter workouts for this user
    const userWorkouts = workouts.filter(workout => workout.user_id === userId);
    console.log(`✅ Found ${userWorkouts.length} workouts for user ${userId}`);
    
    res.json(userWorkouts);
  } catch (error) {
    console.error('❌ Error getting workouts:', error);
    res.status(500).json({ error: 'Failed to get workouts' });
  }
});

// Create a new workout
app.post('/api/workouts', async (req, res) => {
  try {
    const { user_id, type, duration, calories, notes, ai_analysis } = req.body;
    console.log('💪 Creating workout for user:', user_id);
    
    if (!user_id || !type || !duration || calories === undefined) {
      return res.status(400).json({ error: 'Missing required fields: user_id, type, duration, calories' });
    }
    
    const workout = {
      id: nextWorkoutId++,
      user_id,
      type,
      duration: Number(duration),
      calories: Number(calories),
      notes: notes || null,
      ai_analysis: ai_analysis || null,
      created_at: new Date().toISOString()
    };
    
    workouts.push(workout);
    saveWorkouts(); // Save to file
    console.log('✅ Workout created successfully:', workout.id);
    
    res.status(201).json(workout);
  } catch (error) {
    console.error('❌ Error creating workout:', error);
    res.status(500).json({ error: 'Failed to create workout' });
  }
});

// Update a workout
app.put('/api/workouts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, type, duration, calories, notes, ai_analysis } = req.body;
    console.log('🔄 Updating workout:', id, 'for user:', user_id);
    
    const workoutIndex = workouts.findIndex(w => w.id === Number(id) && w.user_id === user_id);
    
    if (workoutIndex === -1) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    // Update the workout
    workouts[workoutIndex] = {
      ...workouts[workoutIndex],
      type: type || workouts[workoutIndex].type,
      duration: duration !== undefined ? Number(duration) : workouts[workoutIndex].duration,
      calories: calories !== undefined ? Number(calories) : workouts[workoutIndex].calories,
      notes: notes !== undefined ? notes : workouts[workoutIndex].notes,
      ai_analysis: ai_analysis !== undefined ? ai_analysis : workouts[workoutIndex].ai_analysis,
      updated_at: new Date().toISOString()
    };
    
    saveWorkouts(); // Save to file
    console.log('✅ Workout updated successfully:', id);
    res.json(workouts[workoutIndex]);
  } catch (error) {
    console.error('❌ Error updating workout:', error);
    res.status(500).json({ error: 'Failed to update workout' });
  }
});

// Delete a workout
app.delete('/api/workouts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    console.log('🗑️ Deleting workout:', id, 'for user:', user_id);
    
    const workoutIndex = workouts.findIndex(w => w.id === Number(id) && w.user_id === user_id);
    
    if (workoutIndex === -1) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    workouts.splice(workoutIndex, 1);
    saveWorkouts(); // Save to file
    console.log('✅ Workout deleted successfully:', id);
    
    res.json({ success: true, message: 'Workout deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting workout:', error);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

// AI Analysis endpoint - calls N8N webhook for actual calculations
app.post('/api/ai-analysis', async (req, res) => {
  try {
    const { notes, userId } = req.body;
    console.log('🤖 AI Analysis requested for user:', userId);
    
    if (!notes || !userId) {
      return res.status(400).json({ error: 'Notes and userId are required' });
    }
    
    // Call the N8N webhook for actual AI analysis
    console.log('📡 Calling N8N webhook with notes:', notes);
    const webhookResponse = await fetch('http://localhost:5678/webhook/L1pjiIxvYM6AIBoK', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: notes
      })
    });

    if (!webhookResponse.ok) {
      console.error('❌ N8N webhook failed:', webhookResponse.status, webhookResponse.statusText);
      throw new Error(`N8N webhook failed: ${webhookResponse.status}`);
    }

    const data = await webhookResponse.json();
    console.log('✅ N8N webhook response:', data);

    // Extract analysis from N8N response
    let analysis;
    if (typeof data === 'string') {
      analysis = data;
    } else if (data.data) {
      analysis = data.data;
    } else {
      // Try to find analysis in common response fields
      const possibleFields = ['output', 'result', 'response', 'message', 'analysis'];
      for (const field of possibleFields) {
        if (data[field]) {
          analysis = data[field];
          break;
        }
      }
      if (!analysis) {
        analysis = JSON.stringify(data);
      }
    }
    
    console.log('✅ AI Analysis generated for user:', userId, 'Analysis:', analysis);
    res.json({ analysis: analysis });
  } catch (error) {
    console.error('❌ Error generating AI analysis:', error);
    res.status(500).json({ error: 'Failed to generate AI analysis: ' + error.message });
  }
});

// =================== END WORKOUT ENDPOINTS ===================

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server successfully running on port ${port}`);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🎯 Listening on all interfaces (0.0.0.0)');
  console.log('🚀 Render deployment ready!');
  console.log('📊 Node.js version:', process.version);
  console.log('⚡ Express server initialized successfully');
}).on('error', (err) => {
  console.error('❌ Server startup error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`🚫 Port ${port} is already in use. Please try a different port or kill the process using this port.`);
    process.exit(1);
  } else {
    console.error('💥 Failed to start server:', err.message);
    console.error('📋 Error details:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 