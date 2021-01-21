/* Initiating Libraries */
require("dotenv").config();
var path = require("path");
var fs = require("fs");
var axios = require("axios");
var multer = require("multer");
var express = require("express");
var config = require("../config");
var router = express.Router();
const mongoose = require("mongoose");

/* Creating FileUpload Path */
var filestorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/couriers");
    },
    filename: function(req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});

var finalstorage = multer({ storage: filestorage });
var fieldset = finalstorage.fields([
    { name: "profileImg", maxCount: 1 },
    { name: "poaFrontImg", maxCount: 1 },
    { name: "poaBackImg", maxCount: 1 },
    { name: "panCardImg", maxCount: 1 },
    { name: "electricityImg", maxCount: 1 },
    { name: "policeVerificationImg", maxCount: 1 },
]);

/* Data Models */
var courierSchema = require("../data_models/courier.signup.model");
var courierNotificationSchema = require("../data_models/courier.notification.model");
var locationLoggerSchema = require("../data_models/location.logger.model");
var poatypesSchema = require("../data_models/poatype.model");
var prooftypeSchema = require("../data_models/prooftype.modal");
var orderSchema = require("../data_models/order.model");
/* Routes. */
router.get("/", function(req, res, next) {
    res.render("index", { title: "Invalid URL" });
});

router.post("/masterdata", async function(req, res, next) {
    try {
        let poatypes = await poatypesSchema.find();
        let prooftype = await prooftypeSchema.find();
        res.json({
            Message: "Masters Found!",
            Data: {
                poatypes: poatypes,
                prooftypes: prooftype,
            },
            IsSuccess: true,
        });
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsSuccess: false,
        });
    }
});

