import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },

  lastName: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: true,
  },

  participantType: {
    type: String,
    enum: ["iiit", "non-iiit"],
    required: true,
  },

  contactNumber: {
    type: String,
    default: null,
  },

  collegeName: {
    type: String,
    default: null,
  },

  areasOfInterest: {
    type: [String],
    default: [],
  },

  followedClubs: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer"
    }],
    default: []
  },

  role: {
    type: String,
    enum: ["participant", "organizer", "admin"],
    default: "participant",
  },
},
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
