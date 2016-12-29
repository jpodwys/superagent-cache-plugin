# superagent-cache-plugin

A superagent plugin providing flexible, built-in caching.

Currently compatible with superagent `1.x`.

# Contents

* [Basic Usage](#basic-usage)
* [Install](#install)
* [Run Tests](#run-tests)
* [How Does it Work?](#how-does-it-work)
* [What Exactly Gets Cached?](#what-exactly-gets-cached)
* [Where Does superagent-cache-plugin Store Data?](#where-does-superagent-cache-plugin-store-data)
* [Available Configuration Options](#available-configuration-options)
* [Supported Caches](#supported-caches)
* [API](#api)
* [More Usage Examples](#more-usage-examples)
* [Release Notes](https://github.com/jpodwys/superagent-cache-plugin/releases)

# Basic Usage

Require and instantiate superagent-cache-plugin as follows to get the [default configuration](#what-does-the-default-configuration-give-me):
```javascript
// Require and instantiate a cache module
var cacheModule = require('cache-service-cache-module');
var cache = new cacheModule({storage: 'session', defaultExpiration: 60});

// Require superagent-cache-plugin and pass your cache module
var superagentCache = require('superagent-cache-plugin')(cache);
```
Now you're ready for the magic! Just add `.use(superagentCache)` to any query and your `GET` and `HEAD` requests will be cached! Any matching `DELETE`, `POST`, `PUT`, or `PATCH` requests will automatically invalidate the associated cache key and value as long as you include `.use(superagentCache)`.
```javascript
superagent
  .get(uri)
  .use(superagentCache)
  .end(function (err, response){
    // response is now cached!
    // subsequent calls to this superagent request will now fetch the cached response
  }
);
```
Enjoy!

# Install

```javascript
npm install superagent-cache-plugin --save
```

# Run Tests

```javascript
npm test
```

# How Does it Work?

`superagent-cache-plugin` uses `superagent`'s [plugin API](https://github.com/visionmedia/superagent#plugins) to patch requests on a per-query level. This means that using `superagent-cache-plugin` for a single query will not impact any other queries. Whenever a `GET` or `HEAD` request is made with `.use(superagentCache)`, `superagent-cache-plugin` generates a cache key by stringifying four properties:

* your cache's `nameSpace` attribute (defaults to `undefined` if the property is not set)
* you request's URI
* your request's query params whether they're passed as an object or a string
* your request's headers

With the generated cache key, `superagent-cache-plugin` then checks the cache instance you passed in when you `require`d it. If the key exists, `superagent-cache-plugin` returns it without performing the `HTTP` request and if the key does not exist, it makes the request, caches the `response` object ([mostly](#what-exactly-gets-cached)), and returns it.

# What Exactly Gets Cached?

If you don't use the `.prune()` or `.responseProp()` chainables detailed in the [API](#api), then `superagent-cache-plugin` will cache a gutted version of the `response` object. There are two reasons it doesn't just cache the entire `response` object:

* The object is almost always circular and therefore not feasible to serialize
* The object is _huge_ and would use way more space than necessary

`superagent-cache-plugin` takes all of the following properties from the `response` object and clones each of them into a new object which then gets cached:

* response.body
* response.text
* response.headers
* response.statusCode
* response.status
* response.ok

If you find yourself occasionally needing more than this, try out the `.prune()` or `.responseProp()` chainables. If your find yourself consistently needing more than this, make a pull request that adds the properties you need.

# Where does superagent-cache-plugin store data?

`superagent-cache-plugin` stores data in whatever cache module you pass into the `require` command as shown in the [Basic Usage](#basic-usage) demo. It can natively handle any cache that matches [cache-service](https://github.com/jpodwys/cache-service)'s API. See this list of [supported caches](#supported-caches) to see what works best with your use case. Because `cache-service` and all of the supported caches have identical APIs, `superagent-cache-plugin` doesn't care which you use, so pick the one that's best for you or make a new one.

# Available Configuration Options

All options that can be passed to the `defaults` `require` param can be overwritten with chainables of the same name. All of the below options are detailed in the [API section](#api).

* responseProp
* prune
* pruneParams
* pruneOptions
* expiration
* cacheWhenEmpty
* doQuery
* forceUpdate

# Supported Caches

#### cache-service-cache-module

A super-light in-memory cache for cache-service or standalone use. [Available on NPM](https://github.com/jpodwys/cache-service-cache-module).

#### cache-service

A tiered caching solution capable of wrapping any number of the below supported caches. [Available on NPM](https://github.com/jpodwys/cache-service).

#### cache-service-redis

A redis wrapper for cache-service or standalone use. [Available on NPM](https://github.com/jpodwys/cache-service-redis).

#### cache-service-node-cache

An in-memory cache wrapper for cache-service or standalone use. [Available on NPM](https://github.com/jpodwys/cache-service-node-cache).

# API

## require('superagent-cache-plugin')(cache, [defaults])

`cache` is an instance of any of the [supported caches](#supported-caches) and `defaults` is an object with any of the [available configuration options](#available-configuration-options).

#### Arguments

* (required) cache: the cache instance in which `superagent-cache-plugin` stores all of its data
* (optional) defaults: an object that allows you to set defaults to be applied to all queries

## .get(uri), .head(uri)

Same as superagent except that superagent's response object will be cached.

## .put(uri), .post(uri), .patch(uri), .del(uri)

Same as superagent except that the generated cache key will be automatically invalidated when these `HTTP` verbs are used.

## .then(resolve, reject)

In its [`1.3.0` release](https://github.com/visionmedia/superagent/releases/tag/v1.3.0), superagent added fake promise support in the form of a `.then()` chainable that accepts two functions. Before superagent `2.x`, this function does not return a real promise. Rather, it calls `.end()` internally and then decides which function (`resolve` or `reject`) to call. (superagent-cache-plugin does not yet support superagent `2.x`.)

> Should work with [`superagent-promise`](https://github.com/lightsofapollo/superagent-promise), [`superagent-bluebird-promise`](https://github.com/KyleAMathews/superagent-bluebird-promise), and [`superagent-promise-plugin`](https://github.com/jomaxx/superagent-promise-plugin) (perhaps others as well).

I've overwritten superagent's `.then()` so that the provided `resolve` function accepts the generate cache key as follows:

```javascript
superagent
  .get(uri)
  .use(superagentCache)
  .then(function (response, key){
    // handle response--key is available if desired
  }, function (err){
    // handle the error
  }
);

```

## .end(callback ([err,] response [, key]))

Same as superagent except it optionally exposes the key superagent-cache-plugin generates as the third param in the callback's argument list. See the [usage example](#end-callback-argument-list-options) for a more detailed explanation.

## .responseProp(prop)

> Caution: if you use this function, `supergent-cache-plugin` [will not gut](#what-exactly-gets-cached) the `response` object for you. Be sure that the result of your `.responseProp()` call will never be circular and is not larger than it needs to be. Consider using `.prune()` if you need to dig several layers into the `response` object.

If you know you want a single, top-level property from superagent's response object, you can optimize what you cache by passing the property's name here. When used, it causes the `.end()` function's response to return superagent's response[prop].

#### Arguments

* prop: string

#### Example

```javascript
//response will now be replaced with superagent's response.body
//but all other top-level response properties, such as response.ok and response.status, will be ommitted
superagent
  .get(uri)
  .use(superagentCache)
  .responseProp('body')
  .end(function (error, response){
    // handle response
  }
);
```

## .prune(callback (response))

> Caution: if you use this function, `supergent-cache-plugin` [will not gut](#what-exactly-gets-cached) the `response` object for you. Be sure that the result of your `.prune()` callback function will never be circular and is not larger than it needs to be.

If you need to dig several layers into superagent's response, you can do so by passing a function to `.prune()`. Your prune function will receive superagent's response and should return a truthy value or `null`. The benefit of using this function is that you can cache only what you need.

#### Arguments

* callback: a function that accepts superagent's response object and returns a truthy value or null

#### Example

```javascript
var prune = function(r){
  return (r && r.ok && r.body && r.body.user) ? r.body.user : null;
}

//response will now be replaced with r.body.user or null
//and only r.body.user will be cached rather than the entire superagent response
superagent
  .get(uri)
  .use(superagentCache)
  .prune(prune)
  .end(function (error, response){
    // handle response
  }
);
```

## .pruneParams(params)

In the event that you need certain query params to execute a query but cannot have those params as part of your cache key (useful when security or time-related params are sent), use `.pruneParams()` to remove those properties. Pass `.pruneParams()` an array containing the param keys you want omitted from the cache key.

#### Arguments

* params: array of strings

#### Example

```javascript
//the superagent query will be executed with all params
//but the key used to store the superagent response will be generated without the passed param keys
superagent
  .get(uri)
  .use(superagentCache)
  .query(query)
  .pruneParams(['token'])
  .end(function (error, response){
    // handle response
  }
);
```

## .pruneOptions(options)

This function works just like the `.pruneParams()` funciton except that it modifies the arguments passed to the `.set()` chainable method (headers) rather than those passed to the `.query()` chainable method.

#### Arguments

* options: array of strings

#### Example

```javascript
//the superagent query will be executed with all headers
//but the key used to store the superagent response will be generated without the passed header keys
superagent
  .get(uri)
  .use(superagentCache)
  .set(options)
  .pruneOptions(['token'])
  .end(function (error, response){
    // handle response
  }
);
```

## .expiration(seconds)

Use this function when you need to override your `cache`'s `defaultExpiration` property for a particular cache entry.

#### Arguments

* seconds: integer

## .cacheWhenEmpty(bool)

Tell `superagent-cache-plugin` whether to cache the response object when it's `false`, `null`, or `{}`.This is especially useful when using `.responseProp()` or `.prune()` which can cause `response` to be falsy. By default, `cacheWhenEmpty` is `true`.

#### Arguments

* bool: boolean, default: true

## .doQuery(bool)

Tell `superagent-cache-plugin` whether to perform an ajax call if the generated cache key is not found. By default, doQuery is true.

#### Arguments

* bool: boolean, default: true

## .forceUpdate(bool)

Tells `superagent-cache-plugin` to perform an ajax call regardless of whether the generated cache key is found. By default, forceUpdate is false.

#### Arguments

* bool: boolean, default: false

## superagentCache.cache

This is the first constructor param you handed in when you instantiated `superagent-cache-plugin`.

#### Example

```javascript
superagent.cache... //You can call any function existing on the cache you passed in
```

## superagentCache.defaults

This is the second constructor param you handed in when you instantiated `superagent-cache-plugin`.

#### Example

```javascript
superagent.defaults... //You can read and update defaults at run time
```

# More Usage Examples

## .end() callback argument list options

As an optional parameter in the `.end(cb)` callback argument list, superagent-cache-plugin can give you the key it generated for each query as follows:

```javascript
superagent
  .get(uri)
  .use(superagentCache)
  .end(function (err, response, key){
    console.log('GENERATED KEY:', key);
  }
);
```

This can be useful if you need external access to a cache key and for testing purposes.

However, you can only get it when you pass 3 params to the callback's argument list. The following rules will apply when listing arguments in the `.end(cb)` callback argument list:

* 1 param: the param will always be `response`
* 2 params: the params will always be `err` and `response`
* 3 params: the params will always be `err`, `response`, and `key`
