"use strict";

const EventEmitter = require("events");
const Queue = require("./Queue.js");

const NOOP = () => {};
const HEALTH_CHECK_TOPIC = "health-check";

class Merkury extends EventEmitter {

    constructor(topicName, ioRedisConfig, blindConnect = false){
        super();

        this.topicName = null;
        this.ioRedisConfig = null;
        this._queue = null;

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
        this._queue._onError(error => {
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

        super.emit.apply(this, [message.event].concat(message.args));
    }

    emit(event, arg1, arg2, arg3, arg4, arg5){

        if(!arguments || arguments.length < 2){
            return super.emit("error", new Error("cannot emit events without event name and at least one argument"));
        }

        const message = {
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