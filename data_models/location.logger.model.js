const mongoose = require("mongoose");

const LocationSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    courierId: { type: mongoose.Types.ObjectId, ref: "Couriers", default: null },
    lat: {
        type: String,
        required: true,
    },
    long: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    dateTime: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("locationLogger", LocationSchema);