// Code from http://codewinds.com/blog/2013-08-31-nodejs-duplex-streams.html

var fs = require('fs');
var stream = require('stream');
var util = require('util');

var Duplex = stream.Duplex ||
  require('readable-stream').Duplex;

var PassThrough = stream.PassThrough ||
  require('readable-stream').PassThrough;

/**
 * Duplex stream created with two transform streams
 * - inRStream - inbound side read stream
 * - outWStream - outbound side write stream
 */
function DuplexThrough(options) {
  if (!(this instanceof DuplexThrough)) {
    return new DuplexThrough(options);
  }
  Duplex.call(this, options);
  this.inRStream = new PassThrough();
  this.outWStream = new PassThrough();
  this.leftHandlersSetup = false; // only setup the handlers once
}
util.inherits(DuplexThrough, Duplex);

/* left inbound side */
DuplexThrough.prototype._write =
  function (chunk, enc, cb) {
    this.inRStream.write(chunk, enc, cb);
  };

/* left outbound side */
/**
 * The first time read is called we setup listeners
 */
DuplexThrough.prototype.setupLeftHandlersAndRead = function (n) {
  var self = this;
  self.leftHandlersSetup = true; // only set handlers up once
  self.outWStream
    .on('readable', function () {
      self.readLeft(n);
    })
    .on('end', function () {
      self.push(null); // EOF
    });
};

DuplexThrough.prototype.readLeft = function (n) {
  var chunk;
  while (null !==
         (chunk = this.outWStream.read(n))) {
    // if push returns false, stop writing
    if (!this.push(chunk)) break;
  }
};

DuplexThrough.prototype._read = function (n) {
  // first time, setup handlers then read
  if (!this.leftHandlersSetup) {
    return this.setupLeftHandlersAndRead(n);
  }
  // otherwise just read
  this.readLeft(n);
};

module.exports = DuplexThrough;
