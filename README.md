<center><img src="hermes.png?raw=true" height="245" /></center><br/>

# merkury

[![Build Status](https://travis-ci.org/krystianity/merkury.svg?branch=master)](https://travis-ci.org/krystianity/merkury)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()
[![5cf](https://img.shields.io/badge/5cf-approved-ff69b4.svg)]()

- merkury ~ mercury => hermes
- battle tested
- test coverage 80%+
- 100% promise api
- super simple `.on() and .emit() EventEmitter API`
- _lightweight_ and **fast**

```shell
    npm install --save merkury
```

## how does it help?
- (if got more time -> check "use case?" below)
- before you implement some sort of database polling, check out merkury
- just setup an instance of mercury in each service instance with the same
topic name and redis configuration
- listen for your event `mk.on("my-event",..);`
- whenever you receive information and need to update other instances
just call `mk.emit("my-event",..);` on **one** of your instances and **every**
single one will receive the update

## simple api usage
```javascript
    const Merkury = require("merkury");
    
    const ioRedisConfig = {
        host: "localhost",
        port: 6379
    };
    
    const mk = new Merkury("unique-service-name", ioRedisConfig, true);
    
    //super easy API just like the usual event-emitter:
    
    mk.on("my-event", (arg1, arg2, arg3) => { .. });
    mk.emit("my-event", "arg1", {}, "arg3");
    
    //some advanced sugar available:
    
    mk.disconnect().then(_ => { .. });
    mk.setConfig() / mk.setTopic();
    mk.connect().then(_ => { .. }); //reconnect with topic switch
    
    mk.pause();
    mk.resume() //pause & resume handler
    
    //subscribe to error events
    mk.on("error", err => { .. });
```

## event race-lock mode
```javascript

    mk1.on("my-event", arg1 => { console.write(arg1) });
    mk2.on("my-event", arg1 => { console.write(arg1) });
    mk3.on("my-event", arg1 => { console.write(arg1) });

    mk1.on("my-race-event", arg1 => { console.write(arg1) }, true);
    mk2.on("my-race-event", arg1 => { console.write(arg1) }, true);
    mk3.on("my-race-event", arg1 => { console.write(arg1) }, true);
    
    //with race mode disabled (usually)
    mk1.emit("my-event", 1); //output: 1\n1\n1\n
    
    //with race mode enabled
    mk1.emit("my-race-event", 1, 2, 3); //output: 1\n
    
    //race mode uses "redlock" algorithm to ensure only a single
    //Merkury{} instance will call its EventListener
    //merkury takes track of its race enabled events and is able
    //to remove them permanently when using e.g. mk1.removeListener(..)
```

## use-case?
- imagine a world full of microservices
- imagine you need high availabilty
- the first thing you will do is scale your microservices to multiple 
instances or containers
- imagine your instances run behind a load-balancer
- your service/code will now only receive requests on single instances
but you might need to do something with the received information on
every instance - you have to notify all your instances about the updated
information
- you could implement some sort of polling..but what if you could simply
notify the other instances? and _what if that was just as easy as emitting
a simple event_
