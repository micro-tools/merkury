const expect = require("expect.js");

const Merkury = require("./../../index.js");

describe("Merkury Integration", function() {

    const redisConfig = {}; //localhost:6379
    let m = null;

    before(function(done){
        m = new Merkury("merkury-test", redisConfig);
        m.on("error", console.log);
        m.connect().then(_ => done());
    });

    after(function(done){
       m.disconnect().then(_ => done());
    });

    it("should be able to pause and resume", function(done){
        m.pause();
        m.resume();
    });

    it("should be able run a successfully healthcheck", function (done) {
        m.healthCheck().then(result => {
            console.log(result);
            done();
        }, e => {
           console.log(e);
            //no done() here
        });
    });

});