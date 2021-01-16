const mongoose = require("mongoose");

const promoCodeSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  isForNewUser: {
    type: Boolean,
    default: false,
  },
  image:{
    type:String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  discount: {
    type: Number,
    required: true,
  },
  validfrom: {
    type: Date,
    required: true,
  },
  validupto: {
    type: Date,
    required: true,
  },
  entryDate: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Promocode", promoCodeSchema);
