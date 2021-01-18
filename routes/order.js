//INITIATING LIBRARIES
require("dotenv").config();
var path = require("path");
var fs = require("fs");
var axios = require("axios");
var multer = require("multer");
var express = require("express");
var config = require("../config");
var router = express.Router();
var arraySort = require("array-sort");
const geolib = require("geolib");
// For Third Party Service Call
var request = require('request');
const mongoose = require("mongoose");
let moment = require('moment-timezone');

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

//SCHEMAS
var orderSchema = require("../data_models/order.model");
var courierSchema = require("../data_models/courier.signup.model");
var requestSchema = require("../data_models/order.request.model");
var settingsSchema = require("../data_models/settings.model");
var ExtatimeSchema = require("../data_models/extratime.model");
var customerSchema = require("../data_models/customer.signup.model");
var usedpromoSchema = require("../data_models/used.promocode.model");
var promoCodeSchema = require("../data_models/promocode.model");
var locationLoggerSchema = require("../data_models/location.logger.model");
var courierNotificationSchema = require("../data_models/courier.notification.model");
var deliverytypesSchema = require("../data_models/deliverytype.model");
var categorySchema = require('../data_models/category.model');
var demoOrderSchema = require('../data_models/demoMultiModel');
var scheduleNotificationSchema = require('../data_models/scheduleNotification');
const { json } = require("body-parser");

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

//Return Index Min value of Array Element ------(03/12/2020)
function indexOfMinFromArray(arr) {
    if (arr.length === 0) {
        return -1;
    }
    var min = arr[0];
    var minIndex = 0;
    for (var i = 1; i < arr.length; i++) {
        if (arr[i] < min) {
            minIndex = i;
            min = arr[i];
        }
    }
    return minIndex;
}

//required functions
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
        console.log("ifffffffffff Normal");
        console.log(available);
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
    console.log(available);
    return available;
}

router.post("/testEMP",async function(req,res,next){
    PNDfinder("21.186025822785844" , "72.79283153971866" , "5ff979b382a5b2719caf3ac6","Normal Delivery")
});

