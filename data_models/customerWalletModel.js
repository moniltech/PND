const mongoose = require("mongoose");

const customerWalletSchema = mongoose.Schema({
    customerId: {
         type: mongoose.Types.ObjectId, 
         ref: "Customers" 
    },
    credit: {
        type: Number,
        default: 0
    },
    debit: {
        type: Number,
        default: 0
    },
    date: {
        type: String,
        default: ""
    }, 
    time: {
        type: String,
        default: ""
    }, 
    prevWalletAmount: {
        type: Number,
        default: 0
    },
    walletAmount: {
        type: Number,
        default: 0
    }, 
    discription: {
        type: String,
        default: ""
    }, 
});

module.exports = mongoose.model("WalletRecords", customerWalletSchema);
