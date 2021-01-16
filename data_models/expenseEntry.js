const mongoose = require("mongoose");

var expenseEntrySchema = mongoose.Schema({
    expenseCategory: {
        type: mongoose.Types.ObjectId,
        ref: "ExpenseCategory"
    },
    date: {
        type: String,
    },
    time: {
        type: String,
    },
    amount: {
        type: Number,
    },
    paymentType: {
        type: String,   
    },
    description: {
        type: String,
    }
});

module.exports = mongoose.model("Expenses", expenseEntrySchema);