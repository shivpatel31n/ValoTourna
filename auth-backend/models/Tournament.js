import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ["upcoming", "live", "past"], default: "upcoming" },
    format: { type: String, trim: true, default: "" },
    teamSize: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    regDeadline: { type: Date, required: true },
    endDate: { type: Date, default: null },
    maxTeams: { type: Number, required: true, min: 1 },
    prizePool: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    rules: { type: [String], default: [] },
    champion: { type: String, default: null },
    runnerUp: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret.slug; // frontend routes/keys off `id`, which is the slug
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

export default mongoose.model("Tournament", tournamentSchema);