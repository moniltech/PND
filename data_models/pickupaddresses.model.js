const mongoose = require("mongoose");

const pickupAddressSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  customerId: { type: mongoose.Types.ObjectId, ref: "Customers" },
  vendorId: { type: mongoose.Types.ObjectId, ref: "Vendor" },
  name: {
    type: String,
    required: true,
  },
  mobileNo: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  lat: {
    type: String,
    required: true,
  },
  long: {
    type: String,
    required: true,
  },
  completeAddress: {
    type: String,
    required: true,
  },
  dateTime: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("pickupAddress", pickupAddressSchema);
