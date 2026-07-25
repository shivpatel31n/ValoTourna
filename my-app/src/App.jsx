import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import ClutchCircuit from "./ClutchCircuit.jsx";
import AuthPage from "./AuthPage.jsx";
import PlayersPage from "./PlayersPage";
import TeamsPage from "./TeamsPage.jsx";
import TeamCreatePage from "./TeamCreatePage.jsx";
import TeamDetailPage from "./TeamDetailPage.jsx";
import ScrimsPage from "./ScrimsPage.jsx";
import ScrimPostPage from "./ScrimPostPage.jsx";
import ScrimDetailPage from "./ScrimDetailPage.jsx";
import TournamentsPage from "./TournamentsPage.jsx";
import TournamentDetailPage from "./TournamentDetailPage.jsx";
import AdminTournamentsPage from "./AdminTournamentsPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import NotificationBell from "./NotificationBell.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("cc_token");
    if (!token) return;

    // Refetch from the backend instead of trusting the cached localStorage
    // snapshot — that cache only reflects whatever was true at login time,
    // so any change made directly in the DB (or by another session) would
    // otherwise never show up until the user logged out and back in.
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        localStorage.setItem("cc_user", JSON.stringify(data.user));
      })
      .catch(() => {
        // Token invalid/expired, or user no longer exists — clear the stale session.
        localStorage.removeItem("cc_token");
        localStorage.removeItem("cc_user");
      });
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
              onRequireAuth={() => setShowAuth(true)}
            />
          }
        />
        <Route path="/players" element={<PlayersPage />} />
        <Route
          path="/teams"
          element={<TeamsPage user={user} onRequireAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/teams/new"
          element={<TeamCreatePage user={user} onRequireAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/teams/:id"
          element={<TeamDetailPage user={user} onRequireAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/scrims"
          element={<ScrimsPage user={user} onRequireAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/scrims/new"
          element={<ScrimPostPage user={user} onRequireAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/scrims/:id"
          element={<ScrimDetailPage user={user} onRequireAuth={() => setShowAuth(true)} />}
        />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/admin/tournaments" element={<AdminTournamentsPage user={user} />} />
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

      <NotificationBell user={user} />
    </>
  );
}

export default App;