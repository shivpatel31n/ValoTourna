import mongoose from "mongoose";

// Unlike the pending-action counts in /api/notifications/summary (which are
// recomputed live from current state), these are point-in-time events that
// need to be recorded when they happen — once a request is accepted or
// rejected, there's nothing "pending" left to derive that outcome from
// later, so it has to be written down here at the moment it occurs.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "team_join_accepted",
        "team_join_rejected",
        "tournament_join_accepted",
        "tournament_join_rejected",
        "scrim_matched",
        "scrim_rejected",
      ],
      required: true,
    },
    message: { type: String, required: true },
    // Frontend route to send them to when they click it, e.g. "/teams/abc123"
    link: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);