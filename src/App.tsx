import './amplify-config';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AuthGate } from './auth/AuthGate';
import { EventPicker } from './pages/EventPicker';
import { Reports } from './pages/Reports';

function AppHeader({ onSignOut }: { onSignOut: () => void }) {
  const location = useLocation();
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">RDP</div>
        <div>
          <h1>Volunteer Tracker</h1>
          <p className="brand-subtitle">Rochester Downtown Partnership</p>
        </div>
      </div>
      <nav>
        <Link to="/" className={location.pathname === '/' ? 'active' : undefined}>
          Log hours
        </Link>
        <Link to="/reports" className={location.pathname === '/reports' ? 'active' : undefined}>
          Reports
        </Link>
      </nav>
      <button type="button" className="btn btn-ghost" onClick={onSignOut}>
        Sign out
      </button>
    </header>
  );
}

function App() {
  return (
    <AuthGate>
      {(user, handleSignOut) => (
        <BrowserRouter>
          <main>
            <AppHeader onSignOut={handleSignOut} />
            <Routes>
              <Route path="/" element={<EventPicker user={user} />} />
              <Route path="/reports" element={<Reports />} />
            </Routes>
          </main>
        </BrowserRouter>
      )}
    </AuthGate>
  );
}

export default App;
