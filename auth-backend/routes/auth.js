import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { fetchRiotRank } from "../services/riotRank.js";
import { verifyGoogleCredential } from "../services/googleAuth.js";

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function userPayload(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    riotName: user.riotName,
    riotTag: user.riotTag,
    region: user.region,
    rank: user.rank,
    role: user.role,
    isAdmin: user.isAdmin,
    authProvider: user.authProvider,
  };
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
      authProvider: "local",
      riotName: riotName.trim(),
      riotTag: riotTag.trim().replace(/^#/, ""),
      region,
      rank,
      rr,
      rankUpdatedAt: new Date(),
      role: role || "",
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: userPayload(user) });
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

    if (user.authProvider === "google") {
      return res.status(400).json({
        message: "This account uses Google sign-in — use the \"Continue with Google\" button instead.",
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = signToken(user);
    return res.json({ token, user: userPayload(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong during login." });
  }
});

// POST /api/auth/google — "Sign in with Google" for an existing account.
// Receives the ID token credential from Google Identity Services on the
// frontend and verifies it server-side; nothing about the login is ever
// trusted from the client beyond that token.
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential." });
    }

    let googleId, email, name;
    try {
      ({ googleId, email, name } = await verifyGoogleCredential(credential));
    } catch (verifyErr) {
      return res.status(400).json({ message: verifyErr.message });
    }

    let user = await User.findOne({ googleId });

    if (!user) {
      // Same email already registered the normal way — link this Google
      // identity to that existing account rather than creating a duplicate.
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        await user.save();
      }
    }

    if (!user) {
      // Genuinely new — Google alone doesn't give us a Riot ID or username,
      // so hand back the essentials the frontend needs to collect those
      // and finish signup via /google/complete-profile.
      return res.status(200).json({ needsProfile: true, email, suggestedUsername: name.replace(/\s+/g, "") });
    }

    const token = signToken(user);
    return res.json({ token, user: userPayload(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong during Google sign-in." });
  }
});

// POST /api/auth/google/complete-profile — finishes account creation for a
// first-time Google sign-in once the frontend has collected the extra
// fields Google doesn't provide (username, Riot ID, role).
router.post("/google/complete-profile", async (req, res) => {
  try {
    const { credential, username, riotName, riotTag, role } = req.body;

    if (!credential || !username || !riotName || !riotTag) {
      return res.status(400).json({
        message: "Username and Riot ID (name + tagline) are required.",
      });
    }

    let googleId, email;
    try {
      ({ googleId, email } = await verifyGoogleCredential(credential));
    } catch (verifyErr) {
      return res.status(400).json({ message: verifyErr.message });
    }

    // Guard against a double-submit or the account having been created via
    // /google in the meantime.
    const existing = await User.findOne({ $or: [{ googleId }, { email }] });
    if (existing) {
      const token = signToken(existing);
      return res.json({ token, user: userPayload(existing) });
    }

    let rank, region, rr;
    try {
      ({ rank, region, rr } = await fetchRiotRank(riotName, riotTag));
    } catch (riotErr) {
      return res.status(400).json({ message: riotErr.message });
    }

    const user = await User.create({
      username,
      email,
      authProvider: "google",
      googleId,
      riotName: riotName.trim(),
      riotTag: riotTag.trim().replace(/^#/, ""),
      region,
      rank,
      rr,
      rankUpdatedAt: new Date(),
      role: role || "",
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: userPayload(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "An account with that email or username already exists." });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: "Something went wrong completing your profile." });
  }
});

export default router;