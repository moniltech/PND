require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const router = express.Router();
const config = require("../config");
const mongoose = require("mongoose");
const moment = require('moment-timezone');

const upload = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/customers");
    },
    filename: function(req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
const uploadpic = multer({ storage: upload });

/* Data Models */
const customerSchema = require("../data_models/customer.signup.model");
const pickupAddressSchema = require("../data_models/pickupaddresses.model");
const settingsSchema = require("../data_models/settings.model");
const bannerSchema = require("../data_models/banner.model");
const promoCodeSchema = require("../data_models/promocode.model");
const usedpromoSchema = require("../data_models/used.promocode.model");
const parcelcategories = require("../data_models/category.model");
const orderRequestModel = require("../data_models/order.request.model");
const orderModel = require("../data_models/order.model");
const customerWallet = require("../data_models/customerWalletModel");
const customerWalletModel = require("../data_models/customerWalletModel");

/* Routes. */
router.get("/", function(req, res, next) {
    res.render("index", { title: "Invalid URL" });
});

function getRandomString(length) {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var result = '';
    for ( var i = 0; i < length; i++ ) {
        result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
}

//required functions
function registrationCode() {
    var result = "";
    var fourdigitsrandom = Math.floor(1000 + Math.random() * 9000);
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var charactersLength = characters.length;
    for (var i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    var finalcode = result + "" + fourdigitsrandom;
    return finalcode;
}

// customers app APIs
router.post("/signup", async function(req, res, next) {
    const { name, mobileNo, email, referalCode } = req.body;
    try {
        let existCustomer = await customerSchema.find({ mobileNo: mobileNo });
        if (existCustomer.length == 1) {
            res.status(200).json({
                Message: "Customer Already Registered!",
                Data: 0,
                IsSuccess: true,
            });
        } else {
            let newCustomer = new customerSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name,
                email: email,
                mobileNo: mobileNo,
                referalCode: referalCode,
                regCode: registrationCode(),
            });
            newCustomer.save();
            res
                .status(200)
                .json({ Message: "Customer Registered!", Data: 1, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/signup2", async function(req, res, next) {
    const { name, mobileNo, email } = req.body;
    try {
        let existCustomer = await customerSchema.find({ mobileNo: mobileNo });
        if (existCustomer.length == 1) {
            let b = [];
            res.status(200).json({
                Message: "Customer Already Registered!",
                Data: b,
                IsSuccess: true,
            });
        } else {
            let banks = [];
            let newCustomer = new customerSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name,
                email: email,
                mobileNo: mobileNo,
                referalCode: getRandomString(6),
                regCode: registrationCode(),
                walletAmount: 0,
            });
            let data = await newCustomer.save();
            if (data != null) {
                let newdata = [data];
                res
                    .status(200)
                    .json({
                        Message: "Customer Registered!",
                        Data: newdata,
                        IsSuccess: true,
                    });
            }
        }
    } catch (err) {
        let b = [];
        res.status(500).json({ Message: err.message, Data: b, IsSuccess: false });
    }
});

router.post("/sendotp", async function(req, res, next) {
    const { mobileNo, code, appSignature } = req.body;
    try {
        let message = "Your verification code is " + code + " " + appSignature;
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

router.post("/verify", async function(req, res, next) {
    const { mobileNo, fcmToken } = req.body;
    try {
        let updateCustomer = await customerSchema.findOneAndUpdate({ mobileNo: mobileNo }, { isVerified: true, fcmToken: fcmToken });
        if (updateCustomer != null) {
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

//20-10-2020 ----- FCM Token remove cause if no fcm token then user cant login/register
/* router.post("/verify", async function(req, res, next) {
    const { mobileNo } = req.body;
    console.log(req.body);
    try {
        let updateCustomer = await customerSchema.findOneAndUpdate({ mobileNo: mobileNo }, { isVerified: true });
            if (updateCustomer != null) {
                res
                    .status(200)
                    .json({ Message: "Verification Complete!", Data: 1, IsSuccess: true });
            } else {
                res
                    .status(200)
                    .json({ Message: "Verification Failed!", Data: 0, IsSuccess: true });
            }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});
 */
// router.post("/signin", async function(req, res, next) {
//     const { mobileNo } = req.body;
//     try {
//         let existCustomer = await customerSchema.find({
//             mobileNo: mobileNo,
//             isVerified: true,
//             isActive: true,
//         });
//         if (existCustomer.length == 1) {
//             res.status(200).json({
//                 Message: "Customer Found!",
//                 Data: existCustomer,
//                 IsSuccess: true,
//             });
//         } else {
//             res.status(200).json({
//                 Message: "Customer Not Found!",
//                 Data: existCustomer,
//                 IsSuccess: true,
//             });
//         }
//     } catch (err) {
//         res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
//     }
// });

//27-10-2020 if isVerified : false then also user can signIn
router.post("/signin", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        let existCustomer = await customerSchema.find({
            mobileNo: mobileNo,
            //isVerified: true,
            isActive: true,
        });
        if (existCustomer.length == 1) {
            res.status(200).json({
                Message: "Customer Found!",
                Data: existCustomer,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Customer Not Found!",
                Data: existCustomer,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});


router.post("/updateprofile", uploadpic.single("profilepic"), async function(
    req,
    res,
    next
) {
    const file = req.file;
    const { id, name, email } = req.body;
    try {
        if (file != undefined) {
            let existCustomer = await customerSchema.findByIdAndUpdate(id, {
                name: name,
                email: email,
                image: file.path,
            });
            if (existCustomer != null)
                res
                .status(200)
                .json({ Message: "Profile Updated!", Data: 1, IsSuccess: true });
            else
                res
                .status(200)
                .json({ Message: "Profile Not Updated!", Data: 0, IsSuccess: true });
        } else {
            let existCustomer = await customerSchema.findByIdAndUpdate(id, {
                name: name,
                email: email,
            });
            if (existCustomer != null)
                res
                .status(200)
                .json({ Message: "Profile Updated!", Data: 1, IsSuccess: true });
            else
                res
                .status(200)
                .json({ Message: "Profile Not Updated!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/savePickupAddress", async function(req, res, next) {
    const {
        customerId,
        vendorId,
        name,
        mobileNo,
        address,
        lat,
        long,
        completeAddress,
    } = req.body;
    try {
        if(vendorId != undefined && vendorId != null){
            let checkExistAddress = await pickupAddressSchema.aggregate([
                {
                    $match: {
                        $and: [
                            { vendorId: mongoose.Types.ObjectId(vendorId) },
                            { address: address }
                        ]
                    }
                }
            ]);
            // console.log(checkExistAddress);
            if(checkExistAddress.length >= 1){
                return res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Address Alreay Exist" });
            }else{
                let newaddress = new pickupAddressSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    name: name,
                    mobileNo: mobileNo,
                    address: address,
                    lat: lat,
                    long: long,
                    completeAddress: completeAddress,
                    vendorId: vendorId,
                });
                if(newaddress != null){
                    await newaddress.save();
                    res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Address Added!" })
                }else{
                    res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Address Not Added!" })
                }
            }
        }else{
            // console.log("------------------CUSTOMER---------------------------");
            let checkExistAddress = await pickupAddressSchema.aggregate([
                {
                    $match: {
                        $and: [
                            { customerId: mongoose.Types.ObjectId(customerId) },
                            { address: address }
                        ]
                    }
                }
            ]);
            // console.log(checkExistAddress);
            if(checkExistAddress.length > 1){
                return res.status(200).json({ IsSuccess: true , Data: [] , Message: "Address Alreay Exist" });
            }else{
                let newaddress = new pickupAddressSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    name: name,
                    mobileNo: mobileNo,
                    address: address,
                    lat: lat,
                    long: long,
                    completeAddress: completeAddress,
                    customerId: customerId,
                });
                if(newaddress != null){
                    await newaddress.save();
                    res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Address Added!" })
                }else{
                    res.status(200).json({ IsSuccess: true , Data: [] , Message: "Address Not Added!" })
                }
            }
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/pickupAddress", async function(req, res, next) {
    const { customerId , vendorId } = req.body;
    try {
        let getaddress;
        if(vendorId != undefined && vendorId != null){
            getaddress = await pickupAddressSchema.aggregate([
                {
                    $match: { vendorId: mongoose.Types.ObjectId(vendorId) }
                }
            ]);
        }else{
            getaddress = await pickupAddressSchema.aggregate([
                {
                    $match: { customerId: mongoose.Types.ObjectId(customerId) }
                }
            ]);
        }
        if (getaddress.length != 0) {
            res.status(200).json({
                Message: "Pickup Address Found!",
                Data: getaddress,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Pickup Address Not Added!",
                Data: getaddress,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/banners", async(req, res, next) => {
    try {
        let bannerlist = await bannerSchema.find({});
        let bottomBannerlist = await bannerSchema.find({ type : "bottom" });
        let categories = await parcelcategories.find({});
        let datalist = [{
            banners: bannerlist,
            categories: categories,
            bottomBannerlist : bottomBannerlist
        }];
        res.json({ Message: "Banners List!", Data: datalist, IsSuccess: true });
    } catch (err) {
        res.json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

// show availble promocodes for a purticular customer
router.post("/promocodes", async function(req, res, next) {
    const { customerId } = req.body;
    try {
        var datasets = [];
        var customerPastOrder = await orderModel.find({ customerId: customerId });
        console.log(customerPastOrder.length);
        if(customerPastOrder.length == 0){
            var listPromoCodes = await promoCodeSchema.find({ isActive: true });    
        }else{
            listPromoCodes = await promoCodeSchema.find({ isActive: true , isForNewUser: false });
        }
        console.log(listPromoCodes);
        for (var i = 0; i < listPromoCodes.length; i++) {
            let exist = await usedpromoSchema.find({
                customer: customerId,
                code: listPromoCodes[i].code,
            });
            if (exist.length == 0) datasets.push(listPromoCodes[i]);
        }

        if (datasets.length != 0) {
            res
                .status(200)
                .json({
                    Message: "Promocodes Found!",
                    Data: datasets,
                    IsSuccess: true,
                });
        } else {
            res
                .status(200)
                .json({
                    Message: "No Promocodes Found!",
                    Data: datasets,
                    IsSuccess: true,
                });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/getNewCustomerPromocode", async function(req,res,next){
    const { customerId } = req.body;
    try {
        var record = await orderModel.find({
            customerId : mongoose.Types.ObjectId(customerId),
        });
        // console.log(record);
        var newUserPromocodeLimit = await settingsSchema.find().select("NewUserUnderKm");
        // console.log(newUserPromocodeLimit[0].NewUserUnderKm);
        let dist = 7;
        if(record.length == 0 && dist < newUserPromocodeLimit[0].NewUserUnderKm )
        {
            var newUserpromocode = await promoCodeSchema.find({ isForNewUser: true });
            let discountPercent = newUserpromocode[0].discount;
            // console.log(discountPercent);
            let NewUserDiscountAmount = (140 * parseFloat(discountPercent)) / 100;
            // console.log(NewUserDiscountAmount);
        }
        if(record.length == 0){
            var promocode = await promoCodeSchema.find({ isForNewUser: true });
            if(promocode){
                res.status(200).json({ IsSuccess: true , Data: promocode , Message: "Applicable for NewUser Promocode" });
            }else{
                res.status(200).json({ IsSuccess: true , Data: 0 , Message: "No Promocode For New User" });
            }
        }else{
            res.status(200).json({ IsSuccess: false , Data: 0 , Message: "Not a New User" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

router.post('/getOtp', (req, res, next) => {
    console.log("---------------------hello logout----------------------");
    res.json({
        Message: "Customer Logout!",
        Data: 0,
        IsSuccess: true
    })
});

router.post('/updateCustomerOneField', async function(req,res,next){
    try {
        
        let customers = await customerSchema.aggregate([
            {
                $match: {}
            }
        ]);
        for(let i=0;i<customers.length;i++){
            console.log(customers[i]._id);
            let update = {
                referalCode : getRandomString(6)
            }
            console.log(update);
            let updateIs = await customerSchema.findByIdAndUpdate(customers[i]._id,update);
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get Customer Wallet amount-----------------------------SOHIL----------05/03/2021
router.post("/getCustomerWallet", async function(req,res,next){
    try {
        const { customerId } = req.body;

        let customerWallet = await customerSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(customerId)
                }
            },
            {
                $project: {
                    walletAmount: 1
                }   
            }
        ]); 

        if(customerWallet.length == 1){
            res.status(200).json({ IsSuccess: true , Data: customerWallet , Message: `Customer wallet Current price is ${customerWallet[0].walletAmount}` });
        }else{
            res.status(200).json({ IsSuccess: true , Data: customerWallet , Message: `No Customer found for customer id ${customerId}` });
        }

    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Add Money To Wallet of customer---------------------------------12/02/2021
router.post("/updateToWallet", async function(req,res,next){
    try {
        // console.log("===================");
        const { customerId , credit , debit , discription } = req.body;
        let addToWalletIs;
        let customerIs = await customerSchema.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(customerId) }
            }
        ]);
        // console.log(customerIs);
        console.log(customerIs[0].walletAmount);
        let prevWalletAmount = 0;
        if(customerIs[0].walletAmount){
            prevWalletAmount = parseFloat(customerIs[0].walletAmount);
        } 
        if(credit != undefined){
            addToWalletIs = await new customerWalletModel({
                customerId: customerId,
                credit: Number(credit),
                prevWalletAmount: prevWalletAmount,
                date: getCurrentDate(),
                time: getCurrentTime(),
                walletAmount: prevWalletAmount + credit,
                discription: discription,
            });
        }else{
            if(prevWalletAmount < debit){
                return res.status(200).json({ IsSuccess: true , Data: [] , CurrentBalance: prevWalletAmount , Message: "You have insufficient balance" });
            }
            addToWalletIs = await new customerWalletModel({
                customerId: customerId,
                debit: Number(debit),
                prevWalletAmount: prevWalletAmount,
                date: getCurrentDate(),
                time: getCurrentTime(),
                walletAmount: prevWalletAmount - debit,
                discription: discription,
            });
        }

        if(addToWalletIs != null){
            
            if(customerIs.length == 1){
                let updateIs = {
                    walletAmount: addToWalletIs.walletAmount
                }
                let updateInCustomer = await customerSchema.findByIdAndUpdate(customerId,updateIs);
                addToWalletIs.save();
                res.status(200).json({ IsSuccess: true , Data: [addToWalletIs] , Message: "Wallet Data Updated" });
            }else{
                res.status(200).json({ IsSuccess: true , Data: [addToWalletIs] , Message: "Please Enter Valid CustomerId" });
            }
            
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Wallet Data Not Updated" });
        }
        
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Customer Wallet Logs ------------------13/02/2021
router.post("/getWalletRecords", async function(req,res,next){
    try {
        const { customerId , fromDate , toDate } = req.body;
        let checkCustomer = await customerSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(customerId)
                }
            }
        ]);
        let projectRecords = {
            credit: 1,
            debit: 1,
            walletAmount: 1,
            discription: 1,
            date: 1,
            time: 1,
            customerId: 1,
            'Customer.name': 1,
            'Customer.email': 1,
            'Customer.mobileNo': 1,
            'Customer.regCode': 1,
        };
        let sortDate = { date: -1 , time: -1 };
        let walletLogsAre;
        if(checkCustomer.length == 1){
            if(fromDate != undefined && toDate != undefined && fromDate != null && toDate != null){
                let datesAre = generateDateList(fromDate,toDate);
                // console.log(datesAre);
                walletLogsAre = await customerWalletModel.aggregate([
                    {
                        $match: {
                            customerId : mongoose.Types.ObjectId(customerId),
                            date: {
                                $in: datesAre
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "customers",
                            localField: "customerId",
                            foreignField: "_id",
                            as: "Customer"
                        } 
                    },
                    {
                        $project: projectRecords
                    },
                    {
                        $sort: sortDate
                    }
                ]);
            }else if(toDate && fromDate == undefined){
                walletLogsAre = await customerWalletModel.aggregate([
                    {
                        $match: {
                            customerId : mongoose.Types.ObjectId(customerId),
                            date: toDate
                        }
                    },
                    {
                        $lookup: {
                            from: "customers",
                            localField: "customerId",
                            foreignField: "_id",
                            as: "Customer"
                        } 
                    },
                    {
                        $project: projectRecords
                    },
                    {
                        $sort: sortDate
                    }
                ]);
            }else{
                walletLogsAre = await customerWalletModel.aggregate([
                    {
                        $match: {
                            customerId : mongoose.Types.ObjectId(customerId)
                        }
                    },
                    {
                        $lookup: {
                            from: "customers",
                            localField: "customerId",
                            foreignField: "_id",
                            as: "Customer"
                        } 
                    },
                    {
                        $project: projectRecords
                    },
                    {
                        $sort: sortDate
                    }
                ]);
            }
            if(walletLogsAre.length > 0){
                res.status(200).json({ 
                                IsSuccess: true , 
                                Count: walletLogsAre.length ,
                                // FinalWalletAmount: , 
                                Data: walletLogsAre , 
                                Message: "User Wallet Logs Found" 
                            });
            }else{
                res.status(200).json({ IsSuccess: true , Data: [] , Message: "User Wallet Logs Not Found" });
            }
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: `No User Found for customerId ${customerId}` });
        }

    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

function generateDateList(start, end) {
    
    let date1 = start.split("/");
    let date2 = end.split("/");
    let fromDate = date1[2] + "-" + date1[1] + "-" + date1[0];
    let toDate = date2[2] + "-" + date2[1] + "-" + date2[0];
    
    fromDate = new Date(fromDate);
    toDate = new Date(toDate);

    // console.log([fromDate,toDate]);
    
    for(var arr=[],dt=new Date(fromDate); dt<=toDate; dt.setDate(dt.getDate()+1)){
        // console.log(dt);
        let temp = moment(dt)
                        .tz("Asia/Calcutta")
                        .format('DD/MM/YYYY, h:mm:ss a')
                        .split(',')[0];
        arr.push(temp);
        // console.log(temp);
    }
    return arr;
};

function getCurrentDate(){

    let date = moment()
            .tz("Asia/Calcutta")
            .format("DD/MM/YYYY, h:mm:ss a")
            .split(",")[0];

    return date;
}

function getCurrentTime(){

    let time = moment()
            .tz("Asia/Calcutta")
            .format("DD/MM/YYYY, h:mm:ss a")
            .split(",")[1];

    return time;
}

module.exports = router;