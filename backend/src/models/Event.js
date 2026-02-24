import mongoose from "mongoose";

const formFieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  fieldType: {
    type: String,
    enum: ["text", "textarea", "dropdown", "checkbox", "file"],
    required: true,
  },
  options: { type: [String], default: [] }, // for dropdown/checkbox
  required: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { _id: true });

// Each merchandise item is like a dropdown form field.
// Options represent variants (e.g. "Red T-Shirt M — ₹500").
// Each option has its own label, price, and stock.
// The item can be required (must select) or optional (can skip).
const merchOptionSchema = new mongoose.Schema({
  label: { type: String, required: true },   // e.g. "Red - M", "Blue - L"
  price: { type: Number, required: true, default: 0 },
  stock: { type: Number, required: true, default: 0 },
}, { _id: true });

const merchandiseItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },  // e.g. "T-Shirt", "Hoodie"
  required: { type: Boolean, default: false },  // must select an option?
  options: { type: [merchOptionSchema], default: [] },
  order: { type: Number, default: 0 },
}, { _id: true });

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

  eventType: {
    type: String,
    enum: ["normal", "merchandise"],
    required: true,
  },

  eligibility: {
    type: String,
    enum: ["iiit", "non-iiit", "all"],
    default: "all",
  },

  registrationDeadline: {
    type: Date,
    required: false,
  },

  startDate: {
    type: Date,
    required: true,
  },

  endDate: {
    type: Date,
    required: true,
  },

  registrationLimit: {
    type: Number,
    required: true,
  },

  registrationFee: {
    type: Number,
    default: 0,
  },

  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organizer",
    required: true,
  },

  tags: {
    type: [String],
    default: [],
  },

  status: {
    type: String,
    enum: ["draft", "published", "ongoing", "completed"],
    default: "draft",
  },

  // Separate flag for registration state — can be toggled independently of status
  // This allows "close registrations" without changing the event lifecycle status
  registrationOpen: {
    type: Boolean,
    default: false,
  },

  registrationCount: {
    type: Number,
    default: 0,
  },

  customForm: {
    type: [formFieldSchema],
    default: [],
  },

  merchandiseItems: {
    type: [merchandiseItemSchema],
    default: [],
  },
},
  { timestamps: true });

export default mongoose.model("Event", eventSchema);
