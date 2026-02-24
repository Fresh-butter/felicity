import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
    },

    // No userId stored — feedback is truly anonymous.
    // Duplicate prevention is handled via a flag on the Registration model.

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

export default mongoose.model("Feedback", feedbackSchema);