//couriers signup
router.post("/signup", fieldset, async function(req, res, next) {
    const { firstName, lastName, mobileNo, poaType, proofType } = req.body;
    try {
        var existCourier = await courierSchema.find({ mobileNo: mobileNo });
        if (existCourier.length == 1) {
            //Removing Uploaded Files
            var old = req.files.profileImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = req.files.poaFrontImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = req.files.poaBackImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            old = req.files.panCardImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            old = req.files.electricityImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            old = req.files.policeVerificationImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            res.status(200).json({
                Message: "Courier Already Registered!",
                Data: 0,
                IsSuccess: true,
            });
        } else {
            let cid = cidgenerator();
            var newCourier = new courierSchema({
                _id: new config.mongoose.Types.ObjectId(),
                cId: cid,
                firstName: firstName,
                lastName: lastName,
                mobileNo: mobileNo,
                poaType: poaType,
                proofType: proofType,
                profileImg: req.files.profileImg[0].path,
                poaFrontImg: req.files.poaFrontImg[0].path,
                poaBackImg: req.files.poaBackImg[0].path,
                panCardImg: req.files.panCardImg[0].path,
                electricityImg: req.files.electricityImg[0].path,
                policeVerificationImg: req.files.policeVerificationImg[0].path,
            });
            await newCourier.save();
            res
                .status(200)
                .json({ Message: "Courier Registered!", Data: 1, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//couriers sms
router.post("/sendotp", async function(req, res, next) {
    const { mobileNo, code } = req.body;
    try {
        let message = "Your verification code is " + code;
        let msgportal =
            "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" +
            process.env.SMS_USER +
            "&password=" +
            process.env.SMS_PASS +
            "&msisdn=" +
            mobileNo +
            "&sid=" +
            process.env.SMS_SID +
            "&msg=" +
            message +
            "&fl=0&gwid=2";
        let getresponse = await axios.get(msgportal);
        if (getresponse.data.ErrorMessage == "Success") {
            res
                .status(200)
                .json({ Message: "Message Sent!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Message Not Sent!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//couriers verify
router.post("/verify", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        var existCourier = await courierSchema.findOneAndUpdate({ mobileNo: mobileNo }, { isVerified: true });
        // console.log(existCourier);
        if (existCourier != null) {
            var newfirebase = config.docref.child(existCourier.id);
            newfirebase.set({
                latitude: "",
                longitude: "",
                duty: "OFF",
                parcel: 0,
            });
            res
                .status(200)
                .json({ Message: "Verification Complete!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Verification Failed!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/updateFcmToken", async function(req, res, next) {
    const { courierId, fcmToken } = req.body;
    try {
        var existCourier = await courierSchema.findByIdAndUpdate(
            courierId, {
                fcmToken: fcmToken,
            }, { new: true }
        );
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "FCM Token Updated!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "FCM Token Not Updated!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//couriers Login
router.post("/signin", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        var existCourier = await courierSchema.find({
            mobileNo: mobileNo,
            isActive: true,
        });
        if (existCourier.length == 1) {
            res.status(200).json({
                Message: "Delivery Partner Found!",
                Data: existCourier,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Delivery Partner Not Found!",
                Data: existCourier,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update couriers profile
router.post("/updateprofile", async function(req, res, next) {
    const { id, firstName, lastName } = req.body;
    try {
        var existCourier = await courierSchema.findByIdAndUpdate(id, {
            firstName: firstName,
            lastName: lastName,
        });
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "Profile Updated!", Data: 1, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "Profile Updation Failed!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update couriers bank details
router.post("/updatebank", async function(req, res, next) {
    const { id, ifscCode, bankName, accNo, branch } = req.body;
    try {
        var updateCourier = {
            bankDetail: {
                ifscCode: ifscCode,
                bankName: bankName,
                accNo: accNo,
                branch: branch,
            },
        };
        var existCourier = await courierSchema.findByIdAndUpdate(id, updateCourier);
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "BankDetail Updated!", Data: 1, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "BankDetail Updation Failed !",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update couriers vehicle data
router.post("/updatetransport", async function(req, res, next) {
    const { id, vehicleType, vehicleNo } = req.body;
    try {
        var updateCourier = {
            transport: {
                vehicleType: vehicleType,
                vehicleNo: vehicleNo,
            },
        };

        var existCourier = await courierSchema.findByIdAndUpdate(id, updateCourier);
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "TrasportDetail Updated!", Data: 1, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "TrasportDetail Updation Failed !",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get unreaded notification list of couriers
router.post("/notificationCounter", async function(req, res, next) {
    const courierId = req.body.courierId;
    try {
        let dataset = await courierNotificationSchema
            .find({ courierId: courierId })
            .countDocuments();
        res.json({
            Message: "Total Notification Found!",
            Data: dataset,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get notification list of couriers
router.post("/courierNotification", async function(req, res, next) {
    const courierId = req.body.courierId;
    var set = await courierNotificationSchema.find({
        courierId: courierId,
        isRead: false,
    });
    if (set.length != 0) {
        for (let i = 0; i < set.length; i++) {
            await courierNotificationSchema.findByIdAndUpdate(set[0]._id, {
                isRead: true,
            });
        }
    }
    res
        .status(200)
        .json({ Message: "Notification Found!", Data: set, IsSuccess: true });
});

router.post("/sendNotification", async function(req, res, next) {
    const { courierId, title, description } = req.body;
    try {
        let dataset = await courierSchema.find({ _id: courierId });
        if (dataset.length == 1) {
            let newNotification = new courierNotificationSchema({
                _id: new config.mongoose.Types.ObjectId(),
                courierId: courierId,
                title: title,
                description: description,
            });

            let data = {
                type: "info",
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            };

            var datdasa = await sendPopupNotification(
                dataset[0].fcmToken,
                title,
                description,
                data
            );
            // console.log(datdasa);
            await newNotification.save();

            res.json({
                Message: "Notification Sent!",
                Data: 1,
                IsSuccess: true,
            });
        } else {
            res.json({
                Message: "Notification Not Sent!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

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

//Get Employee All Orders -------31-12-2020----MONIL
router.post("/getEmpAllOrders", async function(req,res,next){
    const { courierId } = req.body;
    try {
        var record = await orderSchema.find({ 
                    courierId: courierId,
                    status: "Order Delivered", 
                    isActive: false,
                    // dateTime: {
                    //     $gte : date1,
                    //     $lte : date2
                    // },
                    })
                    .populate(
                            "courierId",
                            "firstName lastName fcmToken mobileNo accStatus transport isVerified"
                    )
                    .populate("customerId");
        var totalPrice = 0;
        var totalThirdPartCollect = 0;
        var totalDistance = 0;
        console.log(record);
        for(var i=0;i<record.length;i++){
            totalPrice = totalPrice + record[i].finalAmount;
            totalThirdPartCollect = totalThirdPartCollect + parseFloat(record[i].amountCollection);
            totalDistance = totalDistance + record[i].deliveryPoint.distance;
            // console.log(totalDistance);
        }
        console.log(totalPrice);
        console.log(totalDistance);
        if(record.length > 0){
            res.status(200).json({
                                   IsSuccess: true,
                                   TotalPriceCollected: totalPrice,
                                   TotalThirdPartyCollection : totalThirdPartCollect,
                                   TotalDistanceTravell: totalDistance,
                                   TotalDelivery: record.length, 
                                   Data: record, 
                                   Message: "Orders Found" 
                                });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Orders Not Found" });
        }
    } catch (error) {
        res.status(500).json({ Message: error.message, Data: 0, IsSuccess: false });
    }
}); 

//Employee Order History------25-11-2020---Monil
router.post("/getEmployeeOrderDetails", async function(req,res,next){
    const { courierId , startdate , enddate } = req.body;
    
    let date1 = convertStringDateToISO(startdate);
    let date2 = convertStringDateToISO(enddate);

    console.log(date1);
    console.log(date2);

    try {
        var record = await orderSchema.find({ 
                    courierId: courierId,
                    status: "Order Delivered", 
                    isActive: false,
                    dateTime: {
                        $gte : date1,
                        $lte : date2
                    },
                    // dateTime: "2020-12-09T08:34:06.969+00:00"
                    })
                    .populate(
                            "courierId",
                            "firstName lastName fcmToken mobileNo accStatus transport isVerified"
                    )
                    .populate("customerId");
        var totalPrice = 0;
        var totalDistance = 0;
        console.log(record);
        for(var i=0;i<record.length;i++){
            totalPrice = totalPrice + record[i].finalAmount;
            totalDistance = totalDistance + record[i].deliveryPoint.distance;
            // console.log(totalDistance);
        }
        console.log(totalPrice);
        console.log(totalDistance);
        if(record.length > 0){
            res.status(200).json({
                                   IsSuccess: true,
                                   TotalPriceCollected: totalPrice,
                                   TotalDistanceTravell: totalDistance,
                                   TotalOrders: record.length, 
                                   Data: record, 
                                   Message: "Orders Found" 
                                });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Orders Not Found" });
        }
    } catch (error) {
        res.status(500).json({ Message: error.message, Data: 0, IsSuccess: false });
    }
});

//Get Employee Order Details V2 18/12/2020--------------------
router.post("/getEmployeeOrderDetailsV2", async function(req,res,next){
    const { courierId , ofDate } = req.body;
    console.log(req.body);

    let ofDate1 = convertStringDateToISO(ofDate);
    let ofDate2 = convertStringDateToISOPlusOne(ofDate);

    console.log(ofDate1);
    console.log(ofDate2);

    try {
        var record = await orderSchema.find({ 
                    courierId: courierId,
                    status: "Order Delivered", 
                    isActive: false,
                    dateTime: {
                        $gte : ofDate1,
                        $lt : ofDate2
                    },
                    // dateTime: "2020-12-09T08:34:06.969+00:00"
                    })
                    .populate(
                            "courierId",
                            "firstName lastName fcmToken mobileNo accStatus transport isVerified"
                    )
                    .populate("customerId");
        var amount = 0;
        var thirdPartyCollection = 0;
        var totalPrice = 0;
        var totalDistance = 0;
        console.log(record);
        for(var i=0;i<record.length;i++){
            amount = amount + parseFloat(record[i].amount);
            thirdPartyCollection = thirdPartyCollection + parseFloat(record[i].amountCollection);
            totalPrice = totalPrice + parseFloat(record[i].finalAmount);
            totalDistance = totalDistance + parseFloat(record[i].deliveryPoint.distance);
            // console.log(totalDistance);
        }
        console.log(totalPrice);
        console.log(totalDistance);
        if(record.length > 0){
            res.status(200).json({
                                   IsSuccess: true,
                                   TotalPriceCollected: totalPrice,
                                   TotalDistanceTravell: totalDistance,
                                   TotalOrders: record.length, 
                                   Data: record, 
                                   Message: "Orders Found" 
                                });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Orders Not Found" });
        }
    } catch (error) {
        res.status(500).json({ Message: error.message, Data: 0, IsSuccess: false });
    }
});

router.post("/getAllEmployeeOrderHistory", async function(req,res,next){
    const { ofDate } = req.body;
    // console.log(req.body);

    let ofDate1 = convertStringDateToISO(ofDate);
    let ofDate2 = convertStringDateToISOPlusOne(ofDate);

    console.log(ofDate1);
    console.log(ofDate2);
    try {
        var courierIds = [];
        var courierOrdersData = [];
        var courierBoysAre = await courierSchema.find();
        for(var i=0;i<courierBoysAre.length;i++){
            // console.log(courierBoysAre[i]._id);
            courierIds.push(courierBoysAre[i]._id);
        }
        let totalOfAmount = 0;
        let totalOfThirdPartyCollection = 0;
        let totalOfTotalPrice = 0;
        let totalOfTotalDistance = 0;
        let totalOfTotalDelivery = 0;
        // console.log(courierIds);
        for(var j=0;j<courierIds.length;j++){
            // console.log(courierIds[j]);
            
            var record = await orderSchema.find({ 
                    courierId: courierIds[j],
                    status: "Order Delivered", 
                    isActive: false,
                    dateTime: {
                        $gte : ofDate1,
                        $lt : ofDate2
                    },
                })
                .populate(
                        "courierId",
                        "firstName lastName fcmToken mobileNo accStatus transport isVerified"
                )
                .populate("customerId");
            if(record.length > 0){
                // console.log(record[0].courierId[0].firstName);
                // console.log(record.length);
                // console.log(record[j].courierId);
                let Amount = 0;
                let ThirdPartyCollection = 0;
                let TotalPrice = 0;
                let TotalDistance = 0;
            
                for(let k=0;k<record.length;k++){
                    Amount = Amount + parseFloat(record[k].amount);
                    ThirdPartyCollection = ThirdPartyCollection + parseFloat(record[k].amountCollection);
                    TotalPrice = TotalPrice + parseFloat(record[k].finalAmount);
                    TotalDistance = TotalDistance + parseFloat(record[k].deliveryPoint.distance);
                }
                // console.log(Amount);
                // console.log(ThirdPartyCollection);
                // console.log(TotalPrice);
                // console.log(TotalDistance);
                var data = {
                    EmployeeName : record[0].courierId[0].firstName + " "+ record[0].courierId[0].lastName,
                    EmployeeId : record[0].courierId[0]._id,
                    EmployeeMobile : record[0].courierId[0].mobileNo,
                    AmoutCollect : Amount,
                    ThirdPartyCollection: ThirdPartyCollection,
                    TotalPrice: TotalPrice,
                    TotalDistance: TotalDistance,
                    TotalDelivery : record.length,
                }
                // console.log(data);
                courierOrdersData.push(data); 
            }
            // console.log("Index :" + j);
            // console.log(courierOrdersData);

        }
        let maxBusinessMakeBy = 0
        // let maxBusinessMakeBy = Math.max.apply(Math, courierOrdersData.map(function(o) { return o; }));
        if(courierOrdersData.length > 0){
            maxBusinessMakeBy = courierOrdersData.reduce(function(prev, current) {
                return (prev.TotalPrice > current.TotalPrice) ? prev : current
            }) //returns object
        }
        // console.log("maxBusinessMakeBy");
        // console.log(maxBusinessMakeBy);
        // console.log(courierOrdersData);
        for(datas in courierOrdersData){
            totalOfAmount = totalOfAmount + courierOrdersData[datas].AmoutCollect;
            totalOfThirdPartyCollection = totalOfThirdPartyCollection + courierOrdersData[datas].ThirdPartyCollection;
            totalOfTotalPrice = totalOfTotalPrice + courierOrdersData[datas].TotalPrice;
            totalOfTotalDistance = totalOfTotalDistance + courierOrdersData[datas].TotalDistance;
            totalOfTotalDelivery = totalOfTotalDelivery + courierOrdersData[datas].TotalDelivery;
        }
        console.log("Total Amount :"+totalOfAmount);
        console.log("Total ThirdParty :"+totalOfThirdPartyCollection);
        console.log("Total Price :"+totalOfTotalPrice);
        console.log("Total Distance :"+totalOfTotalDistance);
        console.log("Total Delivery :"+totalOfTotalDelivery);
        if(courierOrdersData.length > 0){
            res.status(200).json({ 
                IsSuccess: true,
                TotalAmount : totalOfAmount,
                TotalThirdParty : totalOfThirdPartyCollection,
                TotalPrice : totalOfTotalPrice,
                TotalDistance : totalOfTotalDistance,
                TotalDelivery : totalOfTotalDelivery, 
                Data: courierOrdersData,
                MaxPriceCollectedBy : maxBusinessMakeBy, 
                Message: "Data Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Data Not Found" });
        }
    } catch (error) {
        res.status(500).json({ Message: error.message, Data: 0, IsSuccess: false });
    }
});

//Till Now All Employee Order History------------31-12-2020---MONIL
router.post("/getAllEmployeeOrders", async function(req,res,next){
    try {
        var courierIds = [];
        var courierOrdersData = [];
        var courierBoysAre = await courierSchema.find();
        for(var i=0;i<courierBoysAre.length;i++){
            // console.log(courierBoysAre[i]._id);
            courierIds.push(courierBoysAre[i]._id);
        }
        let totalOfAmount = 0;
        let totalOfThirdPartyCollection = 0;
        let totalOfTotalPrice = 0;
        let totalOfTotalDistance = 0;
        let totalOfTotalDelivery = 0;
        // console.log(courierIds);
        for(var j=0;j<courierIds.length;j++){
            // console.log(courierIds[j]);
            
            var record = await orderSchema.find({ 
                    courierId: courierIds[j],
                    status: "Order Delivered", 
                    isActive: false,
                    // dateTime: {
                    //     $gte : ofDate1,
                    //     $lt : ofDate2
                    // },
                })
                .populate(
                        "courierId",
                        "firstName lastName fcmToken mobileNo accStatus transport isVerified"
                )
                .populate("customerId");
            if(record.length > 0){
                console.log(record[0].courierId[0].firstName);
                console.log(record.length);
                // console.log(record[j].courierId);
                let Amount = 0;
                let ThirdPartyCollection = 0;
                let TotalPrice = 0;
                let TotalDistance = 0;
            
                for(let k=0;k<record.length;k++){
                    Amount = Amount + parseFloat(record[k].amount);
                    ThirdPartyCollection = ThirdPartyCollection + parseFloat(record[k].amountCollection);
                    TotalPrice = TotalPrice + parseFloat(record[k].finalAmount);
                    TotalDistance = TotalDistance + parseFloat(record[k].deliveryPoint.distance);
                }
                // console.log(Amount);
                // console.log(ThirdPartyCollection);
                // console.log(TotalPrice);
                // console.log(TotalDistance);
                var data = {
                    EmployeeId : record[0].courierId[0]._id,
                    EmployeeName : record[0].courierId[0].firstName + " "+ record[0].courierId[0].lastName,
                    EmployeeMobile : record[0].courierId[0].mobileNo,
                    AmoutCollect : Amount,
                    ThirdPartyCollection: ThirdPartyCollection,
                    TotalPrice: TotalPrice,
                    TotalDistance: TotalDistance,
                    TotalDelivery : record.length,
                }
                console.log(data);
                courierOrdersData.push(data); 
            }
            // console.log("Index :" + j);
            console.log(courierOrdersData);

        }
        let maxBusinessMakeBy = 0
        // let maxBusinessMakeBy = Math.max.apply(Math, courierOrdersData.map(function(o) { return o; }));
        if(courierOrdersData.length > 0){
            maxBusinessMakeBy = courierOrdersData.reduce(function(prev, current) {
                return (prev.TotalPrice > current.TotalPrice) ? prev : current
            }) //returns object
        }
        console.log("maxBusinessMakeBy");
        console.log(maxBusinessMakeBy);
        console.log(courierOrdersData);
        for(datas in courierOrdersData){
            // console.log(courierOrdersData[datas]);
            
            totalOfAmount = totalOfAmount + courierOrdersData[datas].AmoutCollect;
            totalOfThirdPartyCollection = totalOfThirdPartyCollection + courierOrdersData[datas].ThirdPartyCollection;
            totalOfTotalPrice = totalOfTotalPrice + courierOrdersData[datas].TotalPrice;
            totalOfTotalDistance = totalOfTotalDistance + courierOrdersData[datas].TotalDistance;
            totalOfTotalDelivery = totalOfTotalDelivery + courierOrdersData[datas].TotalDelivery;
        }
        console.log("Total Amount :"+totalOfAmount);
        console.log("Total ThirdParty :"+totalOfThirdPartyCollection);
        console.log("Total Price :"+totalOfTotalPrice);
        console.log("Total Distance :"+totalOfTotalDistance);
        console.log("Total Delivery :"+totalOfTotalDelivery);
        if(courierOrdersData.length > 0){
            res.status(200).json({ 
                IsSuccess: true,
                TotalAmount : totalOfAmount,
                TotalThirdParty : totalOfThirdPartyCollection,
                TotalPrice : totalOfTotalPrice,
                TotalDistance : totalOfTotalDistance,
                TotalDelivery : totalOfTotalDelivery, 
                Data: courierOrdersData,
                MaxPriceCollectedBy : maxBusinessMakeBy, 
                Message: "Data Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Data Not Found" });
        }
    } catch (error) {
        res.status(500).json({ Message: error.message, Data: 0, IsSuccess: false });
    }
});

//Not Completed Yet----Not Any update for changes
router.post('/updateCustomerPickUp' , async function(req , res , next){

    const { orderNo , name , mobileNo , address , lat , long, completeAddress, contents , arriveType , arriveTime } = req.body;
    try { 
        let existOrder = await orderSchema.find({ orderNo : orderNo });
        if(existOrder.length > 0){
            
            let updateLocation = {
                pickupPoint:{
                    name : name,
                    mobileNo : mobileNo,
                    address : address,
                    lat : lat,
                    long : long,
                    completeAddress : completeAddress,
                    contents : contents,
                    arriveType: arriveType,
                    arriveTime: arriveTime,
                }
            };
            for(let i=0;i<existOrder.length;i++){
                let orderIdIs = existOrder[i]._id;
                let UpdatedCustomerPickUpLocation = await orderSchema.findByIdAndUpdate(orderIdIs,updateLocation);
            }
            let updatedDataIs = await orderSchema.find({orderNo : orderNo});
            if(updatedDataIs != null){
                res.status(200).json({ Message : "Customer Location Update" , IsSuccess : true , Data : updatedDataIs});
            }else{
                res.status(400).json({ Message : "Customer Location Not Update" , IsSuccess : false });
            }
        }
    } catch (error) {
        res.status(500).json({ Message : "Something Went Wrong" , ErrorMessage : error.message });
    }
});

//Update Order Delivery Location
router.post("/updateDeliveryLocation", async function(req,res,next){
    const { orderNo , multiOrderNo , name , mobileNo , address , lat , long, completeAddress, distance } = req.body;
    try {
        if(orderNo){
            //For Single Delivery Orders
            let existOrder = await orderSchema.find({ orderNo : orderNo });
            if(existOrder.length == 1){
                let updateLocation = {
                    deliveryPoint:{
                        name : name,
                        mobileNo : mobileNo,
                        address : address,
                        lat : lat,
                        long : long,
                        completeAddress : completeAddress,
                        distance : distance,
                    }
                };
                
                let orderIdIs = existOrder[0]._id;
                let UpdatedCustomerDropLocation = await orderSchema.findByIdAndUpdate(orderIdIs,updateLocation);
                let updatedDataIs = await orderSchema.find({orderNo : orderNo});
                if(updatedDataIs != null){
                    res.status(200).json({ Message : "Customer Location Update" , IsSuccess : true , Data : updatedDataIs});
                }else{
                    res.status(200).json({ Message : "Customer Location Not Update" , IsSuccess : true });
                }
            }else{
                res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Exist" });
            }
        }else if(multiOrderNo != null ){
            //For Multi Delivery order update drop on multiorderNo of particular delivery
            let existOrder = await orderSchema.find({ multiOrderNo : multiOrderNo });
            if(existOrder.length == 1){
                let updateLocation = {
                    deliveryPoint:{
                        name : name,
                        mobileNo : mobileNo,
                        address : address,
                        lat : lat,
                        long : long,
                        completeAddress : completeAddress,
                        distance : distance,
                    }
                };
                
                let orderIdIs = existOrder[0]._id;
                let UpdatedCustomerDropLocation = await orderSchema.findByIdAndUpdate(orderIdIs,updateLocation);
                let updatedDataIs = await orderSchema.find({orderNo : orderNo})
                if(updatedDataIs != null){
                    res.status(200).json({ Message : "Customer Location Update" , IsSuccess : true , Data : updatedDataIs});
                }else{
                    res.status(200).json({ Message : "Customer Location Not Update" , IsSuccess : true });
                }
            }else{
                res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Exist" });
            }
        }else{
            res.status(200).json({ IsSuccess: false , Data: [] , Message: "Wrong Inputs" });
        }
        
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Update Vendor DropLocation

router.post('/getOtp', (req, res, next) => {
    res.json({
        Message: "Data Found!",
        Data: 0,
        IsSuccess: true
    })
})

async function sendPopupNotification(fcmtoken, title, body, data) {
    let payload = { notification: { title: title, body: body }, data: data };
    let options = { priority: "high", timeToLive: 60 * 60 * 24 };
    let response = await config.firebase
        .messaging()
        .sendToDevice(fcmtoken, payload, options);
    return response;
}

function cidgenerator() {
    let pnd = "PND";
    let pndno = pnd + "" + (Math.floor(Math.random() * 90000) + 10000).toString();
    return pndno;
}

async function getcuurentlocation(id) {
    var CourierRef = config.docref.child(id);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    return data;
}

module.exports = router;