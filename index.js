const CachePolicy = require('http-cache-semantics');
var utils = require('./utils');

/**
 * superagentCache constructor
 * @constructor
 * @param {cache module} cache
 * @param {object} defaults (optional)
 */
module.exports = function(cache, defaults){
  var self = this;
  var supportedMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];
  var cacheableMethods = ['GET', 'HEAD'];
  this.cache = cache;
  this.defaults = defaults || {};

  return function (Request) {
    var props = utils.resetProps(self.defaults);

    /**
     * Whether to execute an http query if the cache does not have the generated key
     * @param {boolean} doQuery
     */
    Request.doQuery = function(doQuery){
      props.doQuery = doQuery;
      return Request;
    }

    /**
     * Remove the given params from the query object after executing an http query and before generating a cache key
     * @param {array of strings} pruneQuery
     */
    Request.pruneQuery = function(pruneQuery){
      props.pruneQuery = pruneQuery;
      return Request;
    }

    /**
     * Remove the given options from the headers object after executing an http query and before generating a cache key
     * @param {boolean} pruneHeader
     */
    Request.pruneHeader = function(pruneHeader){
      props.pruneHeader = pruneHeader;
      return Request;
    }

    /**
     * Execute some logic on superagent's http response object before caching and returning it
     * @param {function} prune
     */
    Request.prune = function(prune){
      props.prune = prune;
      return Request;
    }

    /**
     * Retrieve a top-level property from superagent's http response object before to cache and return
     * @param {string} responseProp
     */
    Request.responseProp = function(responseProp){
      props.responseProp = responseProp;
      return Request;
    }

    /**
     * Set an expiration for Request key that will override the configured cache's default expiration
     * @param {integer} expiration (seconds)
     */
    Request.expiration = function(expiration){
      props.expiration = expiration;
      return Request.set('cache-control', 'max-age=' + expiration);
    }

    /**
     * Whether to cache superagent's http response object when it "empty"--especially useful with .prune and .pruneQuery
     * @param {boolean} cacheWhenEmpty
     */
    Request.cacheWhenEmpty = function(cacheWhenEmpty){
      props.cacheWhenEmpty = cacheWhenEmpty;
      return Request;
    }

    /**
     * Whether to execute an http query regardless of whether the cache has the generated key
     * @param {boolean} forceUpdate
     */
    Request.forceUpdate = function(forceUpdate){
      props.forceUpdate = (typeof forceUpdate === 'boolean') ? forceUpdate : true;
      return Request;
    }

    /**
     * Array of header names, which should be bypassed from a request to a response.
     * This is useful for eg. some correlation ID, which binds a request with a response
     * and could be an issue when returning the cached response.
     * Note, that bypassed headers are copied only to cached responses.
     *
     * @param {string|string[]} bypassHeaders
     */
    Request.bypassHeaders = function(bypassHeaders){
      props.bypassHeaders = (typeof bypassHeaders === 'string') ? [bypassHeaders] : bypassHeaders;
      return Request;
    }

    var cachedEntry;

    // Special handling for the '304 Not Modified' case, which will only come out
    // in case of server responses with 'ETag' and/or 'Last-Modified' headers.
    Request.on('response', function (res) {
      if (res.status === 304 && cachedEntry) {
        // update the cache entry
        const key = utils.keygen(Request, props);
        const policy = CachePolicy.fromObject(cachedEntry.policy).revalidatedPolicy(Request.toJSON(), res).policy;
        cachedEntry.policy = policy.toObject();
        cache.set(key, cachedEntry, utils.getExpiration(props, policy));
        // modify response
        res.status = cachedEntry.response.status;
        res.statusCode = cachedEntry.response.statusCode;
        res.header = policy.responseHeaders();
        utils.setResponseHeader(res, 'x-cache', 'HIT');
        utils.copyBypassHeaders(res, Request, props);
        res.body = cachedEntry.response.body;
        res.text = cachedEntry.response.text;
        // cleanup
        cachedEntry = undefined;
      }
    });

    /**
     * Save the existing .end() value ("namespaced" in case of other plugins)
     * so that we can provide our customized .end() and then call through to
     * the underlying implementation.
     */
    var end = Request.end;

    /**
     * Execute all caching and http logic
     * @param {function} cb
     */
    Request.end = function(cb){
      utils.handleReqCacheHeaders(Request, props);
      Request.scRedirectsList = Request.scRedirectsList || [];
      Request.scRedirectsList = Request.scRedirectsList.concat(Request._redirectList);
      if(~supportedMethods.indexOf(Request.method.toUpperCase())){
        var _Request = Request;
        var key = utils.keygen(Request, props);
        if(~cacheableMethods.indexOf(Request.method.toUpperCase())){
          cache.get(key, function (err, entry) {
            cachedEntry = entry;
            const cachedResponse = entry ? entry.response : undefined;
            var policy = entry && entry.policy ? CachePolicy.fromObject(entry.policy) : undefined;
            if (cachedResponse && policy) {
              cachedResponse.header = policy.responseHeaders();
              utils.setResponseHeader(cachedResponse, 'x-cache', 'HIT');
              utils.copyBypassHeaders(cachedResponse, Request, props);
            }
            if(!err && cachedResponse && policy
              && policy.satisfiesWithoutRevalidation(Request.toJSON()) && !props.forceUpdate) {
              // Return the clone of the cached response.
              return utils.callbackExecutor(cb, null, JSON.parse(JSON.stringify(cachedResponse)), key, Request);
            }
            else{
              if(props.doQuery){
                if (policy) {
                  const headers = policy.revalidationHeaders(Request.toJSON());
                  Object.keys(headers).forEach(function(key) {
                    Request = Request.set(key, headers[key]);
                  });
                }
                end.call(Request, function (err, response){
                  if(err){
                    return utils.callbackExecutor(cb, err, response, key);
                  }
                  else if(response){
                    response.redirects = _Request.scRedirectsList;
                    policy = new CachePolicy(Request.toJSON(), utils.gutResponse(response, Request));
                    if(props.prune){
                      response = props.prune(response);
                    }
                    else if(props.responseProp) {
                      response = response[props.responseProp] || null;
                    }
                    else{
                      response = utils.gutResponse(response, Request);
                    }
                    utils.setResponseHeader(response, 'x-cache', 'MISS');
                    if ((0 !== props.expiration) && (!utils.isEmpty(response) || props.cacheWhenEmpty)) {
                      if (policy.storable() && policy.timeToLive() > 0) {
                        // The TTL in underlying caches will be policy TTL x 2, as we want to allow for
                        // further serving of the stale objects (when the policy allows for that).
                        const expiration = utils.getExpiration(props, policy);
                        const entry = { policy: policy.toObject() , response: response };
                        cache.set(key, entry, expiration , function () {
                          return utils.callbackExecutor(cb, null, response, key);
                        });
                      }
                      else {
                        return utils.callbackExecutor(cb, null, response, key);
                      }
                    }
                    else{
                      return utils.callbackExecutor(cb, null, response, key);
                    }
                  }
                });
              }
              else{
                // This is actually the 'only-if-cached' condition
                // (doQuery=false is exactly the same intention).
                // Returning the response status 504 as the RFC2616 states about the 'only-if-cached'.
                // See: https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.4.
                return utils.callbackExecutor(cb, null, {
                  status: 504,
                  header: {},
                }, key);
              }
            }
          });
        }
        else{
          end.call(Request, function (err, response){
            if(err){
              return utils.callbackExecutor(cb, err, response, key);
            }
            if(!err && response){
              var keyGet = key.replace('"method":"' + _Request.method + '"', '"method":"GET"');
              var keyHead = key.replace('"method":"' + _Request.method + '"', '"method":"HEAD"');
              cache.del([keyGet, keyHead], function (){
                utils.callbackExecutor(cb, err, response, key);
              });
            }
          });
        }
      }
      else{
        end.call(Request, function (err, response){
          return utils.callbackExecutor(cb, err, response, undefined);
        });
      }
    }
    return props.expiration !== undefined ? Request.set('Cache-control', 'max-age=' + props.expiration) : Request;
  }
}
