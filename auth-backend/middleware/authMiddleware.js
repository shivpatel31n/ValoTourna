import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Checked fresh on every request (not just at login) so a ban takes
    // effect immediately instead of waiting up to JWT_EXPIRES_IN for the
    // token to expire on its own.
    const user = await User.findById(decoded.id).select("banned banReason");
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    if (user.banned) {
      return res.status(403).json({
        message: user.banReason
          ? `Your account has been suspended: ${user.banReason}`
          : "Your account has been suspended.",
      });
    }

    req.user = decoded; // { id, email, username }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

// For public routes that still need to know who's asking (e.g. to decide
// how much of a team roster to show them) without forcing a login. Sets
// req.user when a valid token is present, otherwise leaves it undefined —
// never rejects the request either way.
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Invalid/expired token on a public route — treat as anonymous rather
    // than blocking the request.
  }
  next();
}

// Must run after requireAuth. Looks up isAdmin fresh from the database on
// every request rather than trusting the JWT, so revoking admin access
// takes effect immediately instead of waiting for the token to expire.
export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("isAdmin");
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required." });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify admin access." });
  }
}