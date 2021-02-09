require("dotenv").config();
var express = require("express");
var multer = require("multer");
var path = require("path");
var axios = require("axios");
var router = express.Router();
var config = require("../config");
var { encryptPWD, comparePWD } = require('../crypto');
var Bcrypt = require("bcryptjs");
var mongoose = require("mongoose");
var geolib = require("geolib");
const moment = require('moment-timezone');
var schedule = require('node-schedule');
var arraySort = require("array-sort");
var request = require('request');

let vendorModelSchema = require("../data_models/vendor.model");
let demoOrderSchema = require("../data_models/demoMultiModel");
let promoCodeSchema = require("../data_models/promocode.model");
let settingsSchema = require("../data_models/settings.model");
let deliverytypesSchema = require("../data_models/deliverytype.model");
let requestSchema = require("../data_models/order.request.model");
let ExtatimeSchema = require("../data_models/extratime.model");
let customerSchema = require("../data_models/customer.signup.model");
let usedpromoSchema = require("../data_models/used.promocode.model");
let locationLoggerSchema = require("../data_models/location.logger.model");
let courierSchema = require("../data_models/courier.signup.model");
var orderSchema = require("../data_models/order.model");

async function currentLocation(courierId) {
    console.log(courierId);
    var CourierRef = config.docref.child(courierId);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    // console.log("---------");
    // // console.log(data);
    // console.log("---------");
    return data;
}

async function GoogleMatrix(fromlocation, tolocation) {
    let link =
        "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&mode=driving&origins=" +
        fromlocation.latitude +
        "," +
        fromlocation.longitude +
        "&destinations=" +
        tolocation.latitude +
        "," +
        tolocation.longitude +
        "&key=" +
        process.env.GOOGLE_API;
    let results = await axios.get(link);
    let distancebe = results.data.rows[0].elements[0].distance.value;
    // console.log(distancebe + " Meter");
    return distancebe / 1000;
}

async function PNDfinder(pickuplat, pickuplong, orderid, deliveryType) {
    let available = [];
    let getpndpartners = await courierSchema
        .find({
            isActive: true,
            isVerified: true,
            "accStatus.flag": true,
        })
        .select("id fcmToken");
    console.log("-------------Get PND Partner-----------------------------------");
    // console.log(getpndpartners);

    if (deliveryType == "Normal Delivery") {
        for (let i = 0; i < getpndpartners.length; i++) {
            let partnerlocation = await currentLocation(getpndpartners[i].id);
            if (
                (partnerlocation.duty == "ON") &
                (Number(partnerlocation.parcel) < 3)
            ) {
                if(partnerlocation.latitude != null && partnerlocation.longitude != null){
                
                    let totalrequests = await requestSchema.countDocuments({
                        orderId: orderid,
                    });
                    let partnerrequest = await requestSchema.find({
                        courierId: getpndpartners[i].id,
                        orderId: orderid,
                    });
                    if (totalrequests <= 4) {
                        if (partnerrequest.length == 0) {
                            let pickupcoords = { latitude: pickuplat, longitude: pickuplong };
                            let partnercoords = {
                                latitude: partnerlocation.latitude == null ? "" : partnerlocation.latitude,
                                longitude: partnerlocation.longitude == null ? "" : partnerlocation.longitude,
                            };
                            // console.log(partnerlocation);
                            // console.log(pickupcoords, partnercoords)
                            let distancebtnpp = await GoogleMatrix(pickupcoords, partnercoords);
                            // console.log("Distacnwe: "+distancebtnpp);
                            if (distancebtnpp <= 15) {
                                available.push({
                                    courierId: getpndpartners[i].id,
                                    orderId: orderid,
                                    distance: distancebtnpp,
                                    status: "Pending",
                                    fcmToken: getpndpartners[i].fcmToken,
                                    reason: "",
                                });
                            }
                        }
                    }
                }
            }
        }
        // console.log("ifffffffffff Normal");
        // console.log(available);
    } else {
        for (let i = 0; i < getpndpartners.length; i++) {
            let partnerlocation = await currentLocation(getpndpartners[i].id);
            if (
                (partnerlocation.duty == "ON") &
                (Number(partnerlocation.parcel) == 0)
            ) {
                let totalrequests = await requestSchema.countDocuments({
                    orderId: orderid,
                });
                let partnerrequest = await requestSchema.find({
                    courierId: getpndpartners[i].id,
                    orderId: orderid,
                });
                if (totalrequests <= 4) {
                    if (partnerrequest.length == 0) {
                        let pickupcoords = { latitude: pickuplat, longitude: pickuplong };
                        let partnercoords = {
                            latitude: partnerlocation.latitude,
                            longitude: partnerlocation.longitude,
                        };
                        let distancebtnpp = await GoogleMatrix(pickupcoords, partnercoords);
                        if (distancebtnpp <= 15) {
                            available.push({
                                courierId: getpndpartners[i].id,
                                orderId: orderid,
                                distance: distancebtnpp,
                                status: "Pending",
                                fcmToken: getpndpartners[i].fcmToken,
                                reason: "",
                            });
                        }
                    }
                }
            }
        }
    }
    console.log("==================================Return==========================");
    // console.log(available);
    return available;
}

// send sms
async function sendMessages(mobileNo, message) {
    let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + mobileNo + "&text= " + message;

    try {
        await axios.get(msgportal)
            .then(resp=>{
                // console.log("===========================================================================");
                console.log(resp.data);
            })  
            .catch(error=>{
                // console.log("=========================  ERROR  ==================================================");
                console.log(error.response.data);
            });;
        var data = await axios.get(msgportal);
        return data;    
    } catch (error) {
        return 0;    
    }
}
var imguploader = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/orderimg");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var orderimg = multer({ storage: imguploader });

//Function for finding distance between two locations
function calculatelocation(lat1, long1, lat2, long2) {
    if (lat1 == 0 || long1 == 0) {
      area = 1; // Company Lat and Long is not defined.
    } else {
      const location1 = {
        lat: parseFloat(lat1),
        lon: parseFloat(long1),
      };
      const location2 = {
        lat: parseFloat(lat2),
        lon: parseFloat(long2),
      };
      heading = geolib.getDistance(location1, location2);
      if (!isNaN(heading)) {
          return heading;
      } else {
        heading =  -1; //  Lat and Long is not defined.
    }
    return heading;
  }
}

router.post("/vendor_register", async function(req , res , next){
    const { name, mobileNo , company , email , gstNo , panNumber , lat , address ,
        long , password , FixKm , UnderFixKmCharge , perKmCharge } = req.body;
   
    let encryptPassword = Bcrypt.hashSync(req.body.password, 10);   
    console.log(encryptPassword);
    try {
        let existUser = await vendorModelSchema.find({ mobileNo: mobileNo });
        if(existUser.length == 1){
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "User Already Exist" });
        }else{
            var vendor = await new vendorModelSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name,
                mobileNo: mobileNo,
                company: company,
                email: email,
                gstNo: gstNo,
                panNumber: panNumber,
                gpsLocation:{
                    lat: lat,
                    long: long,
                },
                address: address,
                password: encryptPassword,
                FixKm: FixKm == undefined ? "" : FixKm,
                UnderFixKmCharge: UnderFixKmCharge == undefined ? " " : UnderFixKmCharge,
                perKmCharge: perKmCharge == undefined ? " " : perKmCharge,
            });
    
            registerVendor = vendor.save();
            console.log(vendor);
    
            res.status(200).json({ Message: "Vendor Register Successfull...!!!", Data: [vendor], IsSuccess: true });
        }
    } catch (error) {
        res.status(400).json({ Message: "Register Unsuccessfull...!!!", IsSuccess: false });
    }
});

