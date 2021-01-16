const mongoose = require("mongoose");

const requestsSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  courierId: { type: mongoose.Types.ObjectId, ref: "Couriers" },
  orderId: { type: mongoose.Types.ObjectId, ref: "Orders" },
  distance: {
    type: Number,
    required: true,
  },
  fcmToken: {
    type: String,
  },
  status: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
  },
});

module.exports = mongoose.model("requests", requestsSchema);
