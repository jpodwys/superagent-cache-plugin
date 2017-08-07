var superagent = require('superagent');
var expect = require('expect');
var express = require('express');
var cModule = require('cache-service-cache-module');
var cache = new cModule();
var superagentCacheModule = require('../../index');
var superagentCache = superagentCacheModule(cache, { expiration: 1 });

var app = express();

const DEFAULT_CACHE_CONTROL = 'max-age=1';

function setResponseCacheControl(req, res) {
  res.set('Cache-Control', req.get('cache-control') || DEFAULT_CACHE_CONTROL);
};

app.get('/one', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {key: 'one'});
});

app.post('/one', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {key: 'post'});
});

app.put('/one', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {key: 'put'});
});

app.patch('/one', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {key: 'patch'});
});

app.delete('/one', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {key: 'delete'});
});

app.get('/redirect', function(req, res){
  setResponseCacheControl(req, res);
  res.redirect('/one');
});

app.get('/false', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {key: false});
});

app.get('/params', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {pruneQuery: req.query.pruneQuery, otherParams: req.query.otherParams});
});

app.get('/options', function(req, res){
  setResponseCacheControl(req, res);
  res.send(200, {pruneHeader: req.get('pruneHeader'), otherOptions: req.get('otherOptions')});
});

app.get('/four', function(req, res){
  setResponseCacheControl(req, res);
  res.send(400, {key: 'one'});
});

var count = 0;
app.get('/count', function(req, res){
  count++;
  setResponseCacheControl(req, res);
  if (req.query.etag) {
    res.set('ETag', '12345');
  }
  if (req.query.lastmodified) {
    res.set('Last-Modified', 'Wed, 21 Oct 2015 07:28:00 GMT');
  }
  res.send(200, {count: count});
});

app.listen(3000);

