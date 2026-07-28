import './amplify-config';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthGate } from './auth/AuthGate';
import { EventPicker } from './pages/EventPicker';
import { Reports } from './pages/Reports';

function App() {
  return (
    <AuthGate>
      {(user, handleSignOut) => (
        <BrowserRouter>
          <main>
            <header className="app-header">
              <h1>RDP Volunteer Tracker</h1>
              <nav>
                <Link to="/">Log hours</Link>
                <Link to="/reports">Reports</Link>
              </nav>
              <button type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </header>

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
