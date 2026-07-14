import mongoose from "mongoose";

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];

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
    rank: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      enum: [...ROLES, ""],
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
        delete ret.passwordHash; // never leak this to the client
      },
    },
  }
);

export default mongoose.model("User", userSchema);