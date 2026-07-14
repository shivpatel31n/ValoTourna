import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import ClutchCircuit from "./ClutchCircuit";
import AuthPage from "./AuthPage";
import PlayersPage from "./PlayersPage";

function App() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  // Restore login from localStorage on page load/refresh
  useEffect(() => {
    const token = localStorage.getItem("cc_token");
    const savedUser = localStorage.getItem("cc_user");
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("cc_token");
    localStorage.removeItem("cc_user");
    setUser(null);
  }

  function handleAuthSuccess(loggedInUser) {
    setUser(loggedInUser);
    setShowAuth(false);
  }

  // Called by the "Profile" button in the navbar
  function handleProfileClick() {
    if (!user) {
      setShowAuth(true);
    }
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <ClutchCircuit
              user={user}
              onLogout={handleLogout}
              onProfileClick={handleProfileClick}
            />
          }
        />
        <Route path="/players" element={<PlayersPage />} />
      </Routes>

      {showAuth && (
        <AuthPage
          onAuthSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
        />
      )}
    </>
  );
}

export default App;