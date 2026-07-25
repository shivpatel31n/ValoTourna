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

// Example protected route — only reachable with a valid JWT
app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user }); // toJSON transform on the model strips passwordHash automatically
});

app.get("/", (req, res) => {
  res.send("Clutch Circuit auth API is running.");
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Auth server running on http://localhost:${PORT}`);
  });
});