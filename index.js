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
            const cachedResponse = entry ? entry.response : undefined;
            var policy = entry && entry.policy ? CachePolicy.fromObject(entry.policy) : undefined;
            if(!err && cachedResponse && policy
              && policy.satisfiesWithoutRevalidation(Request.toJSON()) && !props.forceUpdate) {
              cachedResponse.headers = policy.responseHeaders();
              utils.callbackExecutor(cb, err, cachedResponse, key);
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
                    if (err.status === 304 && cachedResponse) {
                      return utils.callbackExecutor(cb, err, cachedResponse, key);
                    }
                    return utils.callbackExecutor(cb, err, response, key);
                  }
                  else if(response){
                    // just in case that superagent would stop handling '304 - Not Modified' as an Error.
                    if (response.status === 304 && cachedResponse) {
                      return utils.callbackExecutor(cb, err, cachedResponse, key);
                    }
                    response.redirects = _Request.scRedirectsList;
                    policy = new CachePolicy(Request.toJSON(), utils.gutResponse(response));
                    if(props.prune){
                      response = props.prune(response);
                    }
                    else if(props.responseProp) {
                      response = response[props.responseProp] || null;
                    }
                    else{
                      response = utils.gutResponse(response);
                    }
                    if ((0 !== props.expiration) && (!utils.isEmpty(response) || props.cacheWhenEmpty)) {
                      if (policy.storable() && policy.timeToLive() > 0) {
                        const expiration = props.expiration
                          ? Math.min(props.expiration, Math.round(policy.timeToLive()/1000, 0))
                          :  Math.round(policy.timeToLive()/1000, 0);
                        const entry = { policy: policy.toObject() , response: response };
                        cache.set(key, entry, expiration , function () {
                          return utils.callbackExecutor(cb, err, response, key);
                        });
                      }
                      else {
                        return utils.callbackExecutor(cb, err, response, key);
                      }
                    }
                    else{
                      return utils.callbackExecutor(cb, err, response, key);
                    }
                  }
                });
              }
              else{
                return utils.callbackExecutor(cb, null, null, key);
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
