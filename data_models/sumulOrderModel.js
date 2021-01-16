var mongoose = require('mongoose');

var sumulOrderSchema = mongoose.Schema({
    name: {
        type:String,
        require: true
    },
    mobileNo: {
        type:String,
        require: true
    },
    dateTime: {
        type:Date,
        default: Date.now
    },
    address: {
        type:String,
        require: true
    },
    qty250: {
        type:String,
        require:true
    },
    qty500: {
        type:String,
        require:true
    },
    qty1000: {
        type:String,
        require:true
    },
    building: {
        type:String,
        require: true
    },
    date: {
       type:String
    },
    time: {
        type:String
    },
    orderNo: {
        type:String
    },
    totalAmount: {
        type:String
    },
    paymentMethod: {
        type:String
    },
    paymentStatus: {
        type:String
    }, 
});

module.exports = mongoose.model("sumulOrder",sumulOrderSchema);