import mongoose from "mongoose";

const organizerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
  },

  category: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    default: "",
  },

  contactEmail: {
    type: String,
    required: true,
  },

  contactNumber: {
    type: String,
    default: null,
  },

  discordWebhookUrl: {
    type: String,
    default: "",
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  isArchived: {
    type: Boolean,
    default: false,
  },
},
  { timestamps: true }
);

export default mongoose.model("Organizer", organizerSchema);
