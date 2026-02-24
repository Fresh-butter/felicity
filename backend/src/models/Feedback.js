import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },

    comment: {
        type: String,
        default: "",
    },
},
    { timestamps: true }
);

// one feedback per user per event
feedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Feedback", feedbackSchema);
