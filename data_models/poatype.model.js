const mongoose = require("mongoose");

const poatypeSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
        type: String,
    },
});

module.exports = mongoose.model("poatypes", poatypeSchema);