const mongoose = require("mongoose");

const bannerSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
        type: String,
    },
    image: {
        type: String,
    },
    // bottomImage : {
    //     type: String
    // },
    dateTime: {
        type: Date,
        default: Date.now,
    },
    type:{
        type: String,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
});

module.exports = mongoose.model("banners", bannerSchema);