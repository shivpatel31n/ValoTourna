import mongoose from "mongoose";

// Same ordered rank list used across the app (PlayersPage.jsx) — order
// matters here since we use array index to check whether a rank falls
// inside a posted min/max range.
export const RANK_ORDER = [
  "Iron 1", "Iron 2", "Iron 3",
  "Bronze 1", "Bronze 2", "Bronze 3",
  "Silver 1", "Silver 2", "Silver 3",
  "Gold 1", "Gold 2", "Gold 3",
  "Platinum 1", "Platinum 2", "Platinum 3",
  "Diamond 1", "Diamond 2", "Diamond 3",
  "Ascendant 1", "Ascendant 2", "Ascendant 3",
  "Immortal 1", "Immortal 2", "Immortal 3",
  "Radiant",
];

const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

// A challenge from another team wanting to take this scrim slot.
const challengeSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true, default: "" },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scrimRequestSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    region: { type: String, enum: REGIONS, required: true },
    minRank: { type: String, enum: RANK_ORDER, required: true },
    maxRank: { type: String, enum: RANK_ORDER, required: true },
    availability: { type: String, trim: true, required: true },
    notes: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["open", "matched", "cancelled"], default: "open" },
    matchedWith: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    requests: { type: [challengeSchema], default: [] },
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

scrimRequestSchema.index({ team: 1, status: 1 });
scrimRequestSchema.index({ region: 1, status: 1 });

export default mongoose.model("ScrimRequest", scrimRequestSchema);