router.post("/updateVendorCharge", async function(req,res,next){
    const { vendorId , FixKm , UnderFixKmCharge , perKmCharge } = req.body;
    try {
        let existVendor = await vendorModelSchema.find({ _id: vendorId });
        if(existVendor.length == 1){
            let updateIs = {
                FixKm: FixKm,
                UnderFixKmCharge: UnderFixKmCharge,
                perKmCharge: perKmCharge,
                isUpdated: true,
            }
            let updateRecord = await vendorModelSchema.findByIdAndUpdate(existVendor[0]._id,updateIs);
            res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Data Updated" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Vendor Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    } 
});

//Update Vendor Location-----31-12-2020---MONIL
router.post("/updateVendor" , async function(req,res,next){
    const { vendorId , lat , long , completeAddress , name, mobileNo , company , email , gstNo , panNumber } = req.body;
    try {
        let existVendor = await vendorModelSchema.find({ _id: vendorId });
        if(existVendor.length == 1){
            let updateIs = {
                name: name,
                mobileNo: mobileNo,
                company: company,
                email: email,
                gstNo: gstNo,
                panNumber: panNumber,
                gpsLocation :{
                    lat: lat,
                    long: long,
                    completeAddress: completeAddress,
                },
            }
            let updateRecord = await vendorModelSchema.findByIdAndUpdate(existVendor[0]._id,updateIs);
            res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Data Updated" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Vendor Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Vendor Login ------ Mobile APP(29-12-2020)
router.post("/VendorLogin", async function(req,res,next){
    const { mobileNo } = req.body;
    try {
        let record = await vendorModelSchema.find({ mobileNo: mobileNo });
        if(record.length > 0){
            res.status(200).json({ IsSuccess: true , Data: record , Message: "User LoggedIn" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "User Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//For WebApplication
router.post("/vendor_login" , async function(req , res, next){
    const { email, password } = req.body;
    
    // console.log(req.body);
    try {
        let userEmail = await vendorModelSchema.findOne({ email : email , isApprove: true });
        // console.log(userEmail);
        if(!userEmail) {
            return res.status(200).json({ IsSuccess: true , Data: [] , message: "The username does not exist" });
        }
        if(!Bcrypt.compareSync(req.body.password, userEmail.password)) {
            return res.status(200).json({ IsSuccess: true , Data: [] , message: "The password is invalid" });
        }
        res.status(200).json({ IsSuccess: true , Data: userEmail , message: "Vendor Logged In Successfull" });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

function getVendorOrderNumber() {
    let orderNo = "ORD-VND-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}

function getVendorMultiOrderNumber() {
    let orderNo = "ORDMT-VND-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}

router.post("/vendorOrderCalc",async function(req,res,next){
    const { 
        vendorId,
        // deliveryPoints,
        orderNo,
        deliverytype,
        promocode,
        parcelcontents,
        // amountCollected,  
    } = req.body;
    try {
        let vendorData = await vendorModelSchema.find({ _id: vendorId });
        let orderIs = await orderSchema.find({ orderNo: orderNo});

        let deliveryPoints = [];
        for(let ij=0;ij<orderIs.length;ij++){
            let deliveryData = {
                lat : orderIs[ij].deliveryPoint.lat,
                long: orderIs[ij].deliveryPoint.long,
                vendorBillAmount : orderIs[ij].deliveryPoint.vendorBillAmount,
                courierChargeCollectFromCustomer : orderIs[ij].deliveryPoint.courierChargeCollectFromCustomer,
            }
            deliveryPoints.push(deliveryData);
        }
        console.log(deliveryPoints);
        // console.log(typeof(deliveryPoints[0].lat));

        let picklat = vendorData[0].gpsLocation.lat;
        let picklong = vendorData[0].gpsLocation.long;

        if(picklat != null && picklong != null || picklat != undefined && picklong != undefined){
            let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };

            let prmcodes = await promoCodeSchema.find({ code: promocode });
            let settings = await settingsSchema.find({});
            let delivery = await deliverytypesSchema.find({});

            // let promoused = 0;

            let FixKm = parseFloat(vendorData[0].FixKm);
            let UnderFixKmCharge = parseFloat(vendorData[0].UnderFixKmCharge);
            let perKmCharge = parseFloat(vendorData[0].perKmCharge);

            // console.log(FixKm);
            // console.log(UnderFixKmCharge);
            // console.log(perKmCharge);

            let basicKm = 0;
            let basicCharge = 0;
            let extraaKm = 0;
            let extraaCharge = 0;
            let Amount = 0;
            let totalAmount = 0;
            let addionalCharges = 0;
            let thirdPartyCollection = 0
            let thirdPartyCollectionCharge = 0;

            let DataPass = [];
            let pndBill = [];

            let handlingCharge = parseFloat(settings[0].handling_charges);
            console.log("HAndling : "+handlingCharge);
            
        for(let j=0;j<deliveryPoints.length;j++){
            let dropLat = Number(deliveryPoints[j].lat);
            let dropLong = Number(deliveryPoints[j].long);
            // console.log([dropLat,dropLong]);

            if((deliveryPoints[j].lat != null && deliveryPoints[j].long != null) && 
                (deliveryPoints[j].lat != undefined && deliveryPoints[j].long != undefined) &&
                (dropLat !== 0 && dropLong !== 0)){
                    console.log("----------------------Delivery Lat & Long----------------------");
                    console.log(deliveryPoints[j].lat);
                    console.log(deliveryPoints[j].long);
                let lat3 = parseFloat(deliveryPoints[j].lat);
                let long3 = parseFloat(deliveryPoints[j].long);
        
                let tolocation = { latitude: Number(lat3), longitude: Number(long3) };
                
                let fromLatitude = fromlocation.latitude;
                let fromLongitude = fromlocation.longitude;
                let toLatitude = tolocation.latitude;
                let toLongitude = tolocation.longitude;
                
                let totaldistance = await calculatelocation(fromLatitude, fromLongitude,toLatitude,toLongitude);
            
                totaldistance = parseFloat(totaldistance) / 1000;
                console.log(totaldistance);
                if(totaldistance < FixKm){
                    basicKm = totaldistance;
                    basicCharge = UnderFixKmCharge;
                    extraaKm = 0;
                    extraaCharge = 0;
                    addionalCharges = 0;
                    Amount = basicCharge + extraaCharge + addionalCharges;
                    totalAmount = Amount; 
                }else{
                    let remKm = totaldistance - FixKm;
                    basicCharge = UnderFixKmCharge;
                    extraaKm = remKm;
                    extraaCharge = extraaKm * perKmCharge;
                    addionalCharges = 0;
                    Amount = basicCharge + extraaCharge + addionalCharges;
                    totalAmount = Amount;
                }
            }else{
                console.log("Helo============================================");
                // let FixKm = parseFloat(vendorData[0].FixKm);
                let UnderFixKmCharge = parseFloat(vendorData[0].UnderFixKmCharge);
                // let perKmCharge = parseFloat(vendorData[0].perKmCharge);

                totalAmount = UnderFixKmCharge;
            }
            let courierChargeCollectFromCust = deliveryPoints[j].courierChargeCollectFromCustomer;
            let vendorAmount = parseFloat(deliveryPoints[j].vendorBillAmount);
            let totalVendorBill = 0;

            //totalAmount is total Courier Charge
            if(courierChargeCollectFromCust == true){
                totalVendorBill = totalAmount + vendorAmount;
            }else{
                totalVendorBill = vendorAmount;
            }

            let sendData = {
                CourierChargeCollectFromCustomerIs: orderIs[j].deliveryPoint.courierChargeCollectFromCustomer,
                CourierChargeCollectFrom : orderIs[j].deliveryPoint.courierChargeCollectFromCustomer == true ? "Customer" : "Vendor",
                VendorAmount : vendorAmount,
                CouriersChargeIs : totalAmount,
                VendorTotalBill : totalVendorBill
            }
            console.log(sendData);
            DataPass.push(sendData);
            let updateDeliveryDetails = {
                "deliveryPoint.vendorBillAmount": vendorAmount,
                "deliveryPoint.customerCourierCharge": totalAmount,
                "deliveryPoint.vendorBillFinalAmount": totalVendorBill
            }
            let vendorOrderMTNum = orderIs[j].multiOrderNo;
            console.log(vendorOrderMTNum);
            console.log("=======================================================================================");
            let updateInOrder = await orderSchema.findByIdAndUpdate(orderIs[j]._id,updateDeliveryDetails);
        }
        console.log(DataPass);
        let pndTotalAmountCollect = 0;
        let pndTotalCourierCharge = 0;

        for(let k=0;k<DataPass.length;k++){
            pndTotalAmountCollect = pndTotalAmountCollect + parseFloat(DataPass[k].VendorTotalBill);
            pndTotalCourierCharge = pndTotalCourierCharge + parseFloat(DataPass[k].CouriersChargeIs);
        }
        console.log(pndTotalAmountCollect);
        console.log(pndTotalCourierCharge);

        let finalPNDBill = parseFloat(pndTotalAmountCollect) - parseFloat(pndTotalCourierCharge);
        finalPNDBill = Math.abs(finalPNDBill);
        // for(let jk=0;jk<orderIs.length;jk++){
        //     let updateIs = {
        //         "deliveryPoint.customerCourierCharge" : DataPass[jk].CouriersChargeIs,
        //         "deliveryPoint.vendorBillFinalAmount" : DataPass[jk].VendorTotalBill,
        //         "chargeOfPND" : finalPNDBill,
        //     }
        //     let vendorOrderMTNum = orderIs[jk].multiOrderNo;
        //     // console.log(vendorOrderMTNum);
        //     let updateInOrder = await orderSchema.findOneAndUpdate({ multiOrderNo: vendorOrderMTNum},updateIs);
        // }
       
        res.status(200).json({ 
                               IsSuccess: true,
                               PndTotalAmountCollect: pndTotalAmountCollect,
                               PndTotalCourierCharge: pndTotalCourierCharge,
                               PNDBill : finalPNDBill,
                               Data: DataPass, 
                               Message: "calculation Done" 
                            })
        }else{
            console.log("here=================================");
            let FixKm = parseFloat(vendorData[0].FixKm);
            let UnderFixKmCharge = parseFloat(vendorData[0].UnderFixKmCharge);
            let perKmCharge = parseFloat(vendorData[0].perKmCharge);

            let totalAmount = UnderFixKmCharge;
            let DataPass = [];
            // console.log(FixKm);
            // console.log(UnderFixKmCharge);
            // console.log(perKmCharge);
            for(let h=0;h<deliveryPoints.length;h++){
                let courierChargeCollectFromCust = deliveryPoints[h].courierChargeCollectFromCustomer;
                let vendorAmount = parseFloat(deliveryPoints[h].vendorBillAmount);
                let totalVendorBill = 0;

                //totalAmount is total Courier Charge
                if(courierChargeCollectFromCust == true){
                    totalVendorBill = totalAmount + vendorAmount;
                }else{
                    totalVendorBill = vendorAmount;
                }

                let sendData = {
                    VendorAmount : vendorAmount,
                    CouriersChargeIs : totalAmount,
                    VendorTotalBill : totalVendorBill
                }
                DataPass.push(sendData);
                let updateDeliveryDetails = {
                    "deliveryPoint.vendorBillAmount": vendorAmount,
                    "deliveryPoint.customerCourierCharge": totalAmount,
                    "deliveryPoint.vendorBillFinalAmount": totalVendorBill
                }
                let vendorOrderMTNum = orderIs[h].multiOrderNo;
                console.log(vendorOrderMTNum);
                console.log("====================================nahhhhhhhhhhhhhhh==================================");
                let updateInOrder = await orderSchema.findByIdAndUpdate(orderIs[h]._id,updateDeliveryDetails);
            }
            console.log(DataPass);
            let pndTotalAmountCollect = 0;
            let pndTotalCourierCharge = 0;

            for(let k=0;k<DataPass.length;k++){
                pndTotalAmountCollect = pndTotalAmountCollect + parseFloat(DataPass[k].VendorTotalBill);
                pndTotalCourierCharge = pndTotalCourierCharge + parseFloat(DataPass[k].CouriersChargeIs);
            }
            console.log(pndTotalAmountCollect);
            console.log(pndTotalCourierCharge);

            let finalPNDBill = parseFloat(pndTotalAmountCollect) - parseFloat(pndTotalCourierCharge);
            finalPNDBill = Math.abs(finalPNDBill);
            // for(let jk=0;jk<orderIs.length;jk++){
            //     let updateIs = {
            //         "deliveryPoint.customerCourierCharge" : DataPass[jk].CouriersChargeIs,
            //         "deliveryPoint.vendorBillFinalAmount" : DataPass[jk].VendorTotalBill,
            //         "chargeOfPND" : finalPNDBill,
            //     }
            //     let vendorOrderMTNum = orderIs[jk].multiOrderNo;
            //     // console.log(vendorOrderMTNum);
            //     console.log("==============================nahhhhhhhhhhhhhhhhhhhhh======================================");
            //     let updateInOrder = await orderSchema.findOneAndUpdate({ multiOrderNo: vendorOrderMTNum},updateIs);
            // }
            res.status(200).json({ 
                IsSuccess: true,
                PndTotalAmountCollect: pndTotalAmountCollect,
                PndTotalCourierCharge: pndTotalCourierCharge,
                PNDBill : finalPNDBill,
                Data: DataPass, 
                Message: "calculation Done" 
             })
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Vendor order api for android apk
router.post("/vendorOrder", orderimg.single("orderimg"), async function(req,res,next){
    var {
        vendorId,
        deliveryType,
        weightLimit,
        // pkName,
        // pkMobileNo,
        // pkAddress,
        // pkLat,
        // pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        deliveryAddresses,
        // collectCash,
        promoCode,
        // amount,
        // discount,
        // additionalAmount,
        // finalAmount,
        schedualDate,
        schedualTime,
        dateTime,
    } = req.body;
    const file = req.file;
    let num = getVendorOrderNumber();
    let vendorOrders = [];
    try {
        let pickData = await vendorModelSchema.find({ _id: vendorId });
        // if(pickData[0].isApprove == true)
        for(let i=0;i<deliveryAddresses.length;i++){
            var newVendorMultiOrder = new orderSchema({
                _id: new config.mongoose.Types.ObjectId(),
                orderBy: "vendor",
                orderNo: num,
                multiOrderNo: getVendorMultiOrderNumber(),
                vendorId: vendorId,
                deliveryType: deliveryType,
                schedualDate: schedualDate,
                schedualTime: schedualTime,
                weightLimit: weightLimit,
                // orderImg: file == undefined ? "" : file.path,
                dateTime: dateTime,
                pickupPoint: {
                    name: pickData[0].name,
                    mobileNo: pickData[0].mobileNo,
                    address: pickData[0].address,
                    lat: pickData[0].gpsLocation.lat,
                    long: pickData[0].gpsLocation.long,
                    completeAddress: pkCompleteAddress,
                    contents: pkContent,
                    arriveType: pkArriveType,
                    arriveTime: pkArriveTime,
                },
                deliveryPoint:{
                    name: deliveryAddresses[i].dpName,
                    mobileNo: deliveryAddresses[i].dpMobileNo,
                    address: deliveryAddresses[i].dpAddress,
                    lat: deliveryAddresses[i].dpLat,
                    long: deliveryAddresses[i].dpLong,
                    completeAddress: deliveryAddresses[i].dpCompleteAddress,
                    distance: deliveryAddresses[i].dpDistance,
                    vendorBillAmount : deliveryAddresses[i].vendorBillAmount,
                    customerCourierCharge : deliveryAddresses[i].customerCourierCharge,
                    vendorBillFinalAmount : deliveryAddresses[i].vendorBillFinalAmount,
                    courierChargeCollectFromCustomer: deliveryAddresses[i].courierChargeCollectFromCustomer,
                },
                // collectCash: collectCash,
                promoCode: promoCode,
                // amount: "",
                // discount: "",
                // additionalAmount: "",
                // finalAmount: "",
                status: "Order Processing",
                note: "Your order is processing!",
            });
            var placeMultiOrder = await newVendorMultiOrder.save();
            // var placeMultiOrder = newVendorMultiOrder;
            vendorOrders.push(placeMultiOrder);   
        }
        let newOrderCustomer = await vendorModelSchema.find({ _id: vendorId });

        // console.log(newOrderCustomer[0].gpsLocation.lat);
        // console.log(newOrderCustomer[0].gpsLocation.long);
        let pkLat = parseFloat(newOrderCustomer[0].gpsLocation.lat);
        let pkLong = parseFloat(newOrderCustomer[0].gpsLocation.long);

        console.log(pkLat);
        console.log(pkLong);

        if(!pkLat && !pkLong){
            console.log("============================Manual Assign========================================");
            if(vendorOrders.length > 0){
                return res.status(200).json({ IsSuccess: true , Data: vendorOrders , Message: "Vendor Orders Found" });
            }else{
                return res.status(200).json({ IsSuccess: true , Data: [] , Message: "Vendor Orders Not Placed" });
            }
        }

        var avlcourier = await PNDfinder(
            pkLat,
            pkLong,
            placeMultiOrder.id,
            placeMultiOrder.deliveryType
        );
        if (promoCode != "0") {
            let usedpromo = new usedpromoSchema({
                _id: new config.mongoose.Types.ObjectId(),
                customer: customerId,
                code: promoCode,
            });
            usedpromo.save();
        }
        
        if(vendorOrders.length > 0){
            if (placeMultiOrder != null && avlcourier.length != 0) {
                console.log("Total Found:" + avlcourier.length);
                let courierfound = arraySort(avlcourier, "distance");
                var newrequest = new requestSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    courierId: courierfound[0].courierId,
                    orderId: courierfound[0].orderId,
                    distance: courierfound[0].distance,
                    status: courierfound[0].status,
                    reason: courierfound[0].reason,
                    fcmToken: courierfound[0].fcmToken,
                });
                await newrequest.save();
                var AdminMobile = await settingsSchema.find({}).select('AdminMObile1 AdminMObile2 AdminMObile3 AdminMObile4 AdminMObile5 -_id');
                console.log("Admin numbers-------------------------------------------------");
                console.log(AdminMobile);
                var AdminNumber1 = AdminMobile[0].AdminMObile1; 
                var AdminNumber2 = AdminMobile[0].AdminMObile2; 
                var AdminNumber3 = AdminMobile[0].AdminMObile3; 
                var AdminNumber4 = AdminMobile[0].AdminMObile4; 
                var AdminNumber5 = AdminMobile[0].AdminMObile5;
        
                // console.log(AdminNumber1);
    
                var findAdminFcmToken = await customerSchema.find({ mobileNo: AdminNumber1 }).select('fcmToken -_id');
                var findAdminFcmToken2 = await customerSchema.find({ mobileNo: AdminNumber2 }).select('fcmToken -_id');
                var findAdminFcmToken3 = await customerSchema.find({ mobileNo: AdminNumber3 }).select('fcmToken -_id');
                var findAdminFcmToken4 = await customerSchema.find({ mobileNo: AdminNumber4 }).select('fcmToken -_id');
                var findAdminFcmToken5 = await customerSchema.find({ mobileNo: AdminNumber5 }).select('fcmToken -_id');
                
                findAdminFcmToken == undefined ? " " : findAdminFcmToken[0].fcmToken;
                findAdminFcmToken2 == undefined ? " " : findAdminFcmToken2[0].fcmToken;
                findAdminFcmToken3 == undefined ? " " : findAdminFcmToken3[0].fcmToken;
                findAdminFcmToken4 == undefined ? " " : findAdminFcmToken4[0].fcmToken;
                findAdminFcmToken5 == undefined ? " " : findAdminFcmToken5[0].fcmToken;
                
                console.log(findAdminFcmToken);
                console.log(findAdminFcmToken2);
                console.log(findAdminFcmToken3);
                console.log(findAdminFcmToken4);
                console.log(findAdminFcmToken5);
    
                var AdminFcmToken = [findAdminFcmToken,findAdminFcmToken2,findAdminFcmToken3,findAdminFcmToken4,findAdminFcmToken5];
                console.log("-------------------------ADMINS TOKENS-----------------------------");
                console.log(AdminFcmToken);
    
                let newOrderData = newVendorMultiOrder.orderNo;
                let newOrderPickUp = newVendorMultiOrder.pickupPoint.address;
                // let newOrderDelivery = newVendorMultiOrder.deliveryPoint.address;
                let newOrderCustomerId = newVendorMultiOrder.customerId;
                console.log(newOrderCustomerId);
    
                // console.log(MultiOrders.length);
                // let newOrderDelivery = [];
                // for(let ik=0;ik<MultiOrders.length;ik++){
                //     newOrderDelivery.push(MultiOrders[ik].deliveryPoint.address);
                // }
    
                let newOrderNotification = `New Order Received 
                OrderID: ${newOrderData}
                Vendor: ${newOrderCustomer[0].name}
                Mobile: ${newOrderCustomer[0].mobileNo}  
                PickUp: ${newOrderPickUp}`;
                console.log(newOrderNotification);
    
                var AdminPhoneNumbers = [AdminNumber1,AdminNumber2,AdminNumber3,AdminNumber4,AdminNumber5];
                for(let i=0;i<AdminFcmToken.length;i++){
                    console.log(`--------------------------------------- ${i}`);
                    console.log(AdminFcmToken[i][0].fcmToken)
                    var dataSendToAdmin = {
                        "to":AdminFcmToken[i][0].fcmToken,
                        "priority":"high",
                        "content_available":true,
                        "data": {
                            "sound": "surprise.mp3",
                            "click_action": "FLUTTER_NOTIFICATION_CLICK"
                        },
                        "notification":{
                                    "body": newOrderNotification,
                                    "title":"New Order Received",
                                    "badge":1
                                }
                    };
            
                    var options2 = {
                        'method': 'POST',
                        'url': 'https://fcm.googleapis.com/fcm/send',
                        'headers': {
                            'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(dataSendToAdmin)
                    };
                    request(options2, function (error, response , body) {
                        console.log("--------------------Sender--------------------");
                        let myJsonBody = JSON.stringify(body);
                        console.log(myJsonBody);
                        //myJsonBody[51] USED TO ACCESS RESPONSE DATA SUCCESS FIELD
                        console.log(myJsonBody[51]);
                        if(myJsonBody[51]==0){
                            console.log("Send Text notification of new order..........!!!");
                            sendMessages(AdminPhoneNumbers[i],newOrderNotification);
                        }
                        if (error) {
                            console.log(error.message);
                        } else {
                            console.log("Sending Notification Testing....!!!");
                            console.log(response.body);
                            if(response.body.success=="1"){
                                console.log("Send Text notification of new order..........!!!");
                                sendMessages(AdminPhoneNumbers[i],newOrderNotification);
                            }
                        }
                    });
                }
        
            console.log("After sending notification");
            
            // FCM notification End
        
                    // New Code 03-09-2020
                    var payload = {
                        "title": "Order Alert",
                        "body": "New Order Alert Found For You.",
                        "data": {
                            "sound": "surprise.mp3",
                            "orderid": courierfound[0].orderId.toString(),
                            "distance": courierfound[0].distance.toString(),
                            "click_action": "FLUTTER_NOTIFICATION_CLICK"
                        },
                        "to": courierfound[0].fcmToken
                    };
                    var options = {
                        'method': 'POST',
                        'url': 'https://fcm.googleapis.com/fcm/send',
                        'headers': {
                            'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    };
                    request(options, function (error, response) {
                        if (error) {
                            console.log(error.message);
                        } else {
                            console.log("Sending Notification");
                            console.log(response.body);
                        }
                    });
            }
            res.status(200).json({ IsSuccess: true , Count: vendorOrders.length ,Data: vendorOrders , Message: "Order Placed" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Placed" });
        }        
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Vendor order api for website
router.post("/vendorOrder_v1", orderimg.single("orderimg"), async function(req,res,next){
    var {
        vendorId,
        deliveryType,
        weightLimit,
        // pkName,
        // pkMobileNo,
        // pkAddress,
        // pkLat,
        // pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        deliveryAddresses,
        // collectCash,
        promoCode,
        // amount,
        // discount,
        // additionalAmount,
        // finalAmount,
        schedualDate,
        schedualTime,
        dateTime,
    } = req.body;
    const file = req.file;
    let num = getVendorOrderNumber();
    let vendorOrders = [];
    try {
        let pickData = await vendorModelSchema.find({ _id: vendorId });
        deliveryAddresses = JSON.parse(deliveryAddresses);
        // if(pickData[0].isApprove == true)
        for(let i=0;i<deliveryAddresses.length;i++){
            var newVendorMultiOrder = new orderSchema({
                _id: new config.mongoose.Types.ObjectId(),
                orderBy: "vendor",
                orderNo: num,
                multiOrderNo: getVendorMultiOrderNumber(),
                vendorId: vendorId,
                deliveryType: deliveryType,
                schedualDate: schedualDate,
                schedualTime: schedualTime,
                weightLimit: weightLimit,
                // orderImg: file == undefined ? "" : file.path,
                dateTime: dateTime,
                pickupPoint: {
                    name: pickData[0].name,
                    mobileNo: pickData[0].mobileNo,
                    address: pickData[0].address,
                    lat: pickData[0].gpsLocation.lat,
                    long: pickData[0].gpsLocation.long,
                    completeAddress: pkCompleteAddress,
                    contents: pkContent,
                    arriveType: pkArriveType,
                    arriveTime: pkArriveTime,
                },
                deliveryPoint:{
                    name: deliveryAddresses[i].dpName,
                    mobileNo: deliveryAddresses[i].dpMobileNo,
                    address: deliveryAddresses[i].dpAddress,
                    lat: deliveryAddresses[i].dpLat,
                    long: deliveryAddresses[i].dpLong,
                    completeAddress: deliveryAddresses[i].dpCompleteAddress,
                    distance: deliveryAddresses[i].dpDistance,
                    vendorBillAmount : deliveryAddresses[i].vendorBillAmount,
                    customerCourierCharge : deliveryAddresses[i].customerCourierCharge,
                    vendorBillFinalAmount : deliveryAddresses[i].vendorBillFinalAmount,
                    courierChargeCollectFromCustomer: deliveryAddresses[i].courierChargeCollectFromCustomer,
                },
                // collectCash: collectCash,
                promoCode: promoCode,
                // amount: "",
                // discount: "",
                // additionalAmount: "",
                // finalAmount: "",
                status: "Order Processing",
                note: "Your order is processing!",
            });
            var placeMultiOrder = await newVendorMultiOrder.save();
            // var placeMultiOrder = newVendorMultiOrder;
            vendorOrders.push(placeMultiOrder);   
        }
        let newOrderCustomer = await vendorModelSchema.find({ _id: vendorId });

        // console.log(newOrderCustomer[0].gpsLocation.lat);
        // console.log(newOrderCustomer[0].gpsLocation.long);
        let pkLat = parseFloat(newOrderCustomer[0].gpsLocation.lat);
        let pkLong = parseFloat(newOrderCustomer[0].gpsLocation.long);

        console.log(pkLat);
        console.log(pkLong);

        if(!pkLat && !pkLong){
            console.log("============================Manual Assign========================================");
            if(vendorOrders.length > 0){
                return res.status(200).json({ IsSuccess: true , Data: vendorOrders , Message: "Vendor Orders Found" });
            }else{
                return res.status(200).json({ IsSuccess: true , Data: [] , Message: "Vendor Orders Not Placed" });
            }
        }

        var avlcourier = await PNDfinder(
            pkLat,
            pkLong,
            placeMultiOrder.id,
            placeMultiOrder.deliveryType
        );
        if (promoCode != "0") {
            let usedpromo = new usedpromoSchema({
                _id: new config.mongoose.Types.ObjectId(),
                customer: customerId,
                code: promoCode,
            });
            usedpromo.save();
        }
        
        if(vendorOrders.length > 0){
            if (placeMultiOrder != null && avlcourier.length != 0) {
                console.log("Total Found:" + avlcourier.length);
                let courierfound = arraySort(avlcourier, "distance");
                var newrequest = new requestSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    courierId: courierfound[0].courierId,
                    orderId: courierfound[0].orderId,
                    distance: courierfound[0].distance,
                    status: courierfound[0].status,
                    reason: courierfound[0].reason,
                    fcmToken: courierfound[0].fcmToken,
                });
                await newrequest.save();
                var AdminMobile = await settingsSchema.find({}).select('AdminMObile1 AdminMObile2 AdminMObile3 AdminMObile4 AdminMObile5 -_id');
                console.log("Admin numbers-------------------------------------------------");
                console.log(AdminMobile);
                var AdminNumber1 = AdminMobile[0].AdminMObile1; 
                var AdminNumber2 = AdminMobile[0].AdminMObile2; 
                var AdminNumber3 = AdminMobile[0].AdminMObile3; 
                var AdminNumber4 = AdminMobile[0].AdminMObile4; 
                var AdminNumber5 = AdminMobile[0].AdminMObile5;
        
                // console.log(AdminNumber1);
    
                var findAdminFcmToken = await customerSchema.find({ mobileNo: AdminNumber1 }).select('fcmToken -_id');
                var findAdminFcmToken2 = await customerSchema.find({ mobileNo: AdminNumber2 }).select('fcmToken -_id');
                var findAdminFcmToken3 = await customerSchema.find({ mobileNo: AdminNumber3 }).select('fcmToken -_id');
                var findAdminFcmToken4 = await customerSchema.find({ mobileNo: AdminNumber4 }).select('fcmToken -_id');
                var findAdminFcmToken5 = await customerSchema.find({ mobileNo: AdminNumber5 }).select('fcmToken -_id');
                
                findAdminFcmToken == undefined ? " " : findAdminFcmToken[0].fcmToken;
                findAdminFcmToken2 == undefined ? " " : findAdminFcmToken2[0].fcmToken;
                findAdminFcmToken3 == undefined ? " " : findAdminFcmToken3[0].fcmToken;
                findAdminFcmToken4 == undefined ? " " : findAdminFcmToken4[0].fcmToken;
                findAdminFcmToken5 == undefined ? " " : findAdminFcmToken5[0].fcmToken;
                
                console.log(findAdminFcmToken);
                console.log(findAdminFcmToken2);
                console.log(findAdminFcmToken3);
                console.log(findAdminFcmToken4);
                console.log(findAdminFcmToken5);
    
                var AdminFcmToken = [findAdminFcmToken,findAdminFcmToken2,findAdminFcmToken3,findAdminFcmToken4,findAdminFcmToken5];
                console.log("-------------------------ADMINS TOKENS-----------------------------");
                console.log(AdminFcmToken);
    
                let newOrderData = newVendorMultiOrder.orderNo;
                let newOrderPickUp = newVendorMultiOrder.pickupPoint.address;
                // let newOrderDelivery = newVendorMultiOrder.deliveryPoint.address;
                let newOrderCustomerId = newVendorMultiOrder.customerId;
                console.log(newOrderCustomerId);
    
                // console.log(MultiOrders.length);
                // let newOrderDelivery = [];
                // for(let ik=0;ik<MultiOrders.length;ik++){
                //     newOrderDelivery.push(MultiOrders[ik].deliveryPoint.address);
                // }
    
                let newOrderNotification = `New Order Received 
                OrderID: ${newOrderData}
                Vendor: ${newOrderCustomer[0].name}
                Mobile: ${newOrderCustomer[0].mobileNo}  
                PickUp: ${newOrderPickUp}`;
                console.log(newOrderNotification);
    
                var AdminPhoneNumbers = [AdminNumber1,AdminNumber2,AdminNumber3,AdminNumber4,AdminNumber5];
                for(let i=0;i<AdminFcmToken.length;i++){
                    console.log(`--------------------------------------- ${i}`);
                    console.log(AdminFcmToken[i][0].fcmToken)
                    var dataSendToAdmin = {
                        "to":AdminFcmToken[i][0].fcmToken,
                        "priority":"high",
                        "content_available":true,
                        "data": {
                            "sound": "surprise.mp3",
                            "click_action": "FLUTTER_NOTIFICATION_CLICK"
                        },
                        "notification":{
                                    "body": newOrderNotification,
                                    "title":"New Order Received",
                                    "badge":1
                                }
                    };
            
                    var options2 = {
                        'method': 'POST',
                        'url': 'https://fcm.googleapis.com/fcm/send',
                        'headers': {
                            'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(dataSendToAdmin)
                    };
                    request(options2, function (error, response , body) {
                        console.log("--------------------Sender--------------------");
                        let myJsonBody = JSON.stringify(body);
                        console.log(myJsonBody);
                        //myJsonBody[51] USED TO ACCESS RESPONSE DATA SUCCESS FIELD
                        console.log(myJsonBody[51]);
                        if(myJsonBody[51]==0){
                            console.log("Send Text notification of new order..........!!!");
                            sendMessages(AdminPhoneNumbers[i],newOrderNotification);
                        }
                        if (error) {
                            console.log(error.message);
                        } else {
                            console.log("Sending Notification Testing....!!!");
                            console.log(response.body);
                            if(response.body.success=="1"){
                                console.log("Send Text notification of new order..........!!!");
                                sendMessages(AdminPhoneNumbers[i],newOrderNotification);
                            }
                        }
                    });
                }
        
            console.log("After sending notification");
            
            // FCM notification End
        
                    // New Code 03-09-2020
                    var payload = {
                        "title": "Order Alert",
                        "body": "New Order Alert Found For You.",
                        "data": {
                            "sound": "surprise.mp3",
                            "orderid": courierfound[0].orderId.toString(),
                            "distance": courierfound[0].distance.toString(),
                            "click_action": "FLUTTER_NOTIFICATION_CLICK"
                        },
                        "to": courierfound[0].fcmToken
                    };
                    var options = {
                        'method': 'POST',
                        'url': 'https://fcm.googleapis.com/fcm/send',
                        'headers': {
                            'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    };
                    request(options, function (error, response) {
                        if (error) {
                            console.log(error.message);
                        } else {
                            console.log("Sending Notification");
                            console.log(response.body);
                        }
                    });
            }
            res.status(200).json({ IsSuccess: true , Count: vendorOrders.length ,Data: vendorOrders , Message: "Order Placed" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Placed" });
        }        
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

var getDaysArray = function(start, end) {
    for(var arr=[],dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
        arr.push(new Date(dt));
    }
    return arr;
};

//All Vendor Order Listing-----------04/01/2021----MONIL
router.post("/vendorOrdersList" , async function(req,res,next){
    const { vendorId , fromDate , ofDate } = req.body;
    
    try {

        let orderData;
        
        if(ofDate && fromDate){
            let isoDate1 = convertStringDateToISO(ofDate);
            let isoDate2 = convertStringDateToISO(fromDate);
            
            console.log(isoDate1);
            console.log(isoDate2);

            orderData = await orderSchema.find({
                vendorId: mongoose.Types.ObjectId(vendorId),
                dateTime: {
                    $gte: isoDate1,
                    $lte: isoDate2,
                },
            })
        }else if(ofDate && fromDate == undefined){
            let isoDate1 = convertStringDateToISO(ofDate);
            let isoDate2 = convertStringDateToISOPlusOne(ofDate);

            orderData = await orderSchema.find({
                vendorId: mongoose.Types.ObjectId(vendorId),
                dateTime: {
                    $gte: isoDate1,
                    $lt: isoDate2,
                },
            })
        } else{
            orderData = await orderSchema.aggregate([
                { 
                    $match : {
                            vendorId: mongoose.Types.ObjectId(vendorId) 
                            }
                }
            ]);
        }
        
        let vendorOrderData = [];
        for(let i=0;i<orderData.length;i++){
            let deliveryNo = orderData[i].multiOrderNo;
            let deliveryData = orderData[i].deliveryPoint;
            let deliveryDate = convertISOToReadable(orderData[i].dateTime);
            let vendorAmountCollect = orderData[i].deliveryPoint.vendorBillAmount == null ? 0 : orderData[i].deliveryPoint.vendorBillAmount;
            let courierCharge = orderData[i].deliveryPoint.customerCourierCharge == null ? 0 : orderData[i].deliveryPoint.customerCourierCharge;
            let courierChargeCollectFromCustomerIs = orderData[i].deliveryPoint.courierChargeCollectFromCustomer == null ? 0 : orderData[i].deliveryPoint.courierChargeCollectFromCustomer;
            let vendorBill = orderData[i].deliveryPoint.vendorBillFinalAmount == null ? 0 : orderData[i].deliveryPoint.vendorBillFinalAmount;
            let PNDBill = orderData[i].chargeOfPND;
            let deliveryStatus = orderData[i].status;
            let orderDataSend = {
                DeliveryNo: deliveryNo,
                DeliveryData: deliveryData,
                DeliveryDate: deliveryDate,
                DeliveryStatus: deliveryStatus,
                VendorAmountCollect: vendorAmountCollect,
                CourierCharge: courierCharge,
                CourierChargeCollectFromCustomerIs: courierChargeCollectFromCustomerIs,
                VendorBill : vendorBill,
            }
            vendorOrderData.push(orderDataSend);
        }
        let pndBillTotalCourierCharge = 0;
        let pndTotalVendorAmount = 0;
        let TotalVendorAmountCollected = 0;
        let TotalVendorCourierCharge = 0;
        
        for(let jk=0;jk<vendorOrderData.length;jk++){
            pndBillTotalCourierCharge = pndBillTotalCourierCharge + parseFloat(vendorOrderData[jk].CourierCharge);
            
            pndTotalVendorAmount = pndTotalVendorAmount + parseFloat(vendorOrderData[jk].VendorBill);

            TotalVendorAmountCollected = TotalVendorAmountCollected + parseFloat(vendorOrderData[jk].VendorAmountCollect);
            if(vendorOrderData[jk].CourierChargeCollectFromCustomerIs == false){
                TotalVendorCourierCharge = TotalVendorCourierCharge + parseFloat(vendorOrderData[jk].CourierCharge);
            }
        }
        // console.log(`Courier : ${pndBillTotalCourierCharge}`);
        // console.log(`Total Amount : ${pndTotalVendorAmount}`);
        if(vendorOrderData.length > 0){
            res.status(200).json({ 
                IsSuccess: true,
                TotalVendorAmountCollectedFromCustomer : TotalVendorAmountCollected,
                TotalCourierChargeVendorPayIs: TotalVendorCourierCharge,
                VendorNetAmount: parseFloat(TotalVendorAmountCollected) - parseFloat(TotalVendorCourierCharge),
                PNDCourierCharge: pndBillTotalCourierCharge, 
                PNDBill: pndTotalVendorAmount, 
                DeliveryCount: orderData.length, 
                Data: vendorOrderData, 
                Message: "Vendor Order Found" 
            });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Found" })
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get DeliverOrder Details------------04/01/2021--------MONIL
router.post("/getDeliveryOrderDetails", async function(req,res,next){
    const { orderMTNo } = req.body;
    try {
        let orderIs = await orderSchema.find({ multiOrderNo: orderMTNo });
        if(orderIs.length == 1){
            res.status(200).json({ IsSuccess: true, Data: orderIs , Message: "Order Data Found" });
        }else{
            res.status(200).json({ IsSuccess: true, Data: [] , Message: "Order Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get All Vendor List 
router.post("/getAllVendor", async function(req,res,next){
    try {
        let vendorsAre = await vendorModelSchema.find();
        if(vendorsAre.length > 0){
            res.status(200).json({ IsSuccess: true ,Count: vendorsAre.length ,Data: vendorsAre , Message: "Vendors Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Empty Vendors List" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get Single Vendor Details -----------------------26/01/2021-------MONIL
router.post("/getVendorDetails",async function(req,res,next){
    try {
        const { vendorId } = req.body;
        let vendorDetails = await vendorModelSchema.aggregate([
            { 
                $match: { _id: mongoose.Types.ObjectId(vendorId) } 
            }
        ]);
        // console.log(vendorDetails);
        if(vendorDetails != null){
            res.status(200).json({ IsSuccess: true , Data: vendorDetails , Message: "Vendor Data Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "No Vendor Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get All Vendor Orders Listing
router.post("/getAllVendorOrderListing",async function(req,res,next){
    const { ofDate , fromDate } = req.body;
    try {
        
        // let vendorOrderIs = await orderSchema.find({ 
        //                                             orderBy : "vendor",
        //                                             dateTime: {
        //                                                 $gte: isoDate1,
        //                                                 $lt: isoDate2,
        //                                             },
        //                                         })
        //                                          .populate({
        //                                              path: "vendorId"
        //                                          });
        let vendorsData = await vendorModelSchema.find();
        // let vendorIds = [];
        // let vendorsOrders = [];
        var vendorOrderData = [];
        for(let j=0;j<vendorsData.length;j++){
            // console.log(vendorsData[j]._id);
            // vendorIds.push(vendorsData[j]._id);
            let orderIs;
            if(ofDate && fromDate){
                let isoDate1 = convertStringDateToISO(ofDate);
                let isoDate2 = convertStringDateToISO(fromDate);
                orderIs = await orderSchema.find({ 
                    vendorId: vendorsData[j]._id,
                    dateTime: {
                        $gte: isoDate1,
                        $lte: isoDate2,
                    }, 
                })
               .populate({
                   path: "vendorId",
                   select: "name mobileNo"
               });
            }else if(ofDate && fromDate == undefined){
                let isoDate1 = convertStringDateToISO(ofDate);
                let isoDate2 = convertStringDateToISOPlusOne(ofDate);
                orderIs = await orderSchema.find({ 
                    vendorId: vendorsData[j]._id,
                    dateTime: {
                        $gte: isoDate1,
                        $lt:  isoDate2,
                    }, 
                })
               .populate({
                   path: "vendorId",
                   select: "name mobileNo"
               });
            } else{
                console.log("-------------------Here------------------------------------------")
                orderIs = await orderSchema.find({ 
                    vendorId: vendorsData[j]._id, 
                })
               .populate({
                   path: "vendorId",
                   select: "name mobileNo"
               });
            }
            // console.log(orderIs.length);
            if(orderIs.length > 0){
                // console.log(orderIs[j]._id);
                for(let i=0;i<orderIs.length;i++){
                    // console.log("Vendor Id : " + orderIs[i].vendorId);
                    // console.log(orderIs[i].vendorId._id);
                    let deliveryNo = orderIs[i].multiOrderNo;
                    let VendorId = orderIs[i].vendorId._id;
                    let VendorName = orderIs[i].vendorId.name;
                    let VendorMobileNo = orderIs[i].vendorId.mobileNo;
                    let deliveryTo = orderIs[i].deliveryPoint;
                    let vendorAmountCollect = orderIs[i].deliveryPoint.vendorBillAmount == null ? 0 : orderIs[i].deliveryPoint.vendorBillAmount;
                    let courierCharge = orderIs[i].deliveryPoint.customerCourierCharge == null ? 0 : orderIs[i].deliveryPoint.customerCourierCharge;
                    let courierChargeCollectFromCustomerIs = orderIs[i].deliveryPoint.courierChargeCollectFromCustomer == null ? 0 : orderIs[i].deliveryPoint.courierChargeCollectFromCustomer;
                    let vendorBill = orderIs[i].deliveryPoint.vendorBillFinalAmount == null ? 0 : orderIs[i].deliveryPoint.vendorBillFinalAmount;
                    // let PNDBill = orderIs[i].chargeOfPND;
                    let deliveryDate = orderIs[i].dateTime;
                    let orderDataSend = {
                        DeliveryNo: deliveryNo,
                        VendorId: VendorId,
                        VendorName: VendorName,
                        DeliveryData: deliveryTo,
                        VendorMobileNo: VendorMobileNo,
                        VendorAmountCollect: vendorAmountCollect,
                        CourierCharge: courierCharge,
                        CourierChargeCollectFromCustomerIs: courierChargeCollectFromCustomerIs,
                        VendorBill : vendorBill,
                        DeliveryDate : deliveryDate,
                        // PNDBill : PNDBill
                    }
                    // console.log(orderDataSend);
                    vendorOrderData.push(orderDataSend);
                }
            }
            // console.log(vendorOrderData);
        }

        // console.log(vendorOrderData);
        if(vendorOrderData.length > 0){
            res.status(200).json({ IsSuccess: true , Count: vendorOrderData.length , Data: vendorOrderData , Message: "All Vendor Orders Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Orders Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Delete Records from demoorder Table
router.post("/delVendorOrder", async function(req,res,next){
    try {
        let delRecord = await orderSchema.deleteMany();
        res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Vendor Order Deleted" });
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message })
    }
});

router.post("/cancelVendorOrder", async function(req,res,next){
    const { orderNo , vendorId } = req.body;
    try {
        let orderIs = await orderSchema.find({ $and: [ { orderNo: orderNo }, { vendorId: vendorId } , { orderBy: "vendor" } ] });
        console.log(orderIs.length);
        for(let jk=0;jk<orderIs.length;jk++){
            console.log(orderIs[jk]._id);
            let updateIs = {
                        status : "Order Cancelled",
                        isActive : false,
                    }
            let cancelOrderIs = await orderSchema.findByIdAndUpdate(orderIs[jk]._id,updateIs);
        }
        res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Order Cancelled" })
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

router.post("/delorder", async function(req,res,next){
    try {
        let del = await orderSchema.find({ vendorId: '6010e5d8a4b0b66089fa1b5c' });
        
        for(let i=0;i<del.length;i++){
            let id = del[i]._id;
            console.log(id);
            let delis = await orderSchema.findByIdAndDelete(id);
        }
        console.log(del.length);
        res.send(del);
    } catch (error) {
        res.status(500).json({ IsSuccess: true , Message: error.message });
    }
});

// router.post("/test",async function(req,res,next){
//     scheduleSampleJob
// });

// let scheduleSampleJob = functions.https.onRequest((req , res) => {
//     /*
//         Say you very specifically want a function to execute at 5:30am on December 
//         21, 2012. Remember - in JavaScript - 0 - January, 11 - December.
//     */
//     var date = new Date(2012, 11, 21, 5, 30, 0);  

//     var j = schedule.scheduleJob(date, function(){
//         console.log('The Task is executed');
//     });
//     return res.status(200).send(`Task has been scheduled`);
// });

//Convert ISO Time To Readable Time----06/01/2021---MONIL
function convertISOToReadable(isoDate){
    // console.log(typeof(isoDate));
    
    // let dateTimeIs = moment(isoDate).format("MMM Do YYYY, h:mm:ss a");
    let dateTimeIs = moment(isoDate).tz("Asia/Calcutta")
    .format("MMM Do YYYY, h:mm:ss a");

    let dateTimeIsforFilter = moment(isoDate).tz("Asia/Calcutta")
    .format("YYYY-MM-DD, h:mm:ss a")
    .split(",")[0];

    // let filterData = dateTimeIsforFilter.split(",")
    
    // console.log(dateTimeIs);
    let dateTimeInList = dateTimeIs.split(",");
    // isoDate = new Date(isoDate);
    // console.log(isoDate);
    // let b = isoDate.toISOString();
    // let temp = b.split("T");
    // let dateList = temp[0].split("-")
    // let dateIs = dateList[2] + "/" + dateList[1] + "/" + dateList[0];   
    // let hour = isoDate.getHours();
    // let minutes = isoDate.getMinutes();
    // let seconds = isoDate.getSeconds();

    // if(hour<10){
    //     hour = "0" + hour;
    // }
    // if(minutes<10){
    //     minutes = "0" + minutes;
    // }
    // if(seconds<10){
    //     seconds = "0" + seconds;
    // }
    
    // let TimeIs = hour + ":" + minutes + ":" + seconds; 
    
    return [dateTimeInList[0],dateTimeInList[1],dateTimeIsforFilter];
}

//Convert String Date to ISO
function convertStringDateToISO(date){
    var dateList = date;
    // console.log(dateList.split("/"));
    let list = dateList.split("/");
    
    let dISO = list[2] + "-" + list[1] + "-" + list[0] + "T" + "00:00:00.00Z";
    // console.log(dISO);
    return dISO;
}

function convertStringDateToISOPlusOne(date){
    var dateList = date;
    // console.log(dateList.split("/"));
    let list = dateList.split("/");
    let datee = parseFloat(list[0]) + 1;
    
    // console.log(datee);
    if(datee < 10){
        datee = "0" + String(datee); 
    }
    // console.log(datee);

    let dISO = list[2] + "-" + list[1] + "-" + datee + "T" + "00:00:00.00Z";
    // console.log(dISO);
    return dISO;
}

//Find Unique values from List
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

module.exports = router;