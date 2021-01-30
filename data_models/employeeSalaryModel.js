const mongoose = require("mongoose");

const empSalarySchema = mongoose.Schema({
    employeeId: {
        type: mongoose.Types.ObjectId,
        ref: "Couriers"
    },
    amountPaid: {
        type: Number,
    },
    remainingAmount: {
        type: Number,
        default: 0
    },
    note: {
        type: String,
        default: ""
    },
    date: {
        type: String,
        default: ""
    },
    time: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model("EmployeeSalary", empSalarySchema);