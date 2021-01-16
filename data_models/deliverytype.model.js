const mongoose = require("mongoose");

const deliverytypeSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
        type: String,
    },
    weightlimit: {
        type: String,
    },
    cost: {
        type: Number,
    },
});

module.exports = mongoose.model("deliverytypes", deliverytypeSchema);