//PND Finder for Multiple delivery Order-----06/01/2021----MONIL
async function PNDMTfinder(pickuplat, pickuplong, orderid, deliveryType) {
    let available = [];
    let getpndpartners = await courierSchema
        .find({
            isActive: true,
            isVerified: true,
            "accStatus.flag": true,
        })
        .select("id fcmToken");

    if (deliveryType == "Normal Delivery") {
        for (let i = 0; i < getpndpartners.length; i++) {
            let partnerlocation = await currentLocation(getpndpartners[i].id);
            if (
                (partnerlocation.duty == "ON") &
                (Number(partnerlocation.parcel) < 3)
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
                        // console.log(partnerlocation);
                        // console.log(pickupcoords, partnercoords)
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

    return available;
}

function getOrderNumber() {
    let orderNo = "ORD-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}
// send sms
function sendMessages(mobileNo, message) {
    // let msgportal =
    //     "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" +
    //     process.env.SMS_USER +
    //     "&password=" +
    //     process.env.SMS_PASS +
    //     "&msisdn=" +
    //     mobileNo +
    //     "&sid=" +
    //     process.env.SMS_SID +
    //     "&msg=" +
    //     message +
    //     "&fl=0&gwid=2";
    // console.log("xs------------------------------");
    let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + mobileNo + "&text= " + message;
    console.log("--------------------SEND TEXT---------------------------");
    console.log(msgportal);
    axios.get(msgportal);
    var data = axios.get(msgportal);
    return data;
}

router.post("/sendText", async function(req,res,next){
    try {
        var aa = await sendMessages(8200682175,"hello");
        console.log(aa);
        res.status(200).json({ IsSuccess: true , Message: "Send...!!!" });    
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

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

//customers app APIs
router.post("/settings", async function (req, res, next) {
    try {
        let getsettings = await settingsSchema.find({});
        let getdeliverytypes = await deliverytypesSchema.find({});

        let predata = [{
            settings: getsettings,
            deliverytypes: getdeliverytypes,
        },];

        res.status(200).json({
            Message: "Settings Found!",
            Data: predata,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/ordercalc", async (req, res, next) => {
    const {
        picklat,
        picklong,
        droplat,
        droplong,
        deliverytype,
        promocode,
    } = req.body;

    let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
    let tolocation = { latitude: Number(droplat), longitude: Number(droplong) };
    let prmcodes = await promoCodeSchema.find({ code: promocode });
    let settings = await settingsSchema.find({});
    let delivery = await deliverytypesSchema.find({});
    let totaldistance = await GoogleMatrix(fromlocation, tolocation);

    let basickm = 0;
    let basicamt = 0;
    let extrakm = 0;
    let extraamt = 0;
    let extadeliverycharges = 0;
    let promoused = 0;
    let amount = 0;
    let totalamt = 0;

    if (totaldistance <= 5) {
        if (deliverytype == "Normal Delivery") {
            basickm = totaldistance;
            basicamt = settings[0].PerUnder5KM;
            extrakm = 0;
            extraamt = 0;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            promoused =
                prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
            totalamt = amount - promoused;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    basickm = totaldistance;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = 0;
                    extraamt = 0;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    promoused =
                        prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
                    totalamt = amount - promoused;
                }
            }
        }
    } else {
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            extrakm = remdis;
            extraamt = remdis * settings[0].PerKM;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            promoused =
                prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
            totalamt = amount - promoused;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = remdis;
                    extraamt = remdis * settings[0].PerKM;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    promoused =
                        prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
                    totalamt = amount - promoused;
                }
            }
        }
    }

    let dataset = [{
        totaldistance: totaldistance.toFixed(2),
        basickm: basickm.toFixed(2),
        basicamt: basicamt.toFixed(2),
        extrakm: extrakm.toFixed(2),
        extraamt: extraamt.toFixed(2),
        extadeliverycharges: extadeliverycharges.toFixed(2),
        amount: amount.toFixed(2),
        promoused: promoused.toFixed(2),
        totalamt: totalamt.toFixed(2),
    },];

    res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
});


router.post("/ordercalcV2", async (req, res, next) => {
    const {
        picklat,
        picklong,
        droplat,
        droplong,
        deliverytype,
        promocode,
        parcelcontents
    } = req.body;

    // console.log("OrderCalcV2 Request Body.................!!!!");
    // console.log(req.body);

    let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
    let tolocation = { latitude: Number(droplat), longitude: Number(droplong) };
    let prmcodes = await promoCodeSchema.find({ code: promocode });
    let settings = await settingsSchema.find({});
    let delivery = await deliverytypesSchema.find({});
    let totaldistance = await GoogleMatrix(fromlocation, tolocation);

    let basickm = 0;
    let basicamt = 0;
    let extrakm = 0;
    let extraamt = 0;
    let extadeliverycharges = 0;
    let promoused = 0;
    let amount = 0;
    let totalamt = 0;

    if (totaldistance <= 5) {
        if (deliverytype == "Normal Delivery") {
            basickm = totaldistance;
            basicamt = settings[0].PerUnder5KM;
            extrakm = 0;
            extraamt = 0;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    basickm = totaldistance;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = 0;
                    extraamt = 0;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    } else {
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            extrakm = remdis;
            extraamt = remdis * settings[0].PerKM;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = remdis;
                    extraamt = remdis * settings[0].PerKM;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    }

    let distamt = Number(basicamt.toFixed(2)) + Number(extraamt.toFixed(2));
    distamt = (Math.round(distamt) % 10) > 5 ? round(distamt, 10) : round(distamt, 5);
    let note;
    //Find Parcel Content From Database
    let parcelContentsList = [];
    for (let e = 0; e < parcelcontents.length; e++) {
        let data = await categorySchema.findOne({ title: parcelcontents[e] });
        if (e == 0) {
            note = data.note;
        }
        parcelContentsList.push(data);
    }
    
    //Find ExtraCharges
    let sortParcelContents = arraySort(parcelContentsList, 'price', { reverse: true });
    let extracharges = 0;
    for (let a = 0; a < sortParcelContents.length; a++) {
        extracharges = extracharges + sortParcelContents[a].price;
    }

    let amt = Number(distamt) + extracharges + Math.ceil(extadeliverycharges.toFixed(2));
    promoused = prmcodes.length != 0 ? (amt * prmcodes[0].discount) / 100 : 0;
    let netamount = amt - Math.ceil(promoused.toFixed(2));

    //TESTING FCMTOKEN
    let AdminMobile = await settingsSchema.find({}).select('AdminMObile1 AdminMObile2 AdminMObile3 AdminMObile4 AdminMObile5 -_id');
    console.log("Admin numbers-------------------------------------------------");
    let AdminNumber1 = AdminMobile[0].AdminMObile1; 
    let AdminNumber2 = AdminMobile[0].AdminMObile2; 
    let AdminNumber3 = AdminMobile[0].AdminMObile3; 
    let AdminNumber4 = AdminMobile[0].AdminMObile4; 
    let AdminNumber5 = AdminMobile[0].AdminMObile5;

    // var newUserPromocodeLimit = await settingsSchema.find().select("NewUserUnderKm");
    // var userPastOrders = await orderSchema.find({
    //     customerId : mongoose.Types.ObjectId(customerId),
    // });

    // if(userPastOrders.length == 0 && totaldistance < newUserPromocodeLimit[0].NewUserUnderKm){
    //     var dataset
    // }else{
        
    // }
    console.log("-------------Basics----------------");
    console.log(basicamt);
    console.log(extrakm);
    console.log(extraamt);
    console.log(amount);
    
    dataset = [{
        note: note,
        totaldistance: Math.round(totaldistance.toFixed(2)),
        totaldistamt: Number(distamt),
        extracharges: extracharges,
        extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
        amount: amt,
        promoused: Math.ceil(promoused.toFixed(2)),
        totalamt: netamount
    },];
    console.log(dataset);

    res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
});

router.post("/ordercalcV3", async (req, res, next) => {
    const {
        customerId,
        picklat,
        picklong,
        droplat,
        droplong,
        deliverytype,
        promocode,
        parcelcontents,
        amountCollected,
    } = req.body;

    // console.log("OrderCalcV2 Request Body.................!!!!");
    // console.log(req.body);

    let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
    let tolocation = { latitude: Number(droplat), longitude: Number(droplong) };
    let prmcodes = await promoCodeSchema.find({ code: promocode });
    let settings = await settingsSchema.find({});
    let delivery = await deliverytypesSchema.find({});
    let totaldistance = await GoogleMatrix(fromlocation, tolocation);

    let basickm = 0;
    let basicamt = 0;
    let extrakm = 0;
    let extraamt = 0;
    let extadeliverycharges = 0;
    let promoused = 0;
    let amount = 0;
    let totalamt = 0;
    let aboveKmCharge = 0;

    var newUserpromocode = await promoCodeSchema.find({ isForNewUser: true });

    if (totaldistance <= 5) {
        if (deliverytype == "Normal Delivery") {
            basickm = totaldistance;
            basicamt = settings[0].PerUnder5KM;
            extrakm = 0;
            extraamt = 0;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    basickm = totaldistance;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = 0;
                    extraamt = 0;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    }else if(totaldistance >= settings[0].additionalKm){
        console.log("Hello----IN 10KM CHARGE ABOVE KM------------");
        console.log(settings[0].addKmCharge);
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            aboveKmCharge = settings[0].addKmCharge;
            extrakm = remdis;
            extraamt = (remdis * settings[0].PerKM) + aboveKmCharge;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    aboveKmCharge = settings[0].addKmCharge;
                    extrakm = remdis;
                    extraamt = (remdis * settings[0].PerKM) + aboveKmCharge;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    } else {
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            extrakm = remdis;
            extraamt = remdis * settings[0].PerKM;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = remdis;
                    extraamt = remdis * settings[0].PerKM;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    }

    var userPastOrders = await orderSchema.find({
        customerId : mongoose.Types.ObjectId(customerId),
    });

    if(userPastOrders.length == 0 && totaldistance < settings[0].NewUserUnderKm){
        console.log(totaldistance);
        let newUserBasicPrice = parseFloat(settings[0].NewUserprice);
        var distamt = Number(newUserBasicPrice.toFixed(2)) + Number(extraamt.toFixed(2));
        distamt = (Math.round(distamt) % 10) > 5 ? round(distamt, 10) : round(distamt, 5);
    }else{
        distamt = Number(basicamt.toFixed(2)) + Number(extraamt.toFixed(2));
        distamt = (Math.round(distamt) % 10) > 5 ? round(distamt, 10) : round(distamt, 5);
    }
    
    let note;
    //Find Parcel Content From Database
    let parcelContentsList = [];
    for (let e = 0; e < parcelcontents.length; e++) {
        let data = await categorySchema.findOne({ title: parcelcontents[e] });
        if (e == 0) {
            note = data.note;
        }
        parcelContentsList.push(data);
    }
    
    //Find ExtraCharges
    let sortParcelContents = arraySort(parcelContentsList, 'price', { reverse: true });
    let extracharges = 0;
    for (let a = 0; a < sortParcelContents.length; a++) {
        extracharges = extracharges + sortParcelContents[a].price;
    }

    let amt = Number(distamt) + extracharges + Math.ceil(extadeliverycharges.toFixed(2));
    promoused = prmcodes.length != 0 ? (amt * prmcodes[0].discount) / 100 : 0;
    let netamount = amt - Math.ceil(promoused.toFixed(2));

    //TESTING FCMTOKEN
    let AdminMobile = await settingsSchema.find({}).select('AdminMObile1 AdminMObile2 AdminMObile3 AdminMObile4 AdminMObile5 -_id');
    console.log("Admin numbers-------------------------------------------------");
    let AdminNumber1 = AdminMobile[0].AdminMObile1; 
    let AdminNumber2 = AdminMobile[0].AdminMObile2; 
    let AdminNumber3 = AdminMobile[0].AdminMObile3; 
    let AdminNumber4 = AdminMobile[0].AdminMObile4; 
    let AdminNumber5 = AdminMobile[0].AdminMObile5;

    var newUserPromocodeLimit = await settingsSchema.find().select("NewUserUnderKm");
    
    console.log(userPastOrders.length);
    console.log(totaldistance);
    console.log(newUserPromocodeLimit[0].NewUserUnderKm);
    console.log("-------------Basics out----------------");
        console.log(basicamt);
        console.log(extrakm);
        console.log(extraamt);
        console.log(amount);
    console.log("----------------NAN-------------------");
    console.log(distamt);
    console.log(amt);
    console.log(totalamt);

    if(userPastOrders.length == 0 && totaldistance < newUserPromocodeLimit[0].NewUserUnderKm && newUserpromocode.length == 1){
        console.log("-------------in-------------------");
        if (totaldistance <= 5) {
            if (deliverytype == "Normal Delivery") {
                basickm = totaldistance;
                basicamt = settings[0].NewUserprice;
                extrakm = 0;
                extraamt = 0;
                extadeliverycharges = delivery[0].cost;
                amount = basicamt + extraamt + extadeliverycharges;
                totalamt = amount;
            } else {
                for (let i = 1; i < delivery.length; i++) {
                    if (deliverytype == delivery[i].title) {
                        basickm = totaldistance;
                        basicamt = settings[0].NewUserprice;
                        extrakm = 0;
                        extraamt = 0;
                        extadeliverycharges = delivery[i].cost;
                        amount = basicamt + extraamt + extadeliverycharges;
                        totalamt = amount;
                    }
                }
            }
        } else {
            if (deliverytype == "Normal Delivery") {
                console.log("--------------------Normal--------------------");
                let remdis = totaldistance - 5;
                basickm = 5;
                basicamt = settings[0].NewUserprice;
                extrakm = remdis;
                extraamt = remdis * settings[0].PerKM;
                extadeliverycharges = delivery[0].cost;
                amount = basicamt + extraamt + extadeliverycharges;
                totalamt = amount;
            } else {
                console.log("Express---")
                for (let i = 1; i < delivery.length; i++) {
                    if (deliverytype == delivery[i].title) {
                        let remdis = totaldistance - 5;
                        basickm = 5;
                        basicamt = settings[0].NewUserprice;
                        extrakm = remdis;
                        extraamt = remdis * settings[0].PerKM;
                        extadeliverycharges = delivery[i].cost;
                        amount = basicamt + extraamt + extadeliverycharges;
                        totalamt = amount;
                    }
                }
            }
        }
        // console.log("-------------Basics----------------");
        console.log(basicamt);
        console.log(extrakm);
        console.log(extraamt);
        console.log(amount);

        // let discountPercent = newUserpromocode[0].discount;
        // console.log("-------------------Discount % -----------------");
        // console.log(discountPercent);
        // let NewUserDiscountAmount = (parseFloat(amount) * parseFloat(discountPercent)) / 100;
        // console.log("--------------New User Discount Amount---------------");
        // NewUserDiscountAmount = (Math.round(NewUserDiscountAmount) % 10) > 5 ? round(NewUserDiscountAmount, 10) : round(NewUserDiscountAmount, 5);
        // console.log(NewUserDiscountAmount);
        // let NewUserNetAmount = parseFloat(amount) - parseFloat(NewUserDiscountAmount);
        // console.log("---------------Net Amount-------------------");
        // console.log(NewUserNetAmount);
        // NewUserNetAmount = (Math.round(NewUserNetAmount) % 10) > 5 ? round(NewUserNetAmount, 10) : round(NewUserNetAmount, 5);
        // var dataset = [{
        //     note: note,
        //     totaldistance: Math.round(totaldistance.toFixed(2)),
        //     totaldistamt: Number(distamt),
        //     extracharges: extracharges,
        //     extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
        //     amount: amt,
        //     promoused: Math.ceil(NewUserDiscountAmount),
        //     totalamt: NewUserNetAmount
        // },];
        console.log("----------Basic AMT--------------");
        console.log(basicamt);
        console.log("--------------------In New User-----------------------");
        var newUserPromocode = await promoCodeSchema.find({ isForNewUser: true });
        
        if(req.body.amountCollected){
            var handlingChargeIs = parseFloat(settings[0].handling_charges);
            console.log("--------------------Handling Charge-----------------------");
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            console.log(netamount);
            let temp = amountCollected == null ? "0" : amountCollected;
            console.log("-----------Yeah---------------");
            console.log(temp);
            let additionalChargeOfHandling = parseFloat(temp) * parseFloat(handlingChargeIs);
            console.log("---------------Amount Collected---------------");
            console.log(amountCollected);
            console.log("--------------Addtion HAndling Charge-------------");
            console.log(additionalChargeOfHandling); 
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                HandlingCharge: additionalChargeOfHandling,
                totalamt: netamount + additionalChargeOfHandling,
                promoCode: newUserPromocode
            },];
        }else{
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                totalamt: netamount,
                promoCode: newUserPromocode
            },];
        }
            
    }else{
        if(req.body.amountCollected){
            var handlingChargeIs = parseFloat(settings[0].handling_charges);
            console.log("--------------------Handling Charge-----------------------");
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            console.log(netamount);
            let temp = amountCollected == null ? "0" : amountCollected;
            console.log("-----------Yeah---------------");
            console.log(temp);
            let additionalChargeOfHandling = parseFloat(temp) * parseFloat(handlingChargeIs);
            console.log("---------------Amount Collected---------------");
            console.log(amountCollected);
            console.log("--------------Addtion HAndling Charge-------------");
            console.log(additionalChargeOfHandling); 
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                HandlingCharge: additionalChargeOfHandling,
                totalamt: netamount + additionalChargeOfHandling
            },];
        }else{
            console.log("--------------------Out-----------------------");
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                totalamt: netamount
            },];
        }
        
        console.log(dataset);
    }
    if(req.body.amountCollected){
        let chargeIs = handlingChargeIs * 100 + "%";
        res.json({ Message: "Calculation Found!", HandlingCharge: chargeIs ,Data: dataset, IsSuccess: true });
    }else{
        res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
    }
});

//---------------------------Checking-------------------------(26-12-2020)

