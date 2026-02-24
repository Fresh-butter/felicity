import mongoose from "mongoose";

const discussionSchema = new mongoose.Schema({
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
    message: {
        type: String,
        required: true,
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Discussion",
        default: null,
    },
    pinned: {
        type: Boolean,
        default: false,
    },
    reactions: {
        type: Map,
        of: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        default: {},
    },
}, { timestamps: true });

export default mongoose.model("Discussion", discussionSchema);
