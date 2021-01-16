const mongoose = require("mongoose");

const ExtraTimeSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  courierId: { type: mongoose.Types.ObjectId, ref: "Couriers", default: null },
  orderId: { type: mongoose.Types.ObjectId, ref: "Orders" },
  blat: {
    type: String,
  },
  blong: {
    type: String,
  },
  plat: {
    type: String,
  },
  plong: {
    type: String,
  },
  dateTime: {
    type: Date,
    default: Date.now,
  },
  deliverytime: {
    type: Date,
    default: null
  },
});

module.exports = mongoose.model("ExtraTime", ExtraTimeSchema);
