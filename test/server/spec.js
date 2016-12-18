var superagent = require('superagent');
var expect = require('expect');
var express = require('express');
var cModule = require('cache-service-cache-module');
var cache = new cModule();
var superagentCache = require('../../index')(cache);

var app = express();

app.get('/one', function(req, res){
  res.send(200, {key: 'one'});
});

app.get('/four', function(req, res){
  res.send(400, {key: 'one'});
});

app.listen(3000);

describe('superagentCache', function(){

  describe('caching tests', function () {

    it('.get() .end() should retrieve and cache response', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, response){
            expect(response.body.key).toBe('one');
            done();
          });
        }
      );
    });

    // it('.post() .end() should bypass all caching logic', function (done) {
    //   superagent
    //     .post('localhost:3000/one')
    //     .end(function (err, response, key){
    //       expect(response.body.key).toBe('post');
    //       superagentCache.cache.get(key, function (err, response) {
    //         expect(response).toBe(null);
    //         done();
    //       });
    //     }
    //   );
    // });

    // it('.get(redirect) .end() should cache the result of the redirect using the original request\'s key', function (done) {
    //   superagent
    //     .get('http://localhost:3000/redirect')
    //     .end(function (err, response, key){
    //       expect(key).toBe('{"method":"GET","uri":"http://localhost:3000/redirect","params":null,"options":{}}');
    //       expect(response.body.key).toBe('one');
    //       superagentCache.cache.get(key, function (err, response) {
    //         expect(response.body.key).toBe('one');
    //         done();
    //       });
    //     }
    //   );
    // });

    // it('.get() then .put() should invalidate cache', function (done) {
    //   superagent
    //     .get('localhost:3000/one')
    //     .end(function (err, response, key){
    //       expect(response.body.key).toBe('one');
    //       superagent.cache.get(key, function (err, response) {
    //         expect(response.body.key).toBe('one');
    //         superagent
    //           .put('localhost:3000/one')
    //           .end(function (err, response, key){
    //             expect(response.body.key).toBe('put');
    //             superagent.cache.get(key, function (err, response) {
    //               expect(response).toBe(null);
    //               done();
    //             });
    //           }
    //         );
    //       });
    //     }
    //   );
    // });

    // it('.get() then .patch() should invalidate cache', function (done) {
    //   superagent
    //     .get('localhost:3000/one')
    //     .end(function (err, response, key){
    //       expect(response.body.key).toBe('one');
    //       superagent.cache.get(key, function (err, response) {
    //         expect(response.body.key).toBe('one');
    //         superagent
    //           .patch('localhost:3000/one')
    //           .end(function (err, response, key){
    //             expect(response.body.key).toBe('patch');
    //             superagent.cache.get(key, function (err, response) {
    //               expect(response).toBe(null);
    //               done();
    //             });
    //           }
    //         );
    //       });
    //     }
    //   );
    // });

    // it('.get() then .del() should invalidate cache', function (done) {
    //   superagent
    //     .get('localhost:3000/one')
    //     .end(function (err, response, key){
    //       expect(response.body.key).toBe('one');
    //       superagent.cache.get(key, function (err, response){
    //         expect(response.body.key).toBe('one');
    //         superagent
    //           .del('localhost:3000/one')
    //           .end(function (err, response, key){
    //             expect(response.body.key).toBe('delete');
    //             superagent.cache.get(key, function (err, response){
    //               expect(response).toBe(null);
    //               done();
    //             });
    //           }
    //         );
    //       });
    //     }
    //   );
    // });

  });

});
