const expect = require("expect.js");

const Merkury = require("./../../index.js");

describe("Merkury Integration", function() {

    const redisConfig = {}; //localhost:6379
    const topic = "merkury-test";
    let m = null;

    before(function(done){
        m = new Merkury(topic, redisConfig);
        m.on("error", console.log);
        m.connect().then(_ => done());
    });

    after(function(done){
       m.disconnect().then(_ => done());
    });

    it("should be able to pause and resume", function(done){
        m.pause();
        m.resume();
        done();
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

    it("should be able to see only one instance emit when calling race", function(done){

        const m2 = new Merkury(topic, redisConfig);
        const m3 = new Merkury(topic, redisConfig);

        Promise.all([m2.connect(), m3.connect()]).then(_ => {

            let hitCount = 0;
            const t = "locktest";
            m.on(t, d => {
                console.log("m1 hit");
                hitCount++;
            }, true);

            m2.on(t, d => {
                console.log("m2 hit");
                hitCount++;
            }, true);

            m3.on(t, d => {
                console.log("m3 hit");
                hitCount++;
            }, true);

            m.emit(t, true);
            m.emit(t, true);
            m.emit(t, true);
            m.emit(t, true);
            m.emit(t, true);

            setTimeout(() => {
                expect(hitCount).to.be.equal(5);
                done();
            }, 5)
        });
    });

});