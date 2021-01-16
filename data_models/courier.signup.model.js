const mongoose = require("mongoose");

const courierSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  cId: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  mobileNo: {
    type: String,
    required: true,
  },
  profileImg: {
    type: String,
  },
  poaType: {
    type: String,
    required: true,
  },
  poaFrontImg: {
    type: String,
  },
  poaBackImg: {
    type: String,
  },
  panCardImg: {
    type: String,
  },
  proofType: {
    type: String,
    required: true,
  },
  electricityImg: {
    type: String,
  },
  policeVerificationImg: {
    type: String,
    default: "",
  },
  fcmToken: {
    type: String,
  },
  transport: {
    vehicleType: {
      type: String,
      default: null,
    },
    vehicleNo: {
      type: String,
      default: null,
    },
  },
  bankDetail: {
    bankName: {
      type: String,
      default: null,
    },
    ifscCode: {
      type: String,
      default: null,
    },
    accNo: {
      type: String,
      default: null,
    },
    branch: {
      type: String,
      default: null,
    },
  },
  accStatus: {
    flag: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      default: "Waiting For Administrator Approval!",
    },
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  dateTime: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Couriers", courierSchema);
