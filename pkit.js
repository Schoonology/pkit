/**
 * pKit - A library of commonly-needed promise shims.
 *
 * Copyright (c) 2014 Michael Schoonmaker
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
var http = require('http')
  , url = require('url')
  , util = require('util')
  , when = require('when')

/**
 * pRequest makes an HTTP request on behalf of the caller, returning a promise
 * to be fulfilled with the response. The response body is buffered.
 *
 * If `options` is a string, it is treated as a GET request with no additional
 * parameters or body. If it is an object, the following options are available:
 *  - `url`: The URL to request. Required.
 *  - `method`: The HTTP method to use. Defaults to GET.
 *  - `body`: The body of the request. If an object, it will be serialized as
 *    JSON and an appropriate `Content-Type` will be added to the headers. If a
 *    string, it is sent as-is. Otherwise, it is ignored.
 *  - `headers`: An object of headers to send along.
 *
 * The response object has three properties:
 *  - `statusCode`: The status code of the response.
 *  - `headers`: An object of headers present in the response.
 *  - `body`: The response body. If the response was sent with a `Content-Type`
 *    of `application/json`, the body will be an object parsed as JSON.
 *    Otherwise, it will be a string.
 */
function pRequest(options) {
  var deferred = when.defer()
    , requestOptions = {}

  if (typeof options === 'object') {
    requestOptions = typeof options.url === 'string' ? url.parse(options.url) : options.url
    util._extend(requestOptions, options)
  } else if (typeof options === 'string') {
    requestOptions = url.parse(options)
  } else {
    return when.reject('Missing URL')
  }

  if (typeof requestOptions.body === 'object') {
    requestOptions.body = JSON.stringify(requestOptions.body)
    requestOptions.headers = requestOptions.headers || {}
    requestOptions.headers['Content-Type'] = 'application/json'
    requestOptions.headers['Accept'] = 'application/json'
  } else if (typeof requestOptions.body !== 'string') {
    delete requestOptions.body
  }

  http.request(requestOptions)
    .on('error', function (err) {
      deferred.reject(err)
    })
    .on('response', function (response) {
      var buf = ''

      response
        .on('close', function () {
          deferred.reject(new Error('Connection closed.'))
        })
        .on('data', function (chunk) {
          buf += chunk
        })
        .on('end', function () {
          response.body = buf

          if (response.headers['content-type'].slice(0, 16) === 'application/json') {
            try {
              response.body = JSON.parse(buf)
            } catch (e) {
              e.response = response
              deferred.reject(e)
            }
          }

          deferred.resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body
          })
        })
    })
    .end(requestOptions.body)

  return deferred.promise
}

/*!
 * Exports. Woo.
 */
module.exports = {
  pRequest: pRequest
}