router.post("/testingM", async function(req,res,next){
    const {
        // customerId,
        picklat,
        picklong,
        deliveryPoints,
        // deliverytype,
        // promocode,
        // parcelcontents,
        // amountCollected,
    } = req.body;
    try {
        let tempDistanceForALL = 0;
        let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
        

        for(let i=0;i<deliveryPoints.length;i++){
            let lat3 = parseFloat(deliveryPoints[i].lat);
            let long3 = parseFloat(deliveryPoints[i].long);
            let tolocation = { latitude: Number(lat3), longitude: Number(long3) };
            console.log(fromlocation);
            console.log(tolocation);
            let totaldistance = await GoogleMatrix(fromlocation, tolocation);
            // console.log(totaldistance);
            tempDistanceForALL = tempDistanceForALL + totaldistance;
        }
        console.log("dis :"+tempDistanceForALL);
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
    
    // console.log(deliveryPoints);
    // let a = deliveryPoints[0].lat;
    // console.log(a);
});

//----------------------------OrderCalcV4(Addtional charges for above 10KM)--------------------

router.post("/ordercalcV4", async (req, res, next) => {
    const {
        customerId,
        picklat,
        picklong,
        deliveryPoints,
        deliverytype,
        promocode,
        parcelcontents,
        amountCollectionList, //Based on this calculate amount calc below--09/01/2021(pending)
    } = req.body;

    let amountCollected;
        amountCollected = amountCollectionList.reduce(function(res,curr){
            return res + curr;
        },0);
        console.log("------------------------------Amount Collect Here Is------------------");
        console.log(amountCollected);

    let tempDistanceForALL = 0;

    let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
    
    for(let i=0;i<deliveryPoints.length;i++){
        let lat3 = parseFloat(deliveryPoints[i].lat);
        let long3 = parseFloat(deliveryPoints[i].long);
        let tolocation = { latitude: Number(lat3), longitude: Number(long3) };
        
        let totaldistance = await GoogleMatrix(fromlocation, tolocation);
        
        tempDistanceForALL = tempDistanceForALL + totaldistance;
    }
    console.log(tempDistanceForALL);

    let prmcodes = await promoCodeSchema.find({ code: promocode });
    let settings = await settingsSchema.find({});
    let delivery = await deliverytypesSchema.find({});
    console.log("Delivery Check :"+ delivery.length);
    // let totaldistance = await GoogleMatrix(fromlocation, tolocation);
    let totaldistance = tempDistanceForALL;

    let basickm = 0;
    let basicamt = 0;
    let extrakm = 0;
    let extraamt = 0;
    let extadeliverycharges = 0;
    let promoused = 0;
    let amount = 0;
    let totalamt = 0;
    let aboveKmCharge = 0;

    var newUserpromocode = await promoCodeSchema.find({ isForNewUser: true });

    console.log("additionalKm :" + settings[0].additionalKm)
    console.log("addKmCharge : " + settings[0].addKmCharge)

    if (totaldistance <= 5) {
        if (deliverytype == "Normal Delivery") {
            basickm = totaldistance;
            basicamt = settings[0].PerUnder5KM;
            extrakm = 0;
            extraamt = 0;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    basickm = totaldistance;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = 0;
                    extraamt = 0;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    }else if(totaldistance >= settings[0].additionalKm){
        console.log("Hello----IN 10KM CHARGE ABOVE KM------------");
        console.log(settings[0].addKmCharge);
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            aboveKmCharge = settings[0].addKmCharge;
            extrakm = remdis;
            extraamt = (remdis * settings[0].PerKM) + aboveKmCharge;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    aboveKmCharge = settings[0].addKmCharge;
                    extrakm = remdis;
                    extraamt = (remdis * settings[0].PerKM) + aboveKmCharge;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    } else {
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            extrakm = remdis;
            extraamt = remdis * settings[0].PerKM;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = remdis;
                    extraamt = remdis * settings[0].PerKM;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    }
    // console.log("MAin Checkkkkkkkkkkkk....!!!!!!1 :"+ basicamt);

    var userPastOrders = await orderSchema.find({
        customerId : mongoose.Types.ObjectId(customerId),
    });

    if(userPastOrders.length == 0 && totaldistance < settings[0].NewUserUnderKm){
        console.log("New User DisAmt Calc :"+totaldistance);
        let newUserBasicPrice = parseFloat(settings[0].NewUserprice);
        var distamt = Number(newUserBasicPrice.toFixed(2)) + Number(extraamt.toFixed(2));
        distamt = (Math.round(distamt) % 10) > 5 ? round(distamt, 10) : round(distamt, 5);
    }else{
        console.log("Checking distamt");
        distamt = Number(basicamt.toFixed(2)) + Number(extraamt.toFixed(2));
        distamt = (Math.round(distamt) % 10) > 5 ? round(distamt, 10) : round(distamt, 5);
    }
    
    let note;
    //Find Parcel Content From Database
    let parcelContentsList = [];
    // parcelcontents == undefined ? 0 : parcelcontents;
    for (let e = 0; e < parcelcontents.length; e++) {
        let data = await categorySchema.findOne({ title: parcelcontents[e] });
        if (e == 0) {
            note = data.note;
        }
        parcelContentsList.push(data);
    }
    
    //Find ExtraCharges
    let sortParcelContents = arraySort(parcelContentsList, 'price', { reverse: true });
    let extracharges = 0;
    for (let a = 0; a < sortParcelContents.length; a++) {
        extracharges = extracharges + sortParcelContents[a].price;
    }

    let amt = Number(distamt) + extracharges + Math.ceil(extadeliverycharges.toFixed(2));
    promoused = prmcodes.length != 0 ? (amt * prmcodes[0].discount) / 100 : 0;
    let netamount = amt - Math.ceil(promoused.toFixed(2));

    var newUserPromocodeLimit = await settingsSchema.find().select("NewUserUnderKm");
    
    console.log(userPastOrders.length);
    console.log(totaldistance);
    console.log(newUserPromocodeLimit[0].NewUserUnderKm);
    console.log("-------------Basics out----------------");
        console.log(basicamt);
        console.log(extrakm);
        console.log(extraamt);
        console.log(amount);
    console.log("----------------NAN-------------------");
    console.log(distamt);
    console.log(amt);
    console.log(totalamt);

    if(userPastOrders.length == 0 && totaldistance < newUserPromocodeLimit[0].NewUserUnderKm && newUserpromocode.length == 1){
        console.log("-------------in-------------------");
        if (totaldistance <= 5) {
            if (deliverytype == "Normal Delivery") {
                basickm = totaldistance;
                basicamt = settings[0].NewUserprice;
                extrakm = 0;
                extraamt = 0;
                extadeliverycharges = delivery[0].cost;
                amount = basicamt + extraamt + extadeliverycharges;
                totalamt = amount;
            } else {
                for (let i = 1; i < delivery.length; i++) {
                    if (deliverytype == delivery[i].title) {
                        basickm = totaldistance;
                        basicamt = settings[0].NewUserprice;
                        extrakm = 0;
                        extraamt = 0;
                        extadeliverycharges = delivery[i].cost;
                        amount = basicamt + extraamt + extadeliverycharges;
                        totalamt = amount;
                    }
                }
            }
        } else {
            if (deliverytype == "Normal Delivery") {
                let remdis = totaldistance - 5;
                basickm = 5;
                basicamt = settings[0].NewUserprice;
                extrakm = remdis;
                extraamt = remdis * settings[0].PerKM;
                extadeliverycharges = delivery[0].cost;
                amount = basicamt + extraamt + extadeliverycharges;
                totalamt = amount;
            } else {
                for (let i = 1; i < delivery.length; i++) {
                    if (deliverytype == delivery[i].title) {
                        let remdis = totaldistance - 5;
                        basickm = 5;
                        basicamt = settings[0].NewUserprice;
                        extrakm = remdis;
                        extraamt = remdis * settings[0].PerKM;
                        extadeliverycharges = delivery[i].cost;
                        amount = basicamt + extraamt + extadeliverycharges;
                        totalamt = amount;
                    }
                }
            }
        }
        // console.log("-------------Basics----------------");
        console.log(basicamt);
        console.log(extrakm);
        console.log(extraamt);
        console.log(amount);

        console.log("----------Basic AMT--------------");
        console.log(basicamt);
        console.log("--------------------In New User-----------------------");
        var newUserPromocode = await promoCodeSchema.find({ isForNewUser: true });
        
        if(amountCollectionList.length > 0){
            var handlingChargeIs = parseFloat(settings[0].handling_charges);
            console.log("--------------------Handling Charge-----------------------");
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            console.log(netamount);
            let temp = amountCollected == null ? "0" : amountCollected;
            console.log("-----------Yeah---------------");
            console.log(temp);
            let additionalChargeOfHandling = parseFloat(temp) * parseFloat(handlingChargeIs);
            console.log("---------------Amount Collected---------------");
            console.log(amountCollected);
            console.log("--------------Addtion HAndling Charge-------------");
            console.log(additionalChargeOfHandling); 
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                HandlingCharge: additionalChargeOfHandling,
                totalamt: netamount + additionalChargeOfHandling,
                promoCode: newUserPromocode
            },];
        }else{
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                totalamt: netamount,
                promoCode: newUserPromocode
            },];
        }
            
    }else{
        if(amountCollectionList.length > 0){
            var handlingChargeIs = parseFloat(settings[0].handling_charges);
            console.log("--------------------Handling Charge-----------------------");
            console.log(distamt);
            console.log(amt);
            console.log(totalamt);
            console.log(netamount);
            let temp = amountCollected == null ? "0" : amountCollected;
            console.log("-----------Yeah---------------");
            console.log(temp);
            let additionalChargeOfHandling = parseFloat(temp) * parseFloat(handlingChargeIs);
            console.log("---------------Amount Collected---------------");
            console.log(amountCollected);
            console.log("--------------Addtion HAndling Charge-------------");
            console.log(additionalChargeOfHandling); 
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                HandlingCharge: additionalChargeOfHandling,
                totalamt: netamount + additionalChargeOfHandling
            },];
        }else{
            console.log("--------------------Out-----------------------");
            console.log("Out DistAMT :"+distamt);
            console.log("Out AMT :"+amt);
            console.log("Out TotalAMT :"+totalamt);
            dataset = [{
                note: note,
                totaldistance: Math.round(totaldistance.toFixed(2)),
                totaldistamt: Number(distamt),
                extracharges: extracharges,
                extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
                amount: amt,
                promoused: Math.ceil(promoused.toFixed(2)),
                totalamt: netamount
            },];
        }
        
        console.log(dataset);
    }
    if(req.body.amountCollected){
        let chargeIs = handlingChargeIs * 100 + "%";
        res.json({ Message: "Calculation Found!", HandlingCharge: chargeIs ,Data: dataset, IsSuccess: true });
    }else{
        res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
    }
});

//------------------OrderCalcV4 END---------------------------------------------------

var round = function (num, precision) {
    num = parseFloat(num);
    if (!precision) return num.toLocaleString();
    return (Math.round(num / precision) * precision).toLocaleString();
};

