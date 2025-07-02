import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

export const Auth = () => {
  return (
    <div className="auth-container">
      <h1>Fitness Tracker</h1>
      <div className="auth-box">
        <SupabaseAuth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            style: {
              button: { background: '#61dafb', color: '#282c34' },
              anchor: { color: '#61dafb' },
            },
          }}
          theme="dark"
          providers={[]}
          redirectTo={window.location.origin}
        />
      </div>
    </div>
  );
}; 