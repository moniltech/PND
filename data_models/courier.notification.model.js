const mongoose = require("mongoose");

const courierNotificationSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  courierId: { type: mongoose.Types.ObjectId, ref: "Couriers", default: null },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  entryDate: {
    type: Date,
    default: Date.now,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("couriernotifications", courierNotificationSchema);
