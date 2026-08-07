import mongoose from "mongoose";

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

// ------------------------------------------------------------------
// SUB-SCHEMAS
// ------------------------------------------------------------------

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: [...ROLES, ""], default: "" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false } // Prevents Mongoose from generating a distinct _id for each array item
);

const joinRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true, default: "" },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ------------------------------------------------------------------
// MAIN TEAM SCHEMA
// ------------------------------------------------------------------

const teamSchema = new mongoose.Schema(
  {
    // Basic Info
    name: { type: String, required: true, trim: true },
    tag: { type: String, trim: true, uppercase: true, maxlength: 5, default: "" },
    
    // Roster (Captain is NOT duplicated in the members array)
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [memberSchema], default: [] }, 
    
    // Team Attributes
    region: { type: String, enum: REGIONS, required: true },
    rolesNeeded: { type: [String], enum: ROLES, default: [] },
    schedule: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    maxSize: { type: Number, min: 1, max: 10, default: 5 },
    
    // Recruitment
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

// ------------------------------------------------------------------
// INDEXES
// ------------------------------------------------------------------

// Case-insensitive uniqueness — "Cloud9" and "cloud9" count as the same name
teamSchema.index(
  { name: 1 }, 
  { collation: { locale: "en", strength: 2 }, unique: true }
);

export default mongoose.model("Team", teamSchema);