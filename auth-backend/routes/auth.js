import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { fetchRiotRank } from "../services/riotRank.js";

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, riotName, riotTag, role } = req.body;

    if (!username || !email || !password || !riotName || !riotTag) {
      return res.status(400).json({
        message: "Username, email, password, and Riot ID (name + tagline) are required.",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }

    // Look up the player's current rank (and region) from their Riot ID
    // instead of trusting a self-reported value.
    let rank, region, rr;
    try {
      ({ rank, region, rr } = await fetchRiotRank(riotName, riotTag));
    } catch (riotErr) {
      return res.status(400).json({ message: riotErr.message });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash,
      riotName: riotName.trim(),
      riotTag: riotTag.trim().replace(/^#/, ""),
      region,
      rank,
      rr,
      rankUpdatedAt: new Date(),
      role: role || "",
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        riotName: user.riotName,
        riotTag: user.riotTag,
        region: user.region,
        rank: user.rank,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: "Something went wrong during signup." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        riotName: user.riotName,
        riotTag: user.riotTag,
        region: user.region,
        rank: user.rank,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong during login." });
  }
});

export default router;