const mongoose = require("mongoose");
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const vendorSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  courierId: { 
    type: mongoose.Types.ObjectId,
    ref: "Couriers",
  },
  name: {
    type: String,
    required: true,
  },    
  mobileNo: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  gpsLocation: {
    lat: {
        type: String,
        // required: true,
    },
    long: {
        type: String,
        // required: true,
    },
    completeAddress: {
      type: String
    }
  },
  address: {
    type: String,
    default: "",
  },
  gstNo:{
      type: String,
      default: "",
  },
  panNumber:{
      type: String,
      default: "",
  },
  password:{
      type:String,
      default: "",
  },
  FixKm: {
    type: Number,
    default: 0,
  },
  UnderFixKmCharge: {
      type: Number,
      default: 0,
  },
  perKmCharge:{
      type: Number,
      default: 0,
  },
  isApprove: {
    type: Boolean,
    default: false,
  },
  isUpdated: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Vendor", vendorSchema);