describe('superagentCache', function() {

  describe('API tests', function () {

    it('.end() should not require the \'err\' callback param', function (done) {
      superagent
        .get('localhost:3000/one')
        // .set('Cache-Control', 'max-age=0')
        // .set('Expires', 'Wed, 1 Aug 2017 10:22:00 GMT')
        .use(superagentCache)
        .expiration(5)
        .end(function (response){
          expect(response.body.key).toBe('one');
          done();
        }
      );
    });

    it('.get() .prune() .end() should prune response before caching', function (done) {
      var prune = function(r){
        return (r && r.ok && r.body) ? r.body.key : null;
      }
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .prune(prune)
        .end(function (err, response, key){
          expect(response).toBe('one');
          done();
        }
      );
    });

    it('.get() .responseProp() .end() should get responseProp before caching', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .responseProp('body')
        .end(function (err, response, key){
          expect(response.key).toBe('one');
          done();
        }
      );
    });

    it('.get() .expiration() .end() should override all caches\' defaultExpirations', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .expiration(0)
        .end(function (err, response, key){
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, entry){
            expect(entry).toBe(null);
            done();
          });
        }
      );
    });

    it('.get() .prune() .end() should cache an empty response', function (done) {
      var prune = function(r){
        return (r && r.ok && r.body) ? r.body.key : null;
      }
      superagent
        .get('localhost:3000/false')
        .use(superagentCache)
        .prune(prune)
        .cacheWhenEmpty(true)
        .end(function (err, response, key){
          expect(response).toBe(false);
          cache.get(key, function (err, entry){
            expect(entry.response).toBe(false);
            done();
          });
        }
      );
    });

    it('.get() .prune() .cacheWhenEmpty(false) .end() should not cache an empty response', function (done) {
      var prune = function(r){
        return (r && r.ok && r.body) ? r.body.key : null;
      }
      superagent
        .get('localhost:3000/false')
        .use(superagentCache)
        .prune(prune)
        .cacheWhenEmpty(false)
        .end(function (err, response, key){
          expect(response).toBe(false);
          cache.get(key, function (err, entry){
            expect(entry).toBe(null);
            done();
          });
        }
      );
    });

    it('.get() .query(object) .pruneQuery() .end() should query with all params but create a key without the indicated params', function (done) {
      superagent
        .get('localhost:3000/params')
        .use(superagentCache)
        .query({pruneQuery: true, otherParams: false})
        .pruneQuery(['pruneQuery'])
        .end(function (err, response, key){
          expect(response.body.pruneQuery).toBe('true');
          expect(response.body.otherParams).toBe('false');
          expect(key.indexOf('pruneQuery')).toBe(-1);
          expect(key.indexOf('otherParams')).toBeGreaterThan(-1);
          done();
        }
      );
    });

    it('.get() .query(string&string) .pruneQuery() .end() should query with all params but create a key without the indicated params', function (done) {
      superagent
        .get('localhost:3000/params')
        .use(superagentCache)
        .query('pruneQuery=true&otherParams=false')
        .pruneQuery(['pruneQuery'])
        .end(function (err, response, key){
          expect(response.body.pruneQuery).toBe('true');
          expect(response.body.otherParams).toBe('false');
          expect(key.indexOf('pruneQuery')).toBe(-1);
          expect(key.indexOf('otherParams')).toBeGreaterThan(-1);
          done();
        }
      );
    });

    it('.get() .query(string) .query(string) .pruneQuery() .end() should query with all params but create a key without the indicated params', function (done) {
      superagent
        .get('localhost:3000/params')
        .use(superagentCache)
        .query('pruneQuery=true')
        .query('otherParams=false')
        .pruneQuery(['pruneQuery'])
        .end(function (err, response, key){
          expect(response.body.pruneQuery).toBe('true');
          expect(response.body.otherParams).toBe('false');
          expect(key.indexOf('pruneQuery')).toBe(-1);
          expect(key.indexOf('otherParams')).toBeGreaterThan(-1);
          done();
        }
      )
    });

    it('.get() .pruneHeader() .end() should query with all options but create a key without the indicated options', function (done) {
      superagent
        .get('localhost:3000/options')
        .use(superagentCache)
        .set({pruneHeader: true, otherOptions: false})
        .pruneHeader(['pruneHeader'])
        .end(function (err, response, key){
          expect(response.body.pruneHeader).toBe('true');
          expect(response.body.otherOptions).toBe('false');
          //Before superagent 1.7.0, superagent converts headers to lower case. To be backwards compatible,
          //I check for lower as well as the upper case versions of the headers sent above
          expect(key.indexOf('pruneHeader')).toBe(-1);
          expect(key.indexOf('pruneHeader')).toBe(-1);
          var lowerOtherOptions = key.indexOf('otheroptions');
          var upperOtherOptions = key.indexOf('otherOptions');
          var otherOptionsIsPresent = (lowerOtherOptions > -1 || upperOtherOptions > -1);
          expect(otherOptionsIsPresent).toBe(true);
          done();
        }
      )
    });

    it('.get() .doQuery(false) .end() should not perform a query', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .doQuery(false)
        .end(function (err, response, key){
          expect(response).toBe(null);
          done();
        }
      )
    });

    it('.end() should not set \'err\' callback param on error', function (done) {
      superagent
        .get('localhost:3000/invalid')
        .use(superagentCache)
        .end(function (err, response){
          expect(err).toExist();
          done();
        }
      );
    });

    it('.get() .cacheWhenEmpty(false) .prune(function) should only cache responses with status code 2xx', function (done) {
      var prune = function(r){
        if(r && r.statusCode && r.statusCode.toString()[0] === '2'){
          return r.statusCode;
        }
        return null;
      }

      superagent
        .get('localhost:3000/four')
        .use(superagentCache)
        .cacheWhenEmpty(false)
        .prune(prune)
        .end(function (err, response, key) {
          cache.get(key, function (err, entry){
            expect(entry).toBe(null);
            superagent
              .get('localhost:3000/one')
              .use(superagentCache)
              .cacheWhenEmpty(false)
              .prune(prune)
              .end(function (err, response, key) {
                cache.get(key, function (err, entry){
                  expect(entry.response).toBe(200);
                  done();
                });
              }
            );
          });
        }
      );
    });

  });

  describe('Caching tests', function () {

    it('.get() .end() should retrieve and cache response', function (done) {
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          expect(response.body.key).toBe('one');
          cache.get(key, function (err, entry){
            expect(entry.response.body.key).toBe('one');
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
          cache.get(key, function (err, entry) {
            expect(entry).toBe(null);
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
          cache.get(key, function (err, entry) {
            expect(entry.response.body.key).toBe('one');
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
          cache.get(key, function (err, entry) {
            expect(entry.response.body.key).toBe('one');
            superagent
              .put('localhost:3000/one')
              .use(superagentCache)
              .end(function (err, response, key){
                expect(response.body.key).toBe('put');
                cache.get(key, function (err, entry) {
                  expect(entry).toBe(null);
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
          cache.get(key, function (err, entry) {
            expect(entry.response.body.key).toBe('one');
            superagent
              .patch('localhost:3000/one')
              .use(superagentCache)
              .end(function (err, response, key){
                expect(response.body.key).toBe('patch');
                cache.get(key, function (err, entry) {
                  expect(entry).toBe(null);
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
          cache.get(key, function (err, entry){
            expect(entry.response.body.key).toBe('one');
            superagent
              .del('localhost:3000/one')
              .use(superagentCache)
              .end(function (err, response, key){
                expect(response.body.key).toBe('delete');
                cache.get(key, function (err, entry){
                  expect(entry).toBe(null);
                  done();
                });
              }
            );
          });
        }
      );
    });

  });

  describe('configurability tests', function () {

    beforeEach(function (done) {
      cache.flush();
      done();
    });

    it('Should return null response when \'only-if-cached\' is set in the request header.', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .set('cache-control', 'only-if-cached')
        .end(function (err, response, key){
          expect(response).toBe(null);
          done();
        }
      );
    });

    it('Should be able to configure global settings: doQuery', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: false, expiration: 1});
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          cache.get(key, function (err, response) {
            expect(response).toBe(null);
            done();
          });
        }
      );
    });

    it('Global settings should be locally overwritten by chainables: doQuery', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: false, expiration: 1});
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .doQuery(true)
        .end(function (err, response, key){
          cache.get(key, function (err, entry) {
            expect(entry.response).toNotBe(null);
            expect(entry.response.body.key).toBe('one');
            done();
          });
        }
      );
    });

    it('Should be able to configure global settings: expiration', function (done) {
      superagentCache = superagentCacheModule(cache, { expiration: 1 });
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .end(function (err, response, key){
          cache.get(key, function (err, entry) {
            expect(entry.response).toNotBe(null);
            expect(entry.response.body.key).toBe('one');
            setTimeout(function(){
              superagent
                .get('localhost:3000/one')
                .use(superagentCache)
                .doQuery(false)
                .end(function (err, response, key){
                  cache.get(key, function (err, entry) {
                    expect(entry).toBe(null);
                    done();
                  });
                }
              );
            }, 2000);
          });
        }
      );
    });

    it('Global settings should be locally overwritten by chainables: expiration', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: false, expiration: 1});
      superagent
        .get('localhost:3000/one')
        .use(superagentCache)
        .doQuery(true)
        .expiration(5)
        .end(function (err, response, key){
          cache.get(key, function (err, entry) {
            expect(entry.response).toNotBe(null);
            expect(entry.response.body.key).toBe('one');
            setTimeout(function(){
              superagent
                .get('localhost:3000/one')
                .use(superagentCache)
                .end(function (err, response, key){
                  cache.get(key, function (err, entry) {
                    expect(entry.response).toNotBe(null);
                    expect(entry.response.body.key).toBe('one');
                    done();
                  });
                }
              );
            }, 1000);
          });
        }
      );
    });

    it('Global TTL settings should be overwritten by the one calculated from the response cache-control header', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      count = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .set('Cache-Control', 'max-age=3')
        .end(function (err, response, key){
          expect(response).toNotBe(null);
          expect(response.body.count).toBe(1);
          setTimeout(function(){
            superagent
              .get('localhost:3000/count')
              .use(superagentCache)
              .set('Cache-Control', 'max-age=3')
              .end(function (err, response, key){
                expect(response).toNotBe(null);
                expect(response.body.count).toBe(1);
                done();
              }
            );
          }, 1200);
        }
      );
    });

    it('Cache should be switched off by \'cache-control: no-cache\' header', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      count = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .set('Cache-Control', 'no-cache')
        .end(function (err, response, key){
          cache.get(key, function (err, entry) {
            expect(entry).toBe(null);
            done();
          });
        }
      );
    });

    it('Cache should be switched off by \'cache-control: no-store\' header', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      count = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .set('Cache-Control', 'no-store')
        .end(function (err, response, key){
          cache.get(key, function (err, entry) {
            expect(entry).toBe(null);
            done();
          });
        }
      );
    });

    it('Cache should be switched off by \'cache-control: max-age=0\' header', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      count = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .set('Cache-Control', 'max-age=0')
        .end(function (err, response, key){
          cache.get(key, function (err, entry) {
            expect(entry).toBe(null);
            done();
          });
        }
      );
    });

    it('Should return cached response, when response is cacheable and Etag doesn\'t change', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      count = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .query({ etag: true })
        .pruneQuery(['etag'])
        .end(function (err, response, key){
          expect(response).toNotBe(null);
          expect(response.body.count).toBe(1);
          // should response with 304 and refresh the policy.
          setTimeout(function(){
            superagent
              .get('localhost:3000/count')
              .use(superagentCache)
              .query({ etag: true })
              .pruneQuery(['etag'])
              .end(function (err, response, key){
                expect(response).toNotBe(null);
                expect(response.body.count).toBe(1);
                // should serve cached response according to refreshed policy.
                setTimeout(function(){
                  superagent
                    .get('localhost:3000/count')
                    .use(superagentCache)
                    .query({ etag: true })
                    .pruneQuery(['etag'])
                    .end(function (err, response, key){
                      expect(response).toNotBe(null);
                      expect(response.body.count).toBe(1);
                      done();
                    }
                  );
                }, 100);
              }
            );
          }, 990);
        }
      );
    });

    it('Should return cached response, when response is cacheable and Last-Modified doesn\'t change', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 1});
      count = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .query({ lastmodified: true })
        .pruneQuery(['lastmodified'])
        .end(function (err, response, key){
          expect(response).toNotBe(null);
          expect(response.body.count).toBe(1);
          setTimeout(function(){
            superagent
              .get('localhost:3000/count')
              .use(superagentCache)
              .query({ lastmodified: true })
              .pruneQuery(['lastmodified'])
              .end(function (err, response, key){
                expect(response).toNotBe(null);
                expect(response.body.count).toBe(1);
                done();
              }
            );
          }, 990);
        }
      );
    });

    it('Should return cached response, with proper handling of bypassed headers', function (done) {
      superagentCache = superagentCacheModule(cache, {
        doQuery: true,
        expiration: 1,
        bypassHeaders: ['x-correlation-id']
      });
      count = 0;
      var correlationId = 0;
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .set('x-correlation-id', correlationId++)
        .end(function (err, response, key){
          expect(response).toNotBe(null);
          expect(response.body.count).toBe(1);
          superagent
            .get('localhost:3000/count')
            .use(superagentCache)
            .set('x-correlation-id', correlationId++)
            .end(function (err, response, key){
                expect(response).toNotBe(null);
                expect(response.body.count).toBe(1);
                expect(response.header['x-cache']).toBe('HIT');
                expect(response.header['x-correlation-id']).toBe(1);
                done();
              }
            );
        }
      );
    });

  });

  describe('forceUpdate tests', function () {

    it('.forceUpdate() should prevent the module from hitting the cache', function (done) {
      superagentCache = superagentCacheModule(cache, {doQuery: true, expiration: 2});
      count = 0;
      cache.flush();
      superagent
        .get('localhost:3000/count')
        .use(superagentCache)
        .end(function (err, response, key){
          cache.get(key, function (err, entry){
            expect(entry.response.body.count).toBe(1);
            superagent
              .get('localhost:3000/count')
              .use(superagentCache)
              .forceUpdate()
              .end(function (err, response, key){
                expect(response.body.count).toBe(2);
                done();
              }
            );
          });
        }
      );
    });
  });

});