router.post("/newoder", orderimg.single("orderimg"), async function (
    req,
    res,
    next
) {
    // console.log("Neworder api...............................!!!");
    // console.log(req.body);
    
    const {
        customerId,
        deliveryType,
        weightLimit,
        pkName,
        pkMobileNo,
        pkAddress,
        pkLat,
        pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        dpName,
        dpMobileNo,
        dpAddress,
        dpLat,
        dpLong,
        dpCompleteAddress,
        dpDistance,
        collectCash,
        promoCode,
        amount,
        discount,
        additionalAmount,
        finalAmount,
        schedualDateTime,
    } = req.body;
    console.log("-------------New Order--------------------------");
    console.log(req.body.amount);
    console.log(req.body.amount);
    console.log(req.body.discount);
    console.log(req.body.additionalAmount);
    console.log(req.body.finalAmount);
    const file = req.file;
    let num = getOrderNumber();
    try {
        var newOrder = new orderSchema({
            _id: new config.mongoose.Types.ObjectId(),
            orderNo: num,
            customerId: customerId,
            deliveryType: deliveryType,
            schedualDateTime: schedualDateTime,
            weightLimit: weightLimit,
            orderImg: file == undefined ? "" : file.path,
            pickupPoint: {
                name: pkName,
                mobileNo: pkMobileNo,
                address: pkAddress,
                lat: pkLat,
                long: pkLong,
                completeAddress: pkCompleteAddress,
                contents: pkContent,
                arriveType: pkArriveType,
                arriveTime: pkArriveTime,
            },
            deliveryPoint: {
                name: dpName,
                mobileNo: dpMobileNo,
                address: dpAddress,
                lat: dpLat,
                long: dpLong,
                completeAddress: dpCompleteAddress,
                distance: dpDistance,
            },
            collectCash: collectCash,
            promoCode: promoCode,
            amount: amount,
            discount: discount,
            additionalAmount: additionalAmount,
            finalAmount: finalAmount,
            status: "Order Processing",
            note: "Your order is processing!",
        });
        var placedorder = await newOrder.save();
            var avlcourier = await PNDfinder(
                pkLat,
                pkLong,
                placedorder.id,
                placedorder.deliveryType
            );
        
        if (promoCode != "0") {
            let usedpromo = new usedpromoSchema({
                _id: new config.mongoose.Types.ObjectId(),
                customer: customerId,
                code: promoCode,
            });
            usedpromo.save();
        }
        if (placedorder != null && avlcourier.length != 0) {
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
    
    console.log(AdminNumber1);

    var findAdminFcmToken = await customerSchema.find({ mobileNo: AdminNumber1 }).select('fcmToken -_id');
    var findAdminFcmToken2 = await customerSchema.find({ mobileNo: AdminNumber2 }).select('fcmToken -_id');
    var findAdminFcmToken3 = await customerSchema.find({ mobileNo: AdminNumber3 }).select('fcmToken -_id');
    var findAdminFcmToken4 = await customerSchema.find({ mobileNo: AdminNumber4 }).select('fcmToken -_id');
    var findAdminFcmToken5 = await customerSchema.find({ mobileNo: AdminNumber5 }).select('fcmToken -_id');
    
    // console.log(findAdminFcmToken);
    // console.log(findAdminFcmToken2);
    // console.log(findAdminFcmToken3);
    // console.log(findAdminFcmToken4);
    // console.log(findAdminFcmToken5);

    var AdminFcmToken = [findAdminFcmToken[0].fcmToken,findAdminFcmToken2[0].fcmToken,findAdminFcmToken3[0].fcmToken,findAdminFcmToken4[0].fcmToken,findAdminFcmToken5[0].fcmToken];
    console.log("-------------------------ADMINS TOKENS-----------------------------");
    console.log(AdminFcmToken);

    let newOrderData = newOrder.orderNo;
    let newOrderPickUp = newOrder.pickupPoint.address;
    let newOrderDelivery = newOrder.deliveryPoint.address;
    let newOrderCustomerId = newOrder.customerId;
    console.log(newOrderCustomerId);
    let newOrderCustomer = await customerSchema.find({ _id: newOrderCustomerId }).select('name mobileNo -_id');
    
    let newOrderNotification = `New Order Received 
    OrderID: ${newOrderData}
    Customer: ${newOrderCustomer[0].name}
    Mobile: ${newOrderCustomer[0].mobileNo}  
    PickUp: ${newOrderPickUp}`;
    console.log(newOrderNotification);


    var AdminPhoneNumbers = [AdminNumber1,AdminNumber2,AdminNumber3,AdminNumber4,AdminNumber5];
            // var payload2 = {
            //     notification: {
            //         title: "Order Alert",
            //         body: "New Order Alert Found For You.",
            //     },
            //     data: {
            //         sound: "surprise.mp3",
            //         Message: "Hello New Order",
            //         click_action: "FLUTTER_NOTIFICATION_CLICK",
            //     },
            // };
            // var options2 = {
            //     priority: "high",
            //     timeToLive: 60 * 60 * 24,
            // };
            // config.firebase
            //     .messaging()
            //     .sendToDevice(AdminFcmToken, payload2, options2)
            //     .then((doc) => {
            //         console.log("Sending Notification Testing3.......!!!");
            //         console.log(doc);
            //     });
            // config.firebase
            // .messaging()
            // .sendToDevice(AdminFcmToken, payload2, options2)
            // .then((doc) => {                    
            //     console.log("Sending Notification Testing2.......!!!");
            //     console.log(doc);
            // });    
            // orderstatus[0]["isActive"] == true &&
            // orderstatus[0]["status"] == "Order Processing"

            //Send notification to Admin FCM
            
            //Sending FCM Notification to Admin
            console.log(AdminFcmToken.length);
        for(let i=0;i<AdminFcmToken.length;i++){
            console.log(`--------------------------------------- ${i}`);
            console.log(AdminFcmToken[i])
            var dataSendToAdmin = {
                "to":AdminFcmToken[i],
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

        } else {
            console.log("No Courier Boys Available:: Waiting For Admin Response");
            var updateorder = {
                status: "Admin",
            };
            await orderSchema.findByIdAndUpdate(placedorder.id, updateorder);
        }
        res
            .status(200)
            .json({ Message: "Order Placed!", Data: 1, IsSuccess: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/newoder2", orderimg.single("orderimg"), async function (
    req,
    res,
    next
) {
    // console.log("Neworder api...............................!!!");
    // console.log(req.body);
    
    const {
        customerId,
        deliveryType,
        weightLimit,
        pkName,
        pkMobileNo,
        pkAddress,
        pkLat,
        pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        dpName,
        dpMobileNo,
        dpAddress,
        dpLat,
        dpLong,
        dpCompleteAddress,
        dpDistance,
        collectCash,
        promoCode,
        amount,
        discount,
        additionalAmount,
        finalAmount,
        // schedualDateTime,
        scheduleDate,
        scheduleTime,
        amountCollection,
        // eOrderDeliveryType,
        handlingCharge,
        TransactionId,
        noteByCustomer,
        extraKmByCourierBoy,
    } = req.body;
    console.log("-------------New Order--------------------------");
    console.log(scheduleTime);
    // console.log(req.body.amount);
    // console.log(req.body.amount);
    // console.log(req.body.discount);
    // console.log(req.body.additionalAmount);
    // console.log(req.body.finalAmount);
    var settings = await settingsSchema.find();
    var handlingChargeIs = parseFloat(settings[0].handling_charges);
    const file = req.file;
    let num = getOrderNumber();
    try {
        
        console.log("-------------Schedule Time-------------------");
        // console.log(req.body.schedualDateTime);
        var newOrder = new orderSchema({
            _id: new config.mongoose.Types.ObjectId(),
            orderNo: num,
            customerId: customerId,
            deliveryType: deliveryType,
            // schedualDateTime: schedualDateTime,
            scheduleDate: scheduleDate,
            scheduleTime: scheduleTime,
            weightLimit: weightLimit,
            noteByCustomer: noteByCustomer,
            extraKmByCourierBoy: extraKmByCourierBoy == undefined ? 0 : extraKmByCourierBoy,
            orderImg: file == undefined ? "" : file.path,
            pickupPoint: {
                name: pkName,
                mobileNo: pkMobileNo,
                address: pkAddress,
                lat: pkLat,
                long: pkLong,
                completeAddress: pkCompleteAddress,
                contents: pkContent,
                arriveType: pkArriveType,
                arriveTime: pkArriveTime,
            },
            deliveryPoint: {
                name: dpName,
                mobileNo: dpMobileNo,
                address: dpAddress,
                lat: dpLat,
                long: dpLong,
                completeAddress: dpCompleteAddress,
                distance: dpDistance,
            },
            collectCash: collectCash,
            amountCollection: amountCollection == "" ? "0" : amountCollection,
            handlingCharge: handlingChargeIs,
            // eOrderDeliveryType: eOrderDeliveryType,
            promoCode: promoCode,
            amount: amount,
            discount: discount,
            additionalAmount: additionalAmount,
            finalAmount: finalAmount,
            // TransactionId: TransactionId,
            status: "Order Processing",
            note: "Your order is processing!",
        });
        // console.log("---------------amount Collected-----------");
        console.log(newOrder);
        var placedorder = await newOrder.save();

        var avlcourier = await PNDfinder(
            pkLat,
            pkLong,
            placedorder.id,
            placedorder.deliveryType
        );
        
        if (promoCode != "0") {
            let usedpromo = new usedpromoSchema({
                _id: new config.mongoose.Types.ObjectId(),
                customer: customerId,
                code: promoCode,
            });
            usedpromo.save();
        }
        if (placedorder != null && avlcourier.length != 0) {
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
    
    console.log(AdminNumber1);

    var findAdminFcmToken = await customerSchema.find({ mobileNo: AdminNumber1 }).select('fcmToken -_id');
    var findAdminFcmToken2 = await customerSchema.find({ mobileNo: AdminNumber2 }).select('fcmToken -_id');
    var findAdminFcmToken3 = await customerSchema.find({ mobileNo: AdminNumber3 }).select('fcmToken -_id');
    var findAdminFcmToken4 = await customerSchema.find({ mobileNo: AdminNumber4 }).select('fcmToken -_id');
    var findAdminFcmToken5 = await customerSchema.find({ mobileNo: AdminNumber5 }).select('fcmToken -_id');

    var AdminFcmToken = [findAdminFcmToken[0].fcmToken,findAdminFcmToken2[0].fcmToken,findAdminFcmToken3[0].fcmToken,findAdminFcmToken4[0].fcmToken,findAdminFcmToken5[0].fcmToken];
    console.log("-------------------------ADMINS TOKENS-----------------------------");
    console.log(AdminFcmToken);

    let newOrderData = newOrder.orderNo;
    let newOrderPickUp = newOrder.pickupPoint.address;
    let newOrderDelivery = newOrder.deliveryPoint.address;
    let newOrderCustomerId = newOrder.customerId;
    console.log(newOrderCustomerId);
    let newOrderCustomer = await customerSchema.find({ _id: newOrderCustomerId }).select('name mobileNo -_id');
    
    let newOrderNotification = `New Order Received 
    OrderID: ${newOrderData}
    Customer: ${newOrderCustomer[0].name}
    Mobile: ${newOrderCustomer[0].mobileNo}  
    PickUp: ${newOrderPickUp}`;
    console.log(newOrderNotification);


    var AdminPhoneNumbers = [AdminNumber1,AdminNumber2,AdminNumber3,AdminNumber4,AdminNumber5];
            // var payload2 = {
            //     notification: {
            //         title: "Order Alert",
            //         body: "New Order Alert Found For You.",
            //     },
            //     data: {
            //         sound: "surprise.mp3",
            //         Message: "Hello New Order",
            //         click_action: "FLUTTER_NOTIFICATION_CLICK",
            //     },
            // };
            // var options2 = {
            //     priority: "high",
            //     timeToLive: 60 * 60 * 24,
            // };
            // config.firebase
            //     .messaging()
            //     .sendToDevice(AdminFcmToken, payload2, options2)
            //     .then((doc) => {
            //         console.log("Sending Notification Testing3.......!!!");
            //         console.log(doc);
            //     });
            // config.firebase
            // .messaging()
            // .sendToDevice(AdminFcmToken, payload2, options2)
            // .then((doc) => {                    
            //     console.log("Sending Notification Testing2.......!!!");
            //     console.log(doc);
            // });    
            // orderstatus[0]["isActive"] == true &&
            // orderstatus[0]["status"] == "Order Processing"

            //Send notification to Admin FCM
            
            //Sending FCM Notification to Admin
            console.log(AdminFcmToken.length);
        for(let i=0;i<AdminFcmToken.length;i++){
            console.log(`--------------------------------------- ${i}`);
            console.log(AdminFcmToken[i])
            var dataSendToAdmin = {
                "to":AdminFcmToken[i],
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
                //console.log(myJsonBody);
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

        } else {
            console.log("No Courier Boys Available:: Waiting For Admin Response");
            var updateorder = {
                status: "Admin",
            };
            await orderSchema.findByIdAndUpdate(placedorder.id, updateorder);
        }
        res
            .status(200)
            .json({ Message: "Order Placed!", Data: placedorder, IsSuccess: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

async function sendMessages(mobileNo, message) {
    let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + mobileNo + "&text= " + message;
    console.log(msgportal);
    axios.get(msgportal);
    var data = await axios.get(msgportal);
    return data;
}
//MultiOrder Number ---04-11-2020

function getMultiOrderNumber() {
    let orderNo = "ORDMT-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}

//Multiorder API 04-11-2020
router.post("/multiNewOrder", async function(req,res,next){
    var {
        customerId,
        deliveryType,
        weightLimit,
        pkName,
        pkMobileNo,
        pkAddress,
        pkLat,
        pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        deliveryAddresses,
        collectCash,
        promoCode,
        amountCollectionList,
        amount,
        discount,
        additionalAmount,
        finalAmount,
        // schedualDateTime,
        scheduleDate,
        scheduleTime,
    } = req.body;
    let num = getOrderNumber();
    // let numMulti = getMultiOrderNumber();
    var MultiOrders = [];
    try {
        for(let i=0;i<deliveryAddresses.length;i++){
            let d1 = deliveryAddresses[i];
            // console.log("---------------------")
            // console.log(d1);
            
            var newMultiOrder = new orderSchema({
                _id: new config.mongoose.Types.ObjectId(),
                orderNo: num,
                multiOrderNo: getMultiOrderNumber(),
                customerId: customerId,
                deliveryType: deliveryType,
                // schedualDateTime: schedualDateTime,
                scheduleDate: scheduleDate,
                scheduleTime: scheduleTime,
                weightLimit: weightLimit,
                // orderImg: file == undefined ? "" : file.path,
                pickupPoint: {
                    name: pkName,
                    mobileNo: pkMobileNo,
                    address: pkAddress,
                    lat: pkLat,
                    long: pkLong,
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
                },
                collectCash: collectCash,
                amountCollection: amountCollectionList[i],
                promoCode: promoCode,
                amount: amount,
                discount: discount,
                additionalAmount: additionalAmount,
                finalAmount: finalAmount,
                status: "Order Processing",
                note: "Your order is processing!",
            });
            var placeMultiOrder = await newMultiOrder.save();
            // var placeMultiOrder = newMultiOrder;
            MultiOrders.push(placeMultiOrder);
        }
        console.log(placeMultiOrder);
        console.log("--------------------Hello------------------------------------------------");
        var avlcourier = await PNDfinder(
            pkLat,
            pkLong,
            placeMultiOrder.id,
            placeMultiOrder.deliveryType
        );
        console.log("===============================================================");
        console.log("Available Is: "+avlcourier);
        if (promoCode != "0") {
            let usedpromo = new usedpromoSchema({
                _id: new config.mongoose.Types.ObjectId(),
                customer: customerId,
                code: promoCode,
            });
            usedpromo.save();
        }
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

            let newOrderData = newMultiOrder.orderNo;
            let newOrderPickUp = newMultiOrder.pickupPoint.address;
            let newOrderDelivery = newMultiOrder.deliveryPoint.address;
            let newOrderCustomerId = newMultiOrder.customerId;
            console.log(newOrderCustomerId);
            let newOrderCustomer = await customerSchema.find({ _id: newOrderCustomerId }).select('name mobileNo -_id');

            // console.log(MultiOrders.length);
            // let newOrderDelivery = [];
            // for(let ik=0;ik<MultiOrders.length;ik++){
            //     newOrderDelivery.push(MultiOrders[ik].deliveryPoint.address);
            // }

            let newOrderNotification = `New Order Received 
            OrderID: ${newOrderData}
            Customer: ${newOrderCustomer[0].name}
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
        res.status(200).json({ IsSuccess:true , Data: MultiOrders , Message: "Multiorder Added" });
    }catch(error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Optimize Route---------MONIL(03/12/2020)
function locationFromPickUp(orders,pickLat,pickLong){
    // console.log(orders);
    console.log("Order Length: "+orders.length);
    var distanceFromPickUp = {};
    var distanceFromPickUpList = [];
    var temp = [];
    for(var i=0;i<orders.length;i++){
        var deliveryPoint = [orders[i].deliveryPoint.lat,orders[i].deliveryPoint.long];
                
        let distance = calculatelocation(pickLat,pickLong,deliveryPoint[0],deliveryPoint[1]);
        distance = distance/1000;
        distance = parseFloat(distance);
        distanceFromPickUp[i] = distance;
        temp.push(distanceFromPickUp);
        distanceFromPickUpList.push(distance);    
    }
    temp = temp[1];
    return temp; 
}

function sortObj(yourVar,list){
            
    for (var rs in list) {
        yourVar.push([rs, list[rs]]);
    }

    yourVar.sort(function(a, b) {
        return a[1] - b[1];
    });
    return yourVar;
}

function removeElement(array, elem) {
    var index = array.indexOf(elem);
    if (index > -1) {
        array.splice(index, 1);
    }
}

router.post("/getOptimizeRoute", async function(req,res,next){
    const { orderNo } = req.body;
    // console.log(calculatelocation(21.1411089,72.80367319999999,22.98551,75.36289));
    try {
        var orderIs = await orderSchema.find({ orderNo: orderNo });
        //	"orderMTNum" : "ORDMT-5022110000"
        let loopCount = parseFloat(orderIs.length); 
        console.log(orderIs.length);
        var optimizeOrder = [];
        var PickPoint = [orderIs[0].pickupPoint.lat,orderIs[0].pickupPoint.long];
        
        for(var ij=0;ij<(loopCount - 1);ij++){
            console.log(locationFromPickUp(orderIs,PickPoint[0],PickPoint[1]));
            let distancesFromOrigin = locationFromPickUp(orderIs,PickPoint[0],PickPoint[1]);
            // console.log(distancesFromOrigin);
            var sortable = [];
            // console.log(sortObj(sortable,distancesFromOrigin));
            sortObj(sortable,distancesFromOrigin)
            console.log("Sort Orders Index: ");
            console.log(sortable);//[ [ '0', 3.249 ], [ '2', 3.371 ], [ '1', 3.57 ] ]

            let indexOfFirstOrder = sortable[0][0];
            optimizeOrder.push(orderIs[indexOfFirstOrder]);
            console.log(orderIs[indexOfFirstOrder].orderNo);
            console.log(orderIs[indexOfFirstOrder].multiOrderNo);
            // console.log(optimizeOrder);

            let nextPickUpLat = orderIs[indexOfFirstOrder].deliveryPoint.lat;
            let nextPickUpLong = orderIs[indexOfFirstOrder].deliveryPoint.long;
            PickPoint= [nextPickUpLat,nextPickUpLong];
            sortable.shift();
            removeElement(orderIs,orderIs[indexOfFirstOrder]);
            console.log("index ij: "+ij);
            // console.log("Order length: "+orderIs.length);
        }
        console.log("--------------------Sortable Out of Loop-----------------------------");
        console.log(sortable);
        let indexOfLastDeliveryPoint = sortable[0][0];
        // optimizeOrder.push(orderIs[indexOfLastDeliveryPoint])
        console.log("---------------LAST-----------------");
        console.log(indexOfLastDeliveryPoint);
        // console.log(orderIs[0]);
        // console.log(orderIs[indexOfLastDeliveryPoint]);
        // let lastOrder = orderIs[indexOfLastDeliveryPoint];
        optimizeOrder.push(orderIs[0]);
        // console.log(typeof lastOrder);
        // for(var j=0;j<sortable.length;j++){
            
        // }
        // let letNextPick = 
        // console.log(optimizeOrder);
        res.status(200).json({ IsSuccess: true , Count: optimizeOrder.length ,Data: optimizeOrder , Message: "Orders Optimize" });
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

router.post("/activeOrders", async function (req, res, next) {
    const { customerId } = req.body;
    try {
        orderSchema
            .find({ customerId: customerId, isActive: true })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified profileImg"
            )
            .exec()
            .then((docs) => {
                if (docs.length != 0) {
                    res
                        .status(200)
                        .json({ Message: "Order Found!", Count: docs.length , Data: docs, IsSuccess: true });
                } else {
                    res
                        .status(200)
                        .json({ Message: "No Order Found!", Data: docs, IsSuccess: true });
                }
            });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//Find Unique values from List
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

//Active Orders (Include Multi delivery Points)--30-12-2020
router.post("/activeOrdersV2", async function (req, res, next) {
    const { customerId } = req.body;
    try {
        let record = await orderSchema
            .find({ $and: [ { isActive: true }, { customerId: customerId } ] })
            // .find({ customerId: customerId, isActive: true })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified profileImg"
            );
            
        let complete_Record = await orderSchema
                        .find({ $and: [ { isActive: false } ,{ status: "Order Delivered" }, { customerId: customerId } ] })
                        .populate(
                            "courierId",
                            "firstName lastName fcmToken mobileNo accStatus transport isVerified profileImg"
                        );
        
        let completeOrderIs = [];
        for(let j=0;j<complete_Record.length;j++){
            completeOrderIs.push(complete_Record[j].orderNo);
        }
        let completeUnique = completeOrderIs.filter(onlyUnique);

        // let comRes = [];
        // for(let k=0;k<completeUnique.length;k++){
        //     console.log(completeUnique[k]);
        //     let orderData = await orderSchema.find({ orderNo: completeUnique[k] , isActive: false });
        //     comRes.push(orderData);
        // }

        let aciveOrderIs = [];
        for(let i=0;i<record.length;i++){
            aciveOrderIs.push(record[i].orderNo);
        }
        console.log("Orders No: "+aciveOrderIs);
        var unique = aciveOrderIs.filter(onlyUnique);
        console.log(unique);
        let result = [];
        let completeActiveList = completeUnique.concat(unique);
        // console.log(completeActiveList);
        let singleOrder = [];
        let multiOrder = [];
        for(let j=0;j<completeActiveList.length;j++){
            console.log(completeActiveList[j]);
            let orderData = await orderSchema.find({ orderNo: completeActiveList[j] });
            if(orderData.length > 1){
                multiOrder.push(orderData);
            }else{
                singleOrder.push(orderData);
            }
            // result.push(orderData);
        }
        let DataSend = {
            SingleDeliveryOrdersAre : singleOrder,
            MultiDeliveryOrdersAre : multiOrder
        }
        if (DataSend.length != 0) {
            res
                .status(200)
                .json({ Message: "Order Found!", Data: DataSend , IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "No Order Found!", Data: 0, IsSuccess: true });
        }    
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/completeOrders", async function (req, res, next) {
    const { customerId } = req.body;
    try {
        orderSchema
            .find({ customerId: customerId, isActive: false })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified profileImg"
            )
            .exec()
            .then((docs) => {
                if (docs.length != 0) {
                    res
                        .status(200)
                        .json({ Message: "Order Found!", Data: docs, IsSuccess: true });
                } else {
                    res
                        .status(200)
                        .json({ Message: "No Order Found!", Data: docs, IsSuccess: true });
                }
            });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//partner app APIs
router.post("/acceptOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let orderData = await orderSchema
            .find({ _id: orderId })
            .populate("customerId");
        let courierData = await courierSchema.find({ _id: courierId });
        let request = await requestSchema.find({
            orderId: orderId,
            status: "Accept",
        });

        if (request.length == 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {
                let updaterequest = await requestSchema.findOneAndUpdate({ orderId: orderId, courierId: courierId }, { status: "Accept" }, { new: true });
                await orderSchema.findByIdAndUpdate(orderId, {
                    courierId: courierId,
                    status: "Order Assigned",
                    note: "Order Has Been Assigned",
                });
                //send Message to customer
                let createMsg =
                    "Your order " +
                    orderData[0].orderNo +
                    " has been accepted by our delivery boy " +
                    courierData[0].firstName +
                    " " +
                    courierData[0].lastName +
                    "--" +
                    courierData[0].mobileNo +
                    ".He Will Reach To You Shortly.";
                sendMessages(orderData[0].customerId.mobileNo, createMsg);
                console.log("---Order Accepted--");
                res
                    .status(200)
                    .json({ Message: "Order Accepted!", Data: 1, IsSuccess: true });
            } else {
                console.log("---Please Turn On Your Duty--");
                res.status(200).json({
                    Message: "Please turn on your duty!",
                    Data: 0,
                    IsSuccess: true,
                });
            }
        } else {
            console.log("---Order Might Be Cancelled By Customer--");
            res.status(200).json({
                Message: "Sorry! Order Not Available",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/takeThisOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let courierData = await courierSchema.find({ _id: courierId });
        let orderData = await orderSchema
            .find({ _id: orderId })
            .populate("customerId");
        let getlocation = await currentLocation(courierId);
        console.log(getlocation);
        if (getlocation.duty == "ON") {
            let updateorder = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "Takethisorder" });
            if (updateorder != null) {
                let extrakm = new ExtatimeSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    courierId: courierId,
                    orderId: orderId,
                    blat: getlocation.latitude,
                    blong: getlocation.longitude,
                });
                extrakm.save();
                console.log("---Order Taking Success--");
                res.status(200).json({
                    Message: "Order Taking Successfully!",
                    Data: 1,
                    IsSuccess: true,
                });
            } else {
                console.log("---Order Taking Failed--");
                res
                    .status(200)
                    .json({ Message: "Order Taking Failed!", Data: 0, IsSuccess: true });
            }
        } else {
            console.log("---Please Turn On Your Duty--");
            res.status(200).json({
                Message: "Please turn on your duty!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/rejectOrder", async function (req, res, next) {
    const { courierId, orderId, reason } = req.body;
    console.log("Data for Reject Order");
    // console.log(req.body);
    try {
        var orderData = await orderSchema.find({ _id: orderId, isActive: true });
        orderData.status = "Order Cancel By Employee";
        // console.log(orderData);
        let courierData = await courierSchema.find({ _id: courierId });
        if (orderData.length != 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {
                let updateRejection = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "Reject", reason: reason });
                let orderRejectInOrder = await orderSchema.insertOne(orderData);
                console.log("Order cancel by Employeee..........................!!!");
                // console.log(orderRejectInOrder);
                if (updateRejection != null) {
                    var avlcourier = await PNDfinder(
                        orderData[0].pickupPoint.lat,
                        orderData[0].pickupPoint.long,
                        orderId,
                        orderData[0].deliveryType
                    );

                    if (avlcourier.length != 0) {
                        let nearby = arraySort(avlcourier, "distance");
                        let newrequest = new requestSchema({
                            _id: new config.mongoose.Types.ObjectId(),
                            courierId: nearby[0].courierId,
                            orderId: nearby[0].orderId,
                            distance: nearby[0].distance,
                            status: nearby[0].status,
                            reason: nearby[0].reason,
                            fcmToken: nearby[0].fcmToken,
                        });
                        await newrequest.save();

                        var payload = {
                            notification: {
                                title: "Order Alert",
                                body: "New Order Alert Found For You.",
                            },
                            data: {
                                orderid: orderId.toString(),
                                distance: nearby[0].distance.toString(),
                                click_action: "FLUTTER_NOTIFICATION_CLICK",
                            },
                        };
                        var options = {
                            priority: "high",
                            timeToLive: 60 * 60 * 24,
                        };
                        config.firebase
                            .messaging()
                            .sendToDevice(nearby[0].fcmToken, payload, options)
                            .then((doc) => {
                                console.log("Sending Notification");
                                console.log(doc);
                            });

                        //add Logger
                        let logger = new locationLoggerSchema({
                            _id: new config.mongoose.Types.ObjectId(),
                            courierId: courierId,
                            lat: getlocation.latitude,
                            long: getlocation.longitude,
                            description: courierData[0].cId +
                                " has rejected order " +
                                orderData[0].orderNo,
                        });
                        logger.save();

                        res.status(200).json({
                            Message: "Order Has Been Rejected!",
                            Data: 1,
                            IsSuccess: true,
                        });
                    } else {
                        console.log("All Courier Boys Are Busy");
                        var updateorder = {
                            note: "Order is Processing",
                            status: "Admin",
                        };
                        await orderSchema.findByIdAndUpdate(orderId, updateorder);
                        console.log("---Order Rejected--");
                        res.status(200).json({
                            Message: "Order Has Been Rejected!",
                            Data: 1,
                            IsSuccess: true,
                        });
                    }
                } else {
                    console.log("---Unable to Reject Order--");
                    res.status(200).json({
                        Message: "Unable to Reject Order!",
                        Data: 0,
                        IsSuccess: true,
                    });
                }
            } else {
                console.log("---Please Turn On Your Duty--");
                res.status(200).json({
                    Message: "Please turn on your duty!",
                    Data: 0,
                    IsSuccess: true,
                });
            }
        } else {
            console.log("---Order Might Be Cancelled By Customer--");
            res.status(200).json({
                Message: "Sorry! Order Not Available",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/noResponseOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        var updateRejection = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "NoResponse", reason: "Not Responded By Delivery Boy" });
        if (updateRejection != null) {
            var orderData = await orderSchema.find({ _id: orderId, isActive: true });
            if (orderData.length != 0) {
                var avlcourier = await PNDfinder(
                    orderData[0].pickupPoint.lat,
                    orderData[0].pickupPoint.long,
                    orderId,
                    orderData[0].deliveryType
                );
                if (avlcourier.length != 0) {
                    console.log("Courier Boys Available");
                    let courierfound = arraySort(avlcourier, "distance");
                    let newrequest = new requestSchema({
                        _id: new config.mongoose.Types.ObjectId(),
                        courierId: courierfound[0].courierId,
                        orderId: courierfound[0].orderId,
                        distance: courierfound[0].distance,
                        status: courierfound[0].status,
                        reason: courierfound[0].reason,
                        fcmToken: courierfound[0].fcmToken,
                    });
                    await newrequest.save();
                    var payload = {
                        notification: {
                            title: "Order Alert",
                            body: "New Order Alert Found For You.",
                        },
                        data: {
                            orderid: courierfound[0].orderId.toString(),
                            distance: courierfound[0].distance.toString(),
                            click_action: "FLUTTER_NOTIFICATION_CLICK",
                        },
                    };
                    var options = {
                        priority: "high",
                        timeToLive: 60 * 60 * 24,
                    };
                    config.firebase
                        .messaging()
                        .sendToDevice(courierfound[0].fcmToken, payload, options)
                        .then((doc) => {
                            console.log("Sending Notification");
                            console.log(doc);
                        });
                    res
                        .status(200)
                        .json({ Message: "Order No Response!", Data: 1, IsSuccess: true });
                } else {
                    console.log("No Courier Boys Available:: Waiting For Admin Response");
                    var updateorder = {
                        note: "Order is Processing.",
                        status: "Admin",
                    };
                    await orderSchema.findByIdAndUpdate(orderId, updateorder);
                    res.status(200).json({
                        Message: "Order Sent To Admin!",
                        Data: 1,
                        IsSuccess: true,
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/reachPickPoint", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        var location = await currentLocation(courierId);
        if (location.duty == "ON") {
            var checkif = await orderSchema
                .find({ _id: orderId, isActive: true })
                .populate("customerId");

            if (checkif.length != 0) {
                await orderSchema.findOneAndUpdate({ _id: orderId, courierId: courierId }, {
                    status: "Order Picked",
                    note: "Delivery boy reached to pickup point",
                });

                var data = { plat: location.latitude, plong: location.longitude };
                await ExtatimeSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId },
                    data
                );

                sendMessages(
                    checkif[0].pickupPoint.mobileNo,
                    "Your delivery boy reached To pickup Point."
                );

                sendMessages(
                    checkif[0].deliveryPoint.mobileNo,
                    "Your delivery boy reached To pickup point. He will reach to you shortly."
                );
                let locationDataIs = await ExtatimeSchema.find({ courierId: courierId , orderId: orderId })
                // console.log(locationDataIs);
                let startLat = parseFloat(locationDataIs[0].blat);
                let startLong = parseFloat(locationDataIs[0].blong);
                let pickLat = parseFloat(location.latitude);
                let pickLong = parseFloat(location.longitude);

                let distance = calculatelocation(startLat,startLong,pickLat,pickLong);
                distance = parseFloat(distance) / 1000 ;
                console.log(distance);
                let updateIs = {
                    extraKmByCourierBoy: distance,
                };
                let updateExtraKmToOrderIs = await orderSchema.findByIdAndUpdate(orderId,updateIs);
                res
                    .status(200)
                    .json({ Message: "Reached Pickup Point!", Data: 1, IsSuccess: true });
            } else {
                res
                    .status(200)
                    .json({ Message: "Order Not Available!", Data: 0, IsSuccess: true });
            }
        } else {
            res.status(200).json({
                Message: "Please Turn ON Your Duty!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/reachDropPoint", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {

        // Check If Given Order Is Active or Not
        var checkif = await orderSchema
            .find({ _id: orderId, isActive: true })
            .populate("customerId");
        if (checkif.length != 0) {

            // Order Schema updated With Status Order Delivered
            await orderSchema.findOneAndUpdate({ _id: orderId, courierId: courierId }, { status: "Order Delivered", note: "Order Delivered", isActive: false });

            // Set Delivery Date In Extratime Schema
            let newDate = new Date();
            await ExtatimeSchema.findOneAndUpdate({ orderId: orderId, courierId: courierId }, { deliverytime: newDate });

            // Sending Message To Sender
            sendMessages(
                checkif[0].customerId.mobileNo,
                "Your Order Has Been Delivered."
            );

            // Sending Message To Reciever
            sendMessages(
                checkif[0].deliveryPoint.mobileNo,
                "Your Order Has Been Delivered."
            );

            res
                .status(200)
                .json({ Message: "Order Delivered!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Order Not Available!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/c_activeOrder", async function (req, res, next) {
    const { courierId } = req.body;
    try {
        var data = await requestSchema.find({
            courierId: courierId,
            status: "Takethisorder",
        });
        var datalist = [];
        if (data.length != 0) {
            for (var i = 0; i < data.length; i++) {
                var orderdata = await orderSchema.findOne({
                    _id: data[i].orderId,
                    courierId: courierId,
                    isActive: true,
                });
                if (orderdata != null) datalist.push(orderdata);
            }
            // console.log(datalist);
            if (datalist.length != 0) {
                res
                    .status(200)
                    .json({ Message: "Orders Found!", Data: datalist, IsSuccess: true });
            } else {
                res
                    .status(200)
                    .json({ Message: "No Orders Found!", Data: datalist, IsSuccess: true });
            }
        } else {
            let orderdata = [];
            res
                .status(200)
                .json({ Message: "No Orders Found!", Data: orderdata, IsSuccess: true });
        }    
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
    
});

router.post("/c_completeOrder", async function (req, res, next) {
    const { courierId } = req.body;
    var data = await orderSchema.find({ courierId: courierId, isActive: false });
    if (data.length != 0) {
        res
            .status(200)
            .json({ Message: "Orders Found!", Data: data, IsSuccess: true });
    } else {
        res
            .status(200)
            .json({ Message: "No Orders Found!", Data: data, IsSuccess: true });
    }
});

router.post("/c_responseOrder", async function (req, res, next) {
    const { courierId } = req.body;
    try {
        var data = await requestSchema.find({
            courierId: courierId,
            status: "Accept",
        });
        var datalist = [];
        if (data.length != 0) {
            for (var i = 0; i < data.length; i++) {
                var orderdata = await orderSchema.findOne({
                    _id: data[i].orderId,
                    courierId: courierId,
                    isActive: true,
                });
                if (orderdata != null) {
                    datalist.push(orderdata);
                }
            }
            // console.log(datalist);
            if (datalist.length != 0) {
                res
                    .status(200)
                    .json({ Message: "Orders Found!", Data: datalist, IsSuccess: true });
            } else {
                res
                    .status(200)
                    .json({ Message: "No Orders Found!", Data: datalist, IsSuccess: true });
            }
        } else {
            let orderdata = [];
            res
                .status(200)
                .json({ Message: "No Orders Found!", Data: orderdata, IsSuccess: true });
        }    
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
    
});

router.post("/orderDetails", async function (req, res, next) {
    const { id } = req.body;
    try {
        var order = await orderSchema.find({ _id: id });
        if (order.length == 1) {
            res
                .status(200)
                .json({ Message: "Orders Found!", Data: order, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Orders Not Found!", Data: order, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/orderStatus", async function (req, res, next) {
    const { id } = req.body;
    try {
        var order = await orderSchema.find({ _id: id }).select("isActive status");
        if (order.length == 1) {
            res
                .status(200)
                .json({ Message: "Orders Found!", Data: order, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Orders Not Found!", Data: order, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/orderCancelByCustomer", async function(req , res ,next){
    const { id , customerId } = req.body;
    var TimeHours = "";
    var TimeMinutes = "";
    var TimeSeconds = "";
    var TimeYear = "";
    var TimeMonth = "";
    var TimeDate = "";

    try {
        let customerOrder = await orderSchema.find({ $and: [ { _id: id }, { customerId: customerId } ] });
        // console.log(customerOrder);
        if(customerOrder.length == 1){
            let orderNo = customerOrder[0].orderNo;
            let OrderTime = customerOrder[0].schedualDateTime;
            // console.log(OrderTime);
            console.log("-----------------SSS---------------");
            console.log(customerOrder[0].schedualDateTime);
            let isoSchedule = customerOrder[0].schedualDateTime;
             
            var getextractData = await orderSchema.aggregate(
                [
                    {$match:
                        {'orderNo': orderNo}
                    },
                  {
                    $project:
                      {
                        year: { $year: "$schedualDateTime" },
                        month: { $month: "$schedualDateTime" },
                        day: { $dayOfMonth: "$schedualDateTime" },
                        hour: { $hour: "$schedualDateTime" },
                        minutes: { $minute: "$schedualDateTime" },
                        seconds: { $second: "$schedualDateTime" },
                        milliseconds: { $millisecond: "$schedualDateTime" },
                        dayOfYear: { $dayOfYear: "$schedualDateTime" },
                        dayOfWeek: { $dayOfWeek: "$schedualDateTime" },
                        week: { $week: "$schedualDateTime" }
                      }
                  }
                ]
             ).then(dataList => {
                var timeData = dataList;
                TimeHours = timeData[0].hour;
                TimeMinutes = timeData[0].minutes;
                TimeSeconds = timeData[0].seconds;
                TimeYear = timeData[0].year;
                TimeMonth = timeData[0].month;
                TimeDate = timeData[0].day;

                // console.log(timeData[0].year);
                // console.log(timeData);
                
             });
            //  console.log(`Year : ${TimeHours}`);
            //  console.log(`Minutes : ${TimeMinutes}`);
            //  console.log(`Seconds : ${TimeSeconds}`);
            //  console.log(`Year : ${TimeYear}`);
            //  console.log(`Month : ${TimeMonth}`);
            //  console.log(`Day : ${TimeDate}`);
             //console.log(`Seconds : ${TimeSeconds}`);
            // let myNewDate = new Date(TimeYear,TimeMonth,TimeDate,TimeHours,TimeMinutes,TimeSeconds);
            // console.log(myNewDate.getMinutes());
            // myNewDate.setMinutes(myNewDate.getMinutes() - 15);
            // console.log("--------MyDate---------");
            // console.log(myNewDate);
            // console.log(myNewDate.getHours());

            var hh = myNewDate.getHours();
            var mm = myNewDate.getMinutes();
            var ss = myNewDate.getSeconds();
            
            let limitTime = new Date(myNewDate);
            console.log("-----------Limit-------")
            console.log(limitTime);
            let timeNow = new Date();
            console.log(timeNow.getHours() + ":" + timeNow.getMinutes());
            console.log(isoSchedule.getHours() + ":" + isoSchedule.getMinutes()); 
            console.log(myNewDate.getHours() + ":" + myNewDate.getMinutes()); 
            // res.status(200).json({ 
            //             IsSuccess : true , 
            //             Message : "Order Cancel Limit!!!" ,
            //             OrderCancelLimit : myNewDate,
            //             ReadableFormat : [hh, mm, ss].join(':') })
        }else{
            res.status(200).json({ IsSuccess : false , Message : "Not Found...!!!" , Data : 0 });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess : false , Message : error.message});
    }
});

// router.post("/cancelOrderV1", async function(req,res,next){
//     const { orderNo , customerId } = req.body;
//     try {
//         let orderIs = await orderSchema.find({ $and: [ { orderNo: orderNo }, { customerId: customerId } ] });
//         var scheduleTime = orderIs[0].scheduleDateTime;
        
//         // console.log(scheduleTime);
//         // console.log("_ID IS :" + orderIs[0]._id);
        
//         if(scheduleTime.getMinutes()<10){
//             scheduleTime = scheduleTime.getHours() + ":" + "0" + scheduleTime.getMinutes();
//         }else{
//             scheduleTime = scheduleTime.getHours() + ":" + scheduleTime.getMinutes();
//         }
//         // console.log("Schedule Time :" + scheduleTime);
//         var TimeLimit = orderIs[0].schedualDateTime;
//         // console.log(TimeLimit);
//         TimeLimit.setMinutes(TimeLimit.getMinutes() - 15);
//         // console.log("Here :" + TimeLimit.toISOString());
        
//         // console.log("Order Cancel Limit :"+ TimeLimit.getHours() + ":" + TimeLimit.getMinutes());
//         // console.log("Limit :" + TimeLimit.getHours() + ":" + TimeLimit.getMinutes());
//         var currentDateTime = new Date();
//         var currentTime = currentDateTime.getHours() + ":" + currentDateTime.getMinutes();
//         currentDateTime = currentDateTime.toISOString();
//         // console.log("current :"+currentTime);
//         // console.log("TimeLimit :" + TimeLimit)
//         let cancelLimit = TimeLimit.toISOString();
//         // console.log("aa" + cancelLimit);
//         // let t = "2020-12-11T05:30:03.872Z";
//         // console.log("CurrentDateTime :" + currentDateTime);
//         // console.log("aa :" + cancelLimit);
//         if(currentDateTime < cancelLimit){
//             // var deleteOrder = await orderSchema.findByIdAndDelete(orderIs[0]._id);
//             let updateIs = {
//                 status : "Order Cancelled"
//             }
//             var deleteOrder = await orderSchema.findByIdAndUpdate(orderIs[0]._id,updateIs);
//             res.status(200).json({ IsSuccess: true , Data: 1 ,Message: "Order Deleted" });
//         }
//         else{
//             res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Order Can't Deleted Before 15 Minutes of ScheduleTime" });
//         }
//     } catch (error) {
//         res.status(500).json({ IsSuccess: false , Message: error.message });
//     }
// });

function diff_minutes(dt2, dt1) 
{
    dt2 = new Date(dt2);
    dt1 = new Date(dt1);
    console.log(dt1);
    console.log(dt2);
    var diff =(dt2.getTime() - dt1.getTime()) / 1000;
    diff /= 60;
    return Math.round(diff);
    // return Math.abs(Math.round(diff));
  
}

router.post("/cancelOrderV1", async function(req,res,next){
    const { orderNo , customerId } = req.body;
    try {
        let orderIs = await orderSchema.find({ $and: [ { orderNo: orderNo }, { customerId: customerId } ] });
        console.log(orderIs.length);
        for(let jk=0;jk<orderIs.length;jk++){
            var scheduleTime = orderIs[jk].scheduleTime;
            var scheduleDate = orderIs[jk].scheduleDate;
            console.log("=======================================================");
            
            console.log([scheduleDate,scheduleTime]);
            let timeList = scheduleTime.split(":");
            let dateList = scheduleDate.split("-");

            let month = Number(dateList[1]);
            
            month = month - 1;
            let scheduleTimeOf = new Date(Number(dateList[0]),month,Number(dateList[2]),timeList[0],timeList[1]);
            console.log(scheduleTimeOf);
            scheduleTimeOf = moment(scheduleTimeOf)
                                .tz("Asia/Calcutta")
                                .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
                                // .split(",")[1];

            let currentTimeIs = moment()
                                .tz("Asia/Calcutta")
                                .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
                                // .split(",")[1];

            console.log(scheduleTimeOf);
            console.log(currentTimeIs);


            let diff = diff_minutes(scheduleTimeOf,currentTimeIs);
            console.log(diff);

            if(diff > 15){
                // var deleteOrder = await orderSchema.findByIdAndDelete(orderIs[0]._id);
                let updateIs = {
                    status : "Order Cancelled",
                    isActive : false,
                }
                var deleteOrder = await orderSchema.findByIdAndUpdate(orderIs[jk]._id,updateIs);
               
            }else if(diff < 0){
                return res.status(200).json({ IsSuccess: true , Data: 1 ,Message: "Schedule Time Passed Away" });
            }else{
                return res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Order Can't Deleted Before 15 Minutes of ScheduleTime" });
            }
        }
        return res.status(200).json({ IsSuccess: true , Data: 1 ,Message: "Order Deleted" });
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

// router.post("/cancelOrderV1", async function(req,res,next){
//     const { orderNo , customerId } = req.body;
//     try {
//         let orderIs = await orderSchema.find({ $and: [ { orderNo: orderNo }, { customerId: customerId } ] });
//         console.log(orderIs.length);
//         for(let jk=0;jk<orderIs.length;jk++){
//             var scheduleTime = orderIs[jk].scheduleTime;
//             var scheduleDate = orderIs[jk].scheduleDate;
//             console.log([scheduleDate,scheduleTime]);
//             let timeList = scheduleTime.split(":");
//             let dateList = scheduleDate.split("-");

//             let month = Number(dateList[1]);
            
//             month = month - 1;
//             scheduleTime = new Date(Number(dateList[0]),month,Number(dateList[2]),timeList[0],timeList[1]);
//             console.log(scheduleTime);
//             let temp = scheduleTime;
            
//             if(scheduleTime.getMinutes()<10){
//                 scheduleTime = scheduleTime.getHours() + ":" + "0" + scheduleTime.getMinutes();
//             }else{
//                 scheduleTime = scheduleTime.getHours() + ":" + scheduleTime.getMinutes();
//             }
//             console.log("Schedule Time :" + scheduleTime);
//             console.log("Temp Time :" + temp);
//             var TimeLimit = temp;
//             console.log("LocalCheck :"+TimeLimit);
//             TimeLimit.setMinutes(TimeLimit.getMinutes() - 15);
//             console.log("LocalCheck :"+TimeLimit);
//             console.log("Here :" + TimeLimit.toISOString());
            
//             // console.log("Order Cancel Limit :"+ TimeLimit.getHours() + ":" + TimeLimit.getMinutes());
//             // console.log("Limit :" + TimeLimit.getHours() + ":" + TimeLimit.getMinutes());
//             var currentDateTime = new Date();
//             var currentTime = currentDateTime.getHours() + ":" + currentDateTime.getMinutes();
//             currentDateTime = currentDateTime.toISOString();
//             // console.log("current :"+currentTime);
//             // console.log("TimeLimit :" + TimeLimit)
//             let cancelLimit = TimeLimit.toISOString();  
//             // console.log("aa" + cancelLimit);
//             // let t = "2020-12-11T05:30:03.872Z";
//             // console.log("CurrentDateTime :" + currentDateTime);
//             // console.log("aa :" + cancelLimit);
//             console.log("current : "+currentDateTime);
//             console.log("Cancel : "+cancelLimit);
//             let diff = diff_minutes(currentDateTime,temp.toISOString());
//             console.log("Diff :"+diff);
//             if(currentDateTime < cancelLimit){
//                 // var deleteOrder = await orderSchema.findByIdAndDelete(orderIs[0]._id);
//                 let updateIs = {
//                     status : "Order Cancelled",
//                     isActive : false,
//                 }
//                 // var deleteOrder = await orderSchema.findByIdAndUpdate(orderIs[jk]._id,updateIs);
//                 return res.status(200).json({ IsSuccess: true , Data: 1 ,Message: "Order Deleted" });
//             }
//             else{
//                 return res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Can't Deleted Before 15 Minutes of ScheduleTime" });
//             }
//         }
//     } catch (error) {
//         res.status(500).json({ IsSuccess: false , Message: error.message });
//     }
// });

//Scheduled delivery - before 30min -popup or notified--------MONIL(22-12-2020)
router.post("/scheduleOrderNotification", async function(req,res,next){
    try {
        let scheduledOrder = await orderSchema.find({ isActive: true });
        
        for(let i=0;i<scheduledOrder.length;i++){
            let scheduleDate = scheduledOrder[i].scheduleDate;
            let scheduleTime = scheduledOrder[i].scheduleTime;
            if(scheduleDate != undefined && scheduleTime != undefined){
                console.log(scheduleTime);
                console.log(scheduleDate);
                
                let timeList = scheduleTime.split(":");
                let dateList = scheduleDate.split("-");

                let month = Number(dateList[1]);
                
                month = month - 1;
                let scheduleTimeOf = new Date(Number(dateList[0]),month,Number(dateList[2]),timeList[0],timeList[1]);
                
                var substractScheduleTime = moment(scheduleTimeOf).subtract(30, "minutes").toDate()
                
                console.log(scheduleTimeOf)
                console.log(substractScheduleTime)
                
                let scheduleNotiTime = moment(substractScheduleTime)
                        .tz("Asia/Calcutta")
                        .format("DD/MM/YYYY, h:mm:ss a")
                        .split(",")[1];

                console.log(scheduleNotiTime);
                let scheduleNotiRecordIs = await new scheduleNotificationSchema({
                    orderNo: scheduledOrder[i].orderNo,
                    scheduleDate: scheduledOrder[i].scheduleDate,
                    scheduleTime: scheduleNotiTime,
                })
                // console.log(scheduleNotiRecordIs);
                scheduleNotiRecordIs.save();
            }            
            // if(scheduleNotiRecordIs){
            //     res.status(200).json({ IsSuccess: true , Data: scheduleNotiRecordIs , Message: "Schedule Notification Added" });
            // }else{
            //     res.status(200).json({ IsSuccess: true , Data: [] , Message: "Not Added" });
            // }
        }
        res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Schedule Notification Added" });
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

router.post("/cancelOrder" , async function(req,res,next){
    const { id } = req.body;
    try {
        var orderWant = await orderSchema.findByIdAndUpdate({ _id: id },{ status : "Order Cancelled" });
        if (orderWant.length == 1) {
            res
                .status(200)
                .json({ Message: "Orders Cancel!", Data: orderWant, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Orders Not Found!", Data: orderWant, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

// router.post("/calcDist",async function(req,res,next){
//     const {  } = req.body;
// });

module.exports = router;