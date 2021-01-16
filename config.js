require("dotenv").config();
const mongoose = require("mongoose");
const firebase = require("firebase-admin");

/*Configuration Firebase*/
const serviceAccount = require("./firebase-service.json");
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB,
});

var firedb = firebase.database();
var docref = firedb.ref("restricted_access/secret_document");

/*Database Connection*/
mongoose.connect(process.env.HOST, {
  useNewUrlParser : true,
  useUnifiedTopology : true,
  useFindAndModify: false,
  useCreateIndex: true,
});

mongoose.connection
  .once("open", () => console.log("DB Connected"))
  .on("error", (error) => {
    console.log("Error While Connecting With DB");
  });

module.exports = { mongoose, docref, firebase };
