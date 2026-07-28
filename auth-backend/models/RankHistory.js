import mongoose from "mongoose";

// One snapshot per user per nightly rank-refresh run. This is populated
// entirely from data the refresh job already fetches — it costs zero extra
// HenrikDev calls, and is what lets the leaderboard offer a "climbing"
// sort (RR gained over the last N days) instead of just current rank.
const rankHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rank: { type: String, required: true },
    rr: { type: Number, default: 0 },
    // Composite value combining tier + in-tier RR into one comparable
    // number (rankIndex * 100 + rr), so a climb across a tier boundary
    // (e.g. Gold 3 -> Platinum 1) still shows up as forward progress
    // instead of looking like a drop back to low RR.
    rating: { type: Number, required: true },
    capturedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

rankHistorySchema.index({ user: 1, capturedAt: -1 });

export default mongoose.model("RankHistory", rankHistorySchema);