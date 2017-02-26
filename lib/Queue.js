"use strict";

const ioredis = require("ioredis");

class Queue {

    constructor(topic, config){
        this.topic = topic;
        this.config = config;

        this.pub = null;
        this.sub = null;
        this._errorCallback = null;
        this._paused = false;

        this._prepareConfig();
    }

    _prepareConfig(){

        if(!this.topic || typeof this.topic !== "string"){
            throw new Error("topic must be a valid string.");
        }

        if(!this.config || typeof this.config !== "object"){
            throw new Error("redis config is null, but it is mandatory.");
        }

        if(!this.config.retryStrategy){
            this.config.retryStrategy = (times) => {
                return Math.min(times * 2000, 30000);
            };
        }

        if(!this.config.sentinelRetryStrategy){
            this.config.sentinelRetryStrategy = (times) => {
                return Math.min(times * 2000, 30000);
            };
        }
    }

    _onError(error){
        if(typeof this._errorCallback === "function"){
            this._errorCallback(error);
        }
    }

    setErrorCallback(callback){
        this._errorCallback = callback;
    }

    pause(){
        this._paused = true;
    }

    resume(){
        this._paused = false;
    }

    subscribe(messageCallback){

        if(typeof messageCallback !== "function"){
            return Promise.reject("messageCallback has to be a function.");
        }

        if(this.sub){
            return Promise.reject("a subscription is already active on this queue.");
        }

        return new Promise((resolve, reject) => {

            this.sub = new ioredis(this.config);

            if(!this.sub){
                return reject("failed to setup ioredis client.");
            }

            this.sub.on("error", this._onError.bind(this));
            this.sub.subscribe(this.topic, (err, count) => {

                if(err){
                    return reject("error during subscription: " + err.message);
                }

                if(count !== 1){
                    return reject("failed to subscribe to topic: " + this.topic);
                }

                this.sub.on("message", (channel, message) => {

                    if(channel && channel === this.topic && !this._paused){
                        messageCallback(message);
                    }
                });

                resolve(true);
            });
        });
    }

    _setupPublish(){

        if(this.pub){
            return;
        }

        this.pub = new ioredis(this.config);

        if(!this.pub){
            throw new Error("failed to setup publish client.");
        }

        this.pub.on("error", this._onError.bind(this));
    }

    publish(message){

        if(this._paused){
            return Promise.resolve(true);
        }

        if(typeof message !== "string"){
            return Promise.reject("message to be published has to be a string.");
        }

        return new Promise(resolve => {

            this._setupPublish();

            this.pub.publish(this.topic, message);
            resolve(true);
        });
    }

    close(){

        if(this.sub){
            this.sub.disconnect();
            this.sub = null;
        }

        if(this.pub){
            this.pub.disconnect();
            this.pub = null;
        }
    }

}

module.exports = Queue;