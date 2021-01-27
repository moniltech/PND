const express = require('express');
const router = express.Router();
var config = require("../config");
// const fb = require('../firebaseAdmin');
// const db = fb.firestore();
const db = config.docref;
// const fcm = fb.messaging();
const fcm = config.firebase;
const moment = require('moment');

var Queue = require('bull');
var notificationsQueue = new Queue('topic notifications', { redis: { port: 3000, host: '192.168.56.1' } }); // Specify Redis connection using object

const notificationsCollection = 'notifications';
const donationsCollection = 'donations';

router.post('/send/topic/:topic', (req, res) => {
    // console.log("vfsrva====================");
    var topic = `/topics/${req.params.topic.toString()}`;

    var payload = {
        notification: {
            title: req.body.title,
            body: req.body.body
        }
    };

    var options = {
        priority: "high",
        timeToLive: 60 * 60 * 24
    };

    if (req.body.sendDate && req.body.sendHour) {
        var date = req.body.sendDate;
        var hour = req.body.sendHour;
        scheduleMessage(date, hour, topic, payload, options);
    } else {
        sendTopicNotification(topic, payload, options);
    }


    res.send(200);
});

//Schedule the job
async function scheduleMessage(date, hour, topic, payload, options, res) {
    var date = date.toString().split("/");
    var hour = hour.toString().split(":");
    console.log(date[2], date[1], date[0], hour[0], hour[1], 0);
    var jobDate = new Date(date[2], date[1] - 1, date[0], hour[0], hour[1]);

    console.log(jobDate);
    console.log(new Date());
    var jobDelay = ((jobDate.getTime() / 1000) - (Math.floor(new Date().getTime() / 1000)));

    console.log(jobDate.getTime() / 1000);
    console.log(Math.abs(jobDelay));
    console.log(Math.floor(new Date().getTime() / 1000));

    const job = await notificationsQueue.add({
        topic: topic,
        payload: payload,
        options: options
    }, { delay: Math.abs(jobDelay) });
    console.log(date + " " + hour);
}

//Process qued job
notificationsQueue.process(async (job, done) => {
    console.log(job.data);
    sendTopicNotification(job.data.topic, job.data.payload, job.data.options);
});

//Send notificaiton
function sendTopicNotification(topic, payload, options) {
    var currentTime = new Date().getTime();

    var target;
    switch (topic) {
        case "/topics/topicA":
            target = 'Donatorii cu grupa sanguină A'
            break;
        case "/topics/topicB":
            target = 'Donatorii cu grupa sanguină B'
            break;
        case "/topics/topicAB":
            target = 'Donatorii cu grupa sanguină AB'
            break;
        case "/topics/topic0":
            target = 'Donatorii cu grupa sanguină 0'
            break;
        case "/topics/topicAll":
            target = 'Toți donatorii'
            break;
        default:
            break;
    }
    fcm.sendToTopic(topic, payload, options)
        .then((response) => {
            db.collection(notificationsCollection).doc(currentTime.toString()).set({
                title: payload.notification.title,
                body: payload.notification.body,
                date: currentTime,
                target: target,
                status: "Notificarea a fost trimisă!"
            }).then((res) => {
                console.log('Create new notification ');
            });
            // Response is a message ID string.
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            db.collection(notificationsCollection).doc(currentTime.toString()).set({
                title: payload.notification.title,
                body: payload.notification.body,
                date: currentTime,
                target: topic,
                status: "Notificarea nu a fost trimisă!"
            }).then(() => {
                console.log('Create new notification');
            });
            console.log('Error sending message:', error);
        });
}
module.exports = router;