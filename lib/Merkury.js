"use strict";

const EventEmitter = require("events");
const Redlock = require("redlock");
const ioredis = require("ioredis");
const uuid = require("uuid");

const Queue = require("./Queue.js");

const NOOP = () => {};
const HEALTH_CHECK_TOPIC = "health-check";
const LOCK_TTL = 450;
const LOCK_PREFIX = "merkury-lock:";

class Merkury extends EventEmitter {

    constructor(topicName, ioRedisConfig, blindConnect = false){
        super();

        this.topicName = null;
        this.ioRedisConfig = null;
        this._queue = null;
        this._lock = null;
        this._lockClient = null;

        this._raceEvents = {};

        this.setTopic(topicName);
        this.setConfig(ioRedisConfig);

        if(blindConnect){
            this.connect().then(NOOP).catch(NOOP);
        }
    }

    setTopic(topicName){
        this.topicName = topicName;
    }

    setConfig(ioRedisConfig){
        this.ioRedisConfig = ioRedisConfig;
    }

    connect(){

        if(this._queue){
            return Promise.reject("there is already an open connection, close it first.");
        }

        this._queue = new Queue(this.topicName, this.ioRedisConfig);
        this._queue.setErrorCallback(error => {
            super.emit("error", error);
        });

        this._lockClient = new ioredis(this.ioRedisConfig);

        this._lock = new Redlock([this._lockClient], {
            driftFactor: 0.01,
            retryCount: 1,
            retryDelay: 200,
            retryJitter: 200
        });

        this._lock.on("error", error => {
            super.emit("error", error);
        });

        return this._queue.subscribe(this._onMessage.bind(this));
    }

    disconnect(){

        if(!this._queue){
            return Promise.reject("there is no open connection that could be closed.");
        }

        this._queue.close();
        this._queue = null;

        this._lockClient.disconnect();
        this._lockClient = null;
        this._lock = null;

        return Promise.resolve(true);
    }

    pause(){
        this._queue.pause();
    }

    resume(){
        this._queue.resume();
    }

    _onMessage(message){

        try {
            message = JSON.parse(message);
        } catch(e){
            return super.emit("error", new Error("failed to parse message: " + e));
        }

        if(!message || !message.event){
            return super.emit("error", new Error("received corrupt internal message."));
        }

        if(!this._raceEvents[message.event]){
            return super.emit.apply(this, [message.event].concat(message.args));
        }

        //try to grab a lock since this message belongs to a race-enabled event
        this._lock.lock(LOCK_PREFIX + message.id, LOCK_TTL).then(lock => {
            super.emit.apply(this, [message.event].concat(message.args));
            return lock.unlock();
        }).catch(error => {
             super.emit("error", error);
        });
    }

    /**
     * overwrite
     * @param event
     * @param reference
     */
    removeListener(event, reference){

        if(this._raceEvents[event]){
            if(this._raceEvents[event] <= 1){
                delete this._raceEvents[event];
            } else {
                this._raceEvents[event]--;
            }
        }

        return super.removeListener(event, reference);
    }

    /**
     * overwrite
     * @param event
     * @param reference
     * @param race
     */
    on(event, reference, race = false){

        if(race){
            if(this._raceEvents[event]){
                this._raceEvents[event]++;
            } else {
                this._raceEvents[event] = 1;
            }
        }

        return super.on(event, reference);
    }

    /**
     * overwrite
     * @param event
     * @param arg1
     * @param arg2
     * @param arg3
     * @param arg4
     * @param arg5
     * @returns {*}
     */
    emit(event, arg1, arg2, arg3, arg4, arg5){

        if(!arguments || arguments.length < 2){
            return super.emit("error", new Error("cannot emit events without event name and at least one argument"));
        }

        const message = {
            id: uuid.v4(),
            event: arguments[0],
            args: Array.prototype.slice.call(arguments, 1, arguments.length)
        };

        this._queue.publish(JSON.stringify(message));
    }

    healthCheck(){
        return new Promise((resolve, reject) => {

            const startT = Date.now();
            let rec = false;

            const t = setTimeout(() => {
                if(!rec){
                    rec = true;
                    reject("healthcheck timed out.");
                }
            }, 1000);

            const val = Date.now();

            this.on(HEALTH_CHECK_TOPIC, message => {

                if(t && !rec){

                    if(message !== val){
                        return;
                    }

                    rec = true;
                    clearTimeout(t);
                    const duration = Date.now() - startT;
                    resolve(`healtheck successfull, took: ${duration} ms.`);
                }
            });

            this.emit(HEALTH_CHECK_TOPIC, val);
        });
    }

}

module.exports = Merkury;