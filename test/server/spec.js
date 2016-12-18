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

app.post('/one', function(req, res){
  res.send(200, {key: 'post'});
});

app.put('/one', function(req, res){
  res.send(200, {key: 'put'});
});

app.patch('/one', function(req, res){
  res.send(200, {key: 'patch'});
});

app.delete('/one', function(req, res){
  res.send(200, {key: 'delete'});
});

app.get('/redirect', function(req, res){
  res.redirect('/one');
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

    it('.post() .end() should bypass all caching logic', function (done) {
      superagent
        .post('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(response.body.key).toBe('post');
          cache.get(key, function (err, response) {
            expect(response).toBe(null);
            done();
          });
        }
      );
    });

    it('.get(redirect) .end() should cache the result of the redirect using the original request\'s key', function (done) {
      superagent
        .get('http://localhost:3000/redirect')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(key).toBe('{"method":"GET","uri":"http://localhost:3000/redirect","params":null,"options":{}}');
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, response) {
            expect(response.body.key).toBe('one');
            done();
          });
        }
      );
    });

    it('.get() then .put() should invalidate cache', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, response) {
            expect(response.body.key).toBe('one');
            superagent
              .put('localhost:3000/one')
              .use(superagentCache)
              .end(function (err, response, key){
                expect(response.body.key).toBe('put');
                cache.get(key, function (err, response) {
                  expect(response).toBe(null);
                  done();
                });
              }
            );
          });
        }
      );
    });

    it('.get() then .patch() should invalidate cache', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, response) {
            expect(response.body.key).toBe('one');
            superagent
              .patch('localhost:3000/one')
              .use(superagentCache)
              .end(function (err, response, key){
                expect(response.body.key).toBe('patch');
                cache.get(key, function (err, response) {
                  expect(response).toBe(null);
                  done();
                });
              }
            );
          });
        }
      );
    });

    it('.get() then .del() should invalidate cache', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, response){
            expect(response.body.key).toBe('one');
            superagent
              .del('localhost:3000/one')
              .use(superagentCache)
              .end(function (err, response, key){
                expect(response.body.key).toBe('delete');
                cache.get(key, function (err, response){
                  expect(response).toBe(null);
                  done();
                });
              }
            );
          });
        }
      );
    });

  });

});
