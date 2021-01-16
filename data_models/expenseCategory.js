const mongoose = require("mongoose");

var expenseSchema = mongoose.Schema({
    name: {
        type: String,
    },
    date: {
        type: String,
    },
});

module.exports = mongoose.model("ExpenseCategory", expenseSchema);