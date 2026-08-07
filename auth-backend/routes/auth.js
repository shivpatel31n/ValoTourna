import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Models & Services
import User from "../models/User.js";
import { fetchRiotRank } from "../services/riotRank.js";
import { verifyGoogleCredential } from "../services/googleAuth.js";
import { sendMail } from "../services/mailer.js";

// Middleware
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function bannedMessage(user) {
  return user.banReason
    ? `Your account has been suspended: ${user.banReason}`
    : "Your account has been suspended.";
}

// Generates a fresh verification token for `user`, saves its hash, and
// emails the link. Best-effort by design — unlike the password-reset flow,
// a failed send here shouldn't undo account creation; the user can always
// hit "resend" from their profile once the mail issue is sorted out.
async function issueVerificationEmail(user) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  user.verifyEmailTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.verifyEmailExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

  try {
    await sendMail(
      user.email,
      "Verify your ClutchCircuit email",
      `<p>Welcome to ClutchCircuit! Confirm this is your email address to finish setting up your account.</p>
       <p><a href="${verifyUrl}">Verify email address</a> — this link expires in 24 hours.</p>
       <p>If you didn't create this account, you can ignore this email.</p>`,
      `Welcome to ClutchCircuit! Confirm this is your email address to finish setting up your account.\n\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`
    );
  } catch (mailErr) {
    console.error(`[verify-email] Failed to send to ${user.email}:`, mailErr.message);
  }
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
    emailVerified: user.emailVerified,
  };
}

// ------------------------------------------------------------------
// LOCAL AUTHENTICATION ROUTES
// ------------------------------------------------------------------

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
    issueVerificationEmail(user).catch((err) => console.error("[signup] Verification email failed:", err.message));
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

    if (user.banned) {
      return res.status(403).json({ message: bannedMessage(user) });
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

// ------------------------------------------------------------------
// GOOGLE AUTHENTICATION ROUTES
// ------------------------------------------------------------------

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
        user.emailVerified = true;
        await user.save();
      }
    }

    if (!user) {
      // Genuinely new — Google alone doesn't give us a Riot ID or username,
      // so hand back the essentials the frontend needs to collect those
      // and finish signup via /google/complete-profile.
      return res.status(200).json({ needsProfile: true, email, suggestedUsername: name.replace(/\s+/g, "") });
    }

    if (user.banned) {
      return res.status(403).json({ message: bannedMessage(user) });
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
      emailVerified: true,
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

// ------------------------------------------------------------------
// PASSWORD MANAGEMENT ROUTES
// ------------------------------------------------------------------

// POST /api/auth/forgot-password — always responds the same way regardless
// of whether the email exists, so this can't be used to probe which
// addresses are registered.
router.post("/forgot-password", async (req, res) => {
  const genericResponse = {
    message: "If an account exists for that email, we've sent a reset link.",
  };

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(200).json(genericResponse);

    if (user.authProvider === "google") {
      // Nothing to reset — but stay quiet on why, beyond a helpful nudge
      // in the email itself, so we don't confirm account existence/type
      // through the API response.
      await sendMail(
        user.email,
        "About your ClutchCircuit sign-in",
        `<p>Someone requested a password reset for this email on ClutchCircuit, but this account signs in with Google.</p>
         <p>Use the "Continue with Google" button on the login page instead — there's no password to reset.</p>
         <p>If this wasn't you, you can safely ignore this email.</p>`,
        `Someone requested a password reset for this email on ClutchCircuit, but this account signs in with Google.\n\nUse the "Continue with Google" button on the login page instead — there's no password to reset.\n\nIf this wasn't you, you can safely ignore this email.`
      ).catch((err) => console.error("[forgot-password] Failed to send Google-account notice:", err.message));
      
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendMail(
        user.email,
        "Reset your ClutchCircuit password",
        `<p>Someone requested a password reset for this account.</p>
         <p><a href="${resetUrl}">Set a new password</a> — this link expires in 1 hour.</p>
         <p>If this wasn't you, you can safely ignore this email; your password won't change unless you use the link above.</p>`,
        `Someone requested a password reset for this account.\n\n${resetUrl}\n\nThis link expires in 1 hour. If this wasn't you, you can safely ignore this email; your password won't change unless you use the link above.`
      );
    } catch (mailErr) {
      // Don't leave a dangling reset token if we couldn't actually tell
      // them about it.
      user.resetPasswordTokenHash = null;
      user.resetPasswordExpires = null;
      await user.save();
      console.error("[forgot-password] Failed to send reset email:", mailErr.message);
      return res.status(500).json({ message: "Couldn't send the reset email — please try again shortly." });
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

// POST /api/auth/reset-password — completes a reset started above
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (
      !user ||
      !user.resetPasswordTokenHash ||
      user.resetPasswordTokenHash !== tokenHash ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      return res.status(400).json({ message: "That reset link is invalid or has expired." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: "Password updated — you can log in now." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

// POST /api/auth/change-password — for a logged-in user changing their own
// password (not the same flow as a forgotten one; this requires knowing
// the current password).
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are both required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.authProvider === "google") {
      return res.status(400).json({
        message: "This account uses Google sign-in and doesn't have a password to change.",
      });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password changed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

// ------------------------------------------------------------------
// EMAIL VERIFICATION ROUTES
// ------------------------------------------------------------------

// POST /api/auth/verify-email — completes verification via the emailed link
router.post("/verify-email", async (req, res) => {
  try {
    const { email, token } = req.body;
    
    if (!email || !token) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (user && user.emailVerified) {
      return res.status(200).json({ message: "Email already verified." });
    }

    if (
      !user ||
      !user.verifyEmailTokenHash ||
      user.verifyEmailTokenHash !== tokenHash ||
      !user.verifyEmailExpires ||
      user.verifyEmailExpires < new Date()
    ) {
      return res.status(400).json({ message: "That verification link is invalid or has expired." });
    }

    user.emailVerified = true;
    user.verifyEmailTokenHash = null;
    user.verifyEmailExpires = null;
    await user.save();

    return res.status(200).json({ message: "Email verified." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

// POST /api/auth/resend-verification — for a logged-in user with an
// unverified local account
router.post("/resend-verification", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.emailVerified) {
      return res.status(200).json({ message: "Your email is already verified." });
    }
    if (user.authProvider === "google") {
      return res.status(200).json({ message: "Google accounts are already verified." });
    }

    await issueVerificationEmail(user);
    return res.status(200).json({ message: "Verification email sent." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Couldn't send the verification email — please try again shortly." });
  }
});

export default router;