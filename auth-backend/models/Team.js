import mongoose from "mongoose";

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: [...ROLES, ""], default: "" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const joinRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true, default: "" },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tag: { type: String, trim: true, uppercase: true, maxlength: 5, default: "" },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [memberSchema], default: [] }, // captain is NOT duplicated here
    region: { type: String, enum: REGIONS, required: true },
    rolesNeeded: { type: [String], enum: ROLES, default: [] },
    schedule: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    maxSize: { type: Number, min: 1, max: 10, default: 5 },
    recruiting: { type: Boolean, default: true },
    pendingRequests: { type: [joinRequestSchema], default: [] },
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

teamSchema.index({ name: 1 }, { collation: { locale: "en", strength: 2 }, unique: true });

export default mongoose.model("Team", teamSchema);