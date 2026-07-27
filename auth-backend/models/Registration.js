import mongoose from "mongoose";

// A request from a player asking to join a captain's team roster for this
// tournament. Only ever populated on the captain's own Registration doc.
const joinRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true, default: "" },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["solo", "team"], required: true },
    displayName: { type: String, trim: true, default: "" },
    teamName: { type: String, trim: true, default: "" },
    teamId: { type: String, default: null }, // shared across all members of one team
    isCaptain: { type: Boolean, default: false },
    status: { type: String, enum: ["confirmed", "pending"], default: "confirmed" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    members: { type: [String], default: [] }, // kept for backward compat / display only
    // Only meaningful on the captain's registration doc: whether this team
    // is open to unsolicited join requests from other players, and the
    // queue of requests waiting on the captain's decision.
    recruiting: { type: Boolean, default: true },
    pendingRequests: { type: [joinRequestSchema], default: [] },
    joinedAt: { type: Date, default: Date.now },
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

registrationSchema.index({ tournament: 1, user: 1 }, { unique: true });

export default mongoose.model("Registration", registrationSchema);