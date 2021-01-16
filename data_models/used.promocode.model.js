const mongoose = require("mongoose");

const usedPromoCodeSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  customer: {
    type: mongoose.Types.ObjectId,
    ref: "Customers",
  },
  code: {
    type: String,
    required: true,
  },
  entryDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Usedpromocode", usedPromoCodeSchema);
