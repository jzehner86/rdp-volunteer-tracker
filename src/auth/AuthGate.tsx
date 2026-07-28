import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, signInWithRedirect, signOut, type AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

type Status = 'checking' | 'signed-out' | 'signed-in' | 'rejected';

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
    return <p>Loading…</p>;
  }

  if (status === 'signed-in' && user) {
    return <>{children(user, () => void signOut())}</>;
  }

  return (
    <div className="auth-screen">
      <h1>RDP Volunteer Tracker</h1>
      {status === 'rejected' && rejectionMessage && (
        <p role="alert" className="auth-error">
          {rejectionMessage}
        </p>
      )}
      <p>Sign in with your @rochester-downtown.com Google Workspace account.</p>
      <button type="button" onClick={() => void signInWithRedirect({ provider: 'Google' })}>
        Continue with Google
      </button>
    </div>
  );
}
