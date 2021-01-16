const mongoose = require("mongoose");

const orderSettingsSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  PerUnder5KM: { type: Number, required: true },
  PerKM: { type: Number, required: true },
  ReferalPoint: { type: Number, required: true },
  AppLink: { type: String},
  WhatsAppNo: { type: String},
  DefaultWMessage: { type: String},
  AmountPayKM: { type: Number,},
  TermsnConditionURL: { type: String,},
  FromTime: { type: String,},
  ToTime: { type: String,},
  NormalDelivery: { type: String,},
  ExpressDelivery: { type: String,},
  CancelOrderTime: { type: Number,},
  AdminMObile1: { type: String,},
  AdminMObile2: { type: String,},
  AdminMObile3: { type: String,},
  AdminMObile4: { type: String,},
  AdminMObile5: { type: String,},
  NewUserUnderKm: {
    type: Number,
  },
  NewUserprice: {
    type: Number,
  },
  addKmCharge: {
    type: Number,
  },
  newpromocode: {
    type: String,
  },
  handling_charges: {
    type: Number,
  },
  additionalKm:  {
    type: Number,
  },
});

module.exports = mongoose.model("Settings", orderSettingsSchema);

