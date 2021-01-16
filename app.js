var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");

var indexRouter = require("./routes/index");
var adminRouter = require("./routes/admin");
var customersRouter = require("./routes/customer");
var courierRouter = require("./routes/courier");
var orderRouter = require("./routes/order");
var vendorRouter = require("./routes/vendor");
 
var app = express();
app.use(cors());
// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(__dirname + "/uploads"));

app.use("/", indexRouter);
app.use("/customers", customersRouter);
app.use("/couriers", courierRouter);
app.use("/orders", orderRouter);
app.use("/admin", adminRouter);
app.use("/vendor", vendorRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
