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
      required: true,
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
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
      },
    },
  }
);

export default mongoose.model("User", userSchema);