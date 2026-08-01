import mongoose from "mongoose";

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "invalid email format"],
    },
    passwordHash: {
      type: String,
      // Only local (email/password) accounts have one — Google accounts
      // authenticate entirely through the verified Google credential and
      // never set a password on this app.
      required: function () {
        return this.authProvider === "local";
      },
    },
    // Set only for accounts created via "Sign in with Google" — this is
    // Google's stable, unique subject ("sub") claim for that account, not
    // anything derived from the email (emails can change; this can't).
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    riotName: {
      type: String,
      required: true,
      trim: true,
    },
    riotTag: {
      type: String,
      required: true,
      trim: true,
    },
    // Derived automatically from riotName#riotTag via the HenrikDev API —
    // never accepted directly from the signup form.
    rank: {
      type: String,
      trim: true,
      default: "Unranked",
    },
    // Rank rating within the current tier (0-100) — same HenrikDev call as
    // `rank`, just also kept so same-rank players can be ordered on a
    // leaderboard instead of tying.
    rr: {
      type: Number,
      default: 0,
    },
    rankUpdatedAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: [...ROLES, ""],
      default: "",
    },
    region: {
      type: String,
      enum: [...REGIONS, ""],
      default: "",
    },
    lookingForTeam: {
      type: Boolean,
      default: true,
    },
    // Not settable via any signup/profile form — only ever changed by
    // editing the database directly. There's no self-service way to
    // become an admin, intentionally.
    isAdmin: {
      type: Boolean,
      default: false,
    },
    banned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      trim: true,
      default: "",
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    // Set only while a "forgot password" reset is in flight. We store a
    // hash of the token (never the raw token itself — same principle as
    // passwordHash) so a database leak alone can't be used to reset
    // someone's password; the raw token only ever exists in the emailed
    // link and briefly in memory on this server.
    resetPasswordTokenHash: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    // Google accounts are verified automatically at creation — Google
    // already confirmed the email is real before ever handing us a token
    // (see googleAuth.js's email_verified check). Local accounts start
    // unverified and get a link emailed at signup.
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verifyEmailTokenHash: {
      type: String,
      default: null,
    },
    verifyEmailExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.resetPasswordTokenHash;
        delete ret.resetPasswordExpires;
        delete ret.verifyEmailTokenHash;
        delete ret.verifyEmailExpires;
      },
    },
  }
);

// Case-insensitive uniqueness — "Kessu" and "kessu" count as the same
// username, same pattern as Team.js's name index.
userSchema.index({ username: 1 }, { collation: { locale: "en", strength: 2 }, unique: true });

export default mongoose.model("User", userSchema);