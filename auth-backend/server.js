import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import playerRoutes from "./routes/players.js";
import tournamentRoutes from "./routes/tournaments.js";
import teamRoutes from "./routes/teams.js";
import scrimRoutes from "./routes/scrims.js";
import notificationRoutes from "./routes/notifications.js";
import statsRoutes from "./routes/stats.js";
import adminRoutes from "./routes/admin.js";
import { scheduleRankRefresh } from "./services/rankRefreshJob.js";
import { requireAuth } from "./middleware/authMiddleware.js";
import User from "./models/User.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/scrims", scrimRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);

// Refetches the full user from the DB rather than trusting the JWT payload
// (which only carries {id, email, username}) — otherwise fields like
// isAdmin that aren't in the token would silently disappear from the
// frontend's user state on every refresh.
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load user." });
  }
});

app.get("/", (req, res) => {
  res.send("Clutch Circuit auth API is running.");
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Auth server running on http://localhost:${PORT}`);
  });
  scheduleRankRefresh();
});