const mongoose = require("mongoose");

const messageSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    dateTime: {
        type: Date,
        default: Date.now,
    }
  });
  
  module.exports = mongoose.model("messageCreators", messageSchema);
  