import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, username }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
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