let mongoose = require('mongoose');

let scheduleNotificationSchema = mongoose.Schema({
    orderNo: {
        type: String,
    },
    scheduleDate: {
        type: String,
    },
    scheduleTime: {
        type: String
    }
});

module.exports = mongoose.model("ScheduleNotification",scheduleNotificationSchema)