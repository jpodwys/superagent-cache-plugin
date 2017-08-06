const CachePolicy = require('http-cache-semantics');
module.exports = {
  /**
   * Generate a cache key unique to this query
   * @param {superagent} agent
   * @param {object} reg
   * @param {object} cProps
   */
  keygen: function(req, props){
    var cleanParams = null;
    var cleanOptions = null;
    var params = this.getQueryParams(req);
    var options = this.getHeaderOptions(req);
    props.pruneHeader = ['if-none-match', 'if-modified-since'].concat(props.pruneHeader || []);
    if(props.pruneQuery || props.pruneHeader){
      cleanParams = (props.pruneQuery) ? this.pruneObj(this.cloneObject(params), props.pruneQuery) : params;
      cleanOptions = (props.pruneHeader) ? this.pruneObj(this.cloneObject(options), props.pruneHeader, true) : options;
    }
    return JSON.stringify({
      method: req.method,
      uri: req.url,
      params: cleanParams || params || null,
      options: cleanOptions || options || null
    });
  },

  /**
   * Find and extract query params
   * @param {object} reg
   */
  getQueryParams: function(req){
    if(req && req.qs && !this.isEmpty(req.qs)){
      return req.qs;
    }
    else if(req && req.qsRaw){
      return this.arrayToObj(req.qsRaw);
    }
    else if(req && req.req){
      return this.stringToObj(req.req.path);
    }
    else if(req && req._query){
      return this.stringToObj(req._query.join('&'));
    }
    return null;
  },

  /**
   * Find and extract headers
   * @param {object} reg
   */
  getHeaderOptions: function(req){
    // I have to remove the User-Agent header ever since superagent 1.7.0
    // The cache-control header must also be removed.
    // Clone the request first, as we don't want to remove the headers from the original one, do we?
    const _req = req ? JSON.parse(JSON.stringify(req)) : req;
    const headersToPrune = ['user-agent', 'cache-control'];
    if(_req && _req.headers){
      return this.pruneObj(_req.headers, headersToPrune);
    }
    else if(_req && _req._header){
      return this.pruneObj(_req._header, headersToPrune);
    }
    else if(_req && _req.req && _req.req._headers){
      return this.pruneObj(_req.req._headers, headersToPrune);
    }
    else if(_req && _req.header){
      return this.pruneObj(_req.header, headersToPrune);
    }
    return null;
  },

  /**
   * Convert an array to an object
   * @param {array} arr
   */
  arrayToObj: function(arr){
    if(arr && arr.length){
      var obj = {};
      for(var i = 0; i < arr.length; i++){
        var str = arr[i];
        var kvArray = str.split('&');
        for(var j = 0; j < kvArray.length; j++){
          var kvString = kvArray[j].split('=');
          obj[kvString[0]] = kvString[1];
        }
      }
      return obj;
    }
    return null;
  },

  /**
   * Convert a string to an object
   * @param {string} str
   */
  stringToObj: function(str){
    if(str){
      var obj = {};
      if(~str.indexOf('?')){
        var strs = str.split('?');
        str = strs[1];
      }
      var kvArray = str.split('&');
      for(var i = 0; i < kvArray.length; i++){
        var kvString = kvArray[i].split('=');
        obj[kvString[0]] = kvString[1];
      }
      return obj;
    }
    return null;
  },

  /**
   * Remove properties from an object
   * @param {object} obj
   * @param {array} props
   * @param {boolean} isOptions
   */
  pruneObj: function(obj, props, isOptions){
    const lowerCasedProps = props.map(function (item) {
      return item.toLowerCase();
    });
    Object.keys(obj).forEach(function (key) {
      if (lowerCasedProps.indexOf(key.toLowerCase()) !== -1) {
        if(isOptions){
          delete obj[key.toLowerCase()];
        }
        delete obj[key];
      }
    });
    return obj;
  },

  /**
   * Simplify superagent's http response object
   * @param {object} r - The response.
   * @param {object} Request - The superagent's Request instance.
   * @param {object} props  - The request properties.
   */
  gutResponse: function(r, Request, props){
    var newResponse = {};
    newResponse.req = Request.toJSON();
    newResponse.body = r.body;
    newResponse.text = r.text;
    newResponse.header = r.header;
    newResponse.headers = r.header;
    newResponse.statusCode = r.statusCode;
    newResponse.status = r.status;
    newResponse.ok = r.ok;
    return newResponse;
  },

  /**
   * Determine whether a value is considered empty
   * @param {*} val
   */
  isEmpty: function(val){
    return (val === false || val === null || (typeof val == 'object' && Object.keys(val).length == 0));
  },

  /**
   * Return a clone of an object
   * @param {object} obj
   */
  cloneObject: function(obj){
    var newObj = {};
    for(var attr in obj) {
      if (obj.hasOwnProperty(attr)){
        newObj[attr] = obj[attr];
      }
    }
    return newObj;
  },

  /**
   * Reset superagent-cache's default query properties using the defaults object
   * @param {object} d
   */
  resetProps: function(d){
    return {
      doQuery: (typeof d.doQuery === 'boolean') ? d.doQuery : true,
      cacheWhenEmpty: (typeof d.cacheWhenEmpty === 'boolean') ? d.cacheWhenEmpty : true,
      prune: d.prune,
      pruneQuery: d.pruneQuery,
      pruneHeader: d.pruneHeader,
      responseProp: d.responseProp,
      expiration: d.expiration,
      forceUpdate: d.forceUpdate,
      preventDuplicateCalls: d.preventDuplicateCalls,
      backgroundRefresh: d.backgroundRefresh,
      bypassHeaders: d.bypassHeaders
    };
  },

  /**
   * Handle the varying number of callback output params
   * @param {function} cb
   * @param {object} err
   * @param {object} response
   * @param {string} key
   * @param {object} [Request] - Superagent Request instance. When provided it will emit the events.
   * @param {object} props  - The request internal properties.
   */
  callbackExecutor: function(cb, err, response, key, Request){
    if (response) {
      // Superagent response should bear only the 'header' attribute, this was only needed for the policy.
      delete response.headers;
      if (Request) {
        Request.emit('request', Request);
        if (err) {
          Request.emit('error', err);
        } else {
          Request.emit('response', response);
        }
      }
    }
    if(cb.length === 1){
      cb(response);
    }
    else if(cb.length > 1){
      cb(err, response, key);
    }
    else{
      throw new Error('UnsupportedCallbackException: Your .end() callback must pass at least one argument.');
    }
  },

  /**
   * Handles the request cache headers and eventually modifies the per request properties affecting caching.
   * This method is called in early stage, before any attempt to execute the request against the HTTP server.
   *
   * @param {object} req    - The request object.
   * @param {object} props  - The request-basis properties, which affect cache behavior.
   * @returns {object} The modified properties.
   */
  handleReqCacheHeaders: function (req, props) {
    const cacheControl = req.get('cache-control');
    if (typeof cacheControl === 'string') {
      if (cacheControl.toLowerCase().indexOf('only-if-cached') !== -1) {
        props.doQuery = false;
      }
      // the expiration can also be set via the Request header.
      const maxAgeMatch = cacheControl.toLowerCase().match(/^(.*max-age=)(\d*).*$/);
      if (maxAgeMatch) {
        props.expiration = parseInt(maxAgeMatch[2]);
      }
    }
    // We cheat the policy a bit here, giving the request instead of response (we don't have it at this stage),
    // as we want to parse the request headers for the caching control related values,
    // which could override the 'props' values.
    const policy = new CachePolicy(req.toJSON(), req.toJSON());
    // The 'no-store' will be checked here.
    // Note: The default 'policy.timeToLive()' is '0' (means when there's no Expires or max-age specified).
    // The legacy method 'expiration()' will set the policy TTL value via the Cache-Control max-age value,
    // so no conflicts here.
    props.expiration = policy.storable() ? Math.round(policy.timeToLive() / 1000) : 0;
  },

  /**
   * Returns the `expiration` (TTL) value calculated as a minimum of the `props.expiration` and `policy.timeToLive`.
   * The resulting value is multiplied by `2`due to enable further handling of the stale cache entries,
   * (when the policy allows for that).
   * The resulting value is to be used for underlying cache implementation.
   *
   * @param {object} props  - The request-basis properties, which affect cache behavior.
   * @param {object} policy - The cache policy.
   * @returns {number} The expiration (TTL) time in seconds.
   */
  getExpiration: function (props, policy) {
    return props.expiration
      ? Math.min(props.expiration * 2, Math.round(policy.timeToLive() * 2 / 1000))
      :  Math.round(policy.timeToLive() * 2 / 1000);
  },

  /**
   * Sets the response header value.
   *
   * @param {object} response - The response instance.
   * @param {string} name     - The header name.
   * @param {string} value    - The header value.
   * @returns {object} The incoming modified response.
   */
  setResponseHeader: function (response, name, value) {
    // both need to be checked as someone could do strange things with 'prune' or 'responseProp'.
    if (response) {
      if (response.header) {
        response.header[name] = value;
      }
      if (response.headers) {
        response.headers[name] = value;
      }
    }
    return response;
  },

  /**
   * Copies the header values declared with the `bypassHeaders` option from current request
   * to a cached response headers and its bound request headers.
   *
   * @param {object} response - The response instance.
   * @param {object} req      - The request object.
   * @param {object} props  - The request-basis properties, which affect cache behavior.
   * @returns {object} The incoming modified response.
   */
  copyBypassHeaders: function (response, req, props) {
    const self = this;
    if (props.bypassHeaders && props.bypassHeaders.forEach) {
      props.bypassHeaders.forEach(function (name) {
        const value = req.get(name);
        self.setResponseHeader(response, name, value);
        if (response.req && response.req.headers) {
          response.req.headers[name] = value;
        }
      });
    }
    return response;
  }
}
