const mongoose = require("mongoose");

const orderCancelSchema = mongoose.Schema({
  DefaultReason : [{ type:String }],
  CustomeReason : { type:String }
});

module.exports = mongoose.model("Reasons", orderCancelSchema);
