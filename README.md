# 🏋️ Fitness Tracker Pro

A full-stack fitness tracking web application with premium AI-powered workout analysis, built with React, Node.js, Supabase, and Stripe.

## ✨ Features

### Core Features
- **Workout Tracking**: Log workouts with type, duration, calories, and notes
- **User Authentication**: Secure sign-up/sign-in with Supabase Auth
- **Real-time Data**: Automatic workout synchronization across sessions
- **Chronological History**: Workouts displayed newest-first with proper sorting

### Premium Features (Subscription Required)
- **AI Workout Analysis**: Intelligent analysis of workout notes using n8n webhooks
- **Subscription Management**: Monthly ($9.99) and Yearly ($100) plans via Stripe
- **Subscription Details**: View current plan and renewal dates
- **Automatic Cancellation**: Seamless subscription management with error recovery

### Security & User Experience
- **User Isolation**: Complete data separation between users
- **Subscription Security**: AI analysis blocked for non-premium users
- **Error Recovery**: Automatic handling of subscription issues
- **Clean UI**: Professional interface with responsive design

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Supabase Client** for authentication and real-time data

### Backend
- **Node.js** with Express
- **Stripe** for payment processing
- **Supabase** for database and authentication
- **n8n** for AI workflow integration

### Database
- **PostgreSQL** (via Supabase)
- Real-time subscriptions for live updates

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Supabase account
- Stripe account (for payments)
- n8n instance (for AI features)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/fitness-tracker-pro.git
cd fitness-tracker-pro
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
cd fitness-tracker
npm install

# Install backend dependencies
cd ../server
npm install
```

### 3. Environment Setup

#### Frontend (.env in fitness-tracker/)
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend (.env in server/)
```env
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=http://localhost:3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
N8N_WEBHOOK_URL=your_n8n_webhook_url
```

### 4. Database Setup
Run the SQL migration in your Supabase dashboard:
```sql
-- See supabase/migrations/create_tables.sql for the complete schema
```

### 5. Stripe Setup
1. Create products in Stripe Dashboard:
   - Monthly Plan: $9.99/month
   - Yearly Plan: $100/year
2. Update price IDs in the code
3. Set up webhook endpoints for subscription events

### 6. Run the Application
```bash
# Terminal 1: Start the backend server
cd server
npm start

# Terminal 2: Start the frontend
cd fitness-tracker  
npm start
```

The app will be available at `http://localhost:3000`

## 📁 Project Structure

```
fitness-tracker-pro/
├── fitness-tracker/          # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── contexts/         # React contexts (Auth)
│   │   ├── services/         # API services (Stripe, Supabase)
│   │   ├── types/           # TypeScript type definitions
│   │   └── lib/             # Utility libraries
│   └── public/              # Static assets
├── server/                  # Node.js backend
│   ├── index.js            # Express server
│   └── package.json        # Backend dependencies
├── supabase/               # Database migrations
│   └── migrations/         # SQL migration files
└── README.md              # This file
```

## 🔧 Configuration

### Supabase Configuration
1. Create a new Supabase project
2. Run the database migrations
3. Configure Row Level Security (RLS) policies
4. Set up authentication providers

### Stripe Configuration
1. Create webhook endpoints:
   - `POST /webhook/stripe` for subscription events
2. Configure product catalog:
   - Monthly subscription ($9.99)
   - Yearly subscription ($100)
3. Set up customer portal for subscription management

### n8n Configuration (Optional - for AI features)
1. Set up n8n workflow for workout analysis
2. Configure webhook trigger
3. Integrate with your preferred AI service (OpenAI, etc.)

## 🚢 Deployment

### Frontend (Vercel/Netlify)
```bash
cd fitness-tracker
npm run build
# Deploy the build/ folder
```

### Backend (Railway/Heroku)
```bash
cd server
# Set environment variables in your hosting platform
# Deploy with Node.js buildpack
```

### Environment Variables for Production
Ensure all environment variables are set in your hosting platform:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLIENT_URL` (your frontend URL)
- `N8N_WEBHOOK_URL`

## 🔐 Security Features

- **User Data Isolation**: Each user can only access their own workouts
- **Subscription Validation**: AI features locked behind subscription checks
- **Secure API Keys**: All sensitive keys stored in environment variables
- **CORS Protection**: Configured for your frontend domain only
- **Input Validation**: All user inputs validated and sanitized

## 📊 Key Features Implemented

### User Management
- ✅ Secure authentication with Supabase
- ✅ User session persistence
- ✅ Data isolation between users
- ✅ Automatic cleanup on user changes

### Workout Tracking
- ✅ CRUD operations for workouts
- ✅ Real-time synchronization
- ✅ Chronological sorting (newest first)
- ✅ Rich workout data (type, duration, calories, notes)

### Subscription System
- ✅ Stripe integration with checkout
- ✅ Monthly and yearly plans
- ✅ Subscription status checking
- ✅ Customer portal integration
- ✅ Automatic error recovery
- ✅ Plan details display with end dates

### Premium Features
- ✅ AI-powered workout analysis
- ✅ Subscription-gated features
- ✅ Premium user experience
- ✅ Seamless upgrade flow

## 🐛 Troubleshooting

### Common Issues

**"Port already in use" errors:**
```bash
# Kill processes on ports 3000/3001
npx kill-port 3000
npx kill-port 3001
```

**Subscription status not updating:**
- Check Stripe webhook configuration
- Verify environment variables
- Check browser console for errors

**AI analysis not working:**
- Verify n8n webhook URL
- Check subscription status
- Ensure user has premium access

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Database powered by [Supabase](https://supabase.com/)
- Payments by [Stripe](https://stripe.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- AI workflows by [n8n](https://n8n.io/)

---

**⚠️ Important Security Note**: Never commit your `.env` files or API keys to version control. The `.gitignore` file is configured to prevent this, but always double-check before pushing to GitHub. 