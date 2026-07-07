import { useState, useEffect } from "react";
import ClutchCircuit from "./ClutchCircuit";
import AuthPage from "./AuthPage";

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
    // If user IS logged in, ClutchCircuit can show account info / dropdown instead —
    // handled inside ClutchCircuit itself using the `user` prop.
  }

  return (
    <>
      <ClutchCircuit
        user={user}
        onLogout={handleLogout}
        onProfileClick={handleProfileClick}
      />

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