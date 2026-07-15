import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import ClutchCircuit from "./ClutchCircuit.jsx";
import AuthPage from "./AuthPage.jsx";
import PlayersPage from "./PlayersPage";
import TournamentsPage from "./TournamentsPage.jsx";
import TournamentDetailPage from "./TournamentDetailPage.jsx";
import ProfilePage from "./ProfilePage.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

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
  // function handleProfileClick() {
  //   if (!user) {
  //     setShowAuth(true);
  //   } else {
  //     navigate("/profile");
  //   }
  // }

  function handleProfileClick() {
    navigate("/profile");
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
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournaments/:id" element={<TournamentDetailPage user={user} />} />
        <Route
          path="/profile"
          element={<ProfilePage user={user} onRequireAuth={() => setShowAuth(true)} onLogout={handleLogout} />}
        />
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