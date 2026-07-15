import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["solo", "team"], required: true },
    displayName: { type: String, trim: true, default: "" },
    teamName: { type: String, trim: true, default: "" },
    members: { type: [String], default: [] },
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

// one registration per user per tournament
registrationSchema.index({ tournament: 1, user: 1 }, { unique: true });

export default mongoose.model("Registration", registrationSchema);