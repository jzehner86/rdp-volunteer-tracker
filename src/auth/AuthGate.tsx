import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, signInWithRedirect, signOut, type AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

type Status = 'checking' | 'signed-out' | 'signed-in' | 'rejected';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AuthGate({ children }: { children: (user: AuthUser, signOut: () => void) => ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          void refreshUser();
          break;
        case 'signedOut':
          setStatus('signed-out');
          setUser(null);
          break;
        case 'signInWithRedirect_failure': {
          // Thrown by the preSignUp/preTokenGeneration Cognito triggers for
          // any account outside the rochester-downtown.com Workspace domain.
          setStatus('rejected');
          setRejectionMessage(
            'Access is restricted to Rochester Downtown Google Workspace accounts.',
          );
          break;
        }
      }
    });

    void refreshUser();
    return unsubscribe;
  }, []);

  async function refreshUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setStatus('signed-in');
    } catch {
      setStatus('signed-out');
    }
  }

  if (status === 'checking') {
    return (
      <main>
        <div className="state-message">
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  if (status === 'signed-in' && user) {
    return <>{children(user, () => void signOut())}</>;
  }

  return (
    <main>
      <div className="auth-screen">
        <div className="card auth-card">
          <div className="brand-mark">RDP</div>
          <h1>Volunteer Tracker</h1>
          <p>Sign in with your @rochester-downtown.com Google Workspace account.</p>
          {status === 'rejected' && rejectionMessage && (
            <div className="alert alert-error" role="alert">
              {rejectionMessage}
            </div>
          )}
          <button
            type="button"
            className="google-btn"
            onClick={() => void signInWithRedirect({ provider: 'Google' })}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}
