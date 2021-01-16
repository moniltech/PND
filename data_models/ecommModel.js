const mongoose = require("mongoose");

const ecommSchema = mongoose.Schema({
//   _id: mongoose.Schema.Types.ObjectId,
  amountCollection : { 
      type:Number
   },
   handlingCharge : {
       type:Number
   },
//    customerId : mongoose.Schema.Types.ObjectId,
   pkName : {
    type:String
    },
   pkMobileNo : {
    type:String
   },
   pkAddress : {
    type:String
   },
   pkLat : {
    type:Number
   },
   pkLong: {
    type:Number
   },
   pkCompleteAddress: {
    type:String
   }
});

module.exports = mongoose.model("EcommerseOrder", ecommSchema);

