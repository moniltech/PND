const mongoose = require("mongoose");

const leaveSchema = mongoose.Schema({
    employeeId: {
        type: mongoose.Types.ObjectId,
        ref: "Couriers"
    },
    fromDate: {
        type: String,
        required: true,
    },
    toDate: {
        type: String,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    discription: {
        type: String,
        default: ""
    },
    leaveApplyDate: {
        type: String
    },
    leaveApplyTime: {
        type: String
    },
    isApprove: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model("courierLeave", leaveSchema);