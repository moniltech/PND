const mongoose = require("mongoose");

const apkDetailsSchema = mongoose.Schema({
    androidVersion: {
        type: String,
        default: ""
    },
    iosVersion: {
        type: String,
        default: ""
    },
    tinyURL: {
        type: String,
        default: ""
    }, 
});

module.exports = mongoose.model("apkDetails", apkDetailsSchema);