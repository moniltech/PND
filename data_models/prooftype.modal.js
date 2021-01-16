const mongoose = require("mongoose");

const prooftypeSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
        type: String,
    },
});

module.exports = mongoose.model("prooftypes", prooftypeSchema);