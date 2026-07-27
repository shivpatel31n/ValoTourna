import mongoose from "mongoose";

// One entrant slot in a match — either a team (from a team registration,
// identified by the shared Registration.teamId) or a solo player
// (identified by the User id). `null` means "not decided yet" (waiting on
// a previous match) or "bye" (see `isBye` on the match itself).
const entrantSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["team", "solo"], required: true },
    refId: { type: String, required: true }, // teamId (uuid) or user _id string
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true },

    // Single-elimination position: round 1 is the first round of real
    // matches. Within a round, matchIndex is 0-based left-to-right — the
    // winner of round R match `i` feeds into round R+1 match `floor(i/2)`,
    // as entrantA if `i` is even, entrantB if `i` is odd.
    round: { type: Number, required: true, min: 1 },
    matchIndex: { type: Number, required: true, min: 0 },

    entrantA: { type: entrantSchema, default: null },
    entrantB: { type: entrantSchema, default: null },

    scoreA: { type: Number, default: 0 },
    scoreB: { type: Number, default: 0 },

    // "A" or "B" once decided. For a bye, winner is set immediately to
    // whichever slot was filled.
    winner: { type: String, enum: ["A", "B", null], default: null },
    isBye: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["pending", "ready", "completed"],
      default: "pending",
      // pending: waiting on one or both feeder matches
      // ready: both entrants known, awaiting a reported result
      // completed: winner decided (either reported or a bye)
    },
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

matchSchema.index({ tournament: 1, round: 1, matchIndex: 1 }, { unique: true });

export default mongoose.model("Match", matchSchema);