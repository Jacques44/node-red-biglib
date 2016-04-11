

var fs = require('fs');
var domain = require('domain');
var stream = require('stream');
var moment = require('moment');
const assert = require('assert');

'use strict';

function biglib(obj) {

	this.def_config = validate_config(obj.config);
	this.parser_stream = obj.parser;
	this.node = obj.node;

	this.runtime_control = {
		  config: Object.assign({}, this.def_config)
	}
	delete this.runtime_control.config.wires;
	delete this.runtime_control.config.x;
	delete this.runtime_control.config.y;
	delete this.runtime_control.config.z;			
}

var validate_config = function(config) {
    config.checkpoint = config.checkpoint || 100;   
    config.status_rate = config.status_rate || 1000;
    config.control_rate = config.control_rate || 1000;

    return config;
}

biglib.prototype.new_config = function(config) {
	if (! config) config = Object.assign({}, this.def_config);
	return validate_config(config);
}

var running = false;

// Require stream to close
var close_stream = function(input) {
  if (input) input.end();
  return;
}

biglib.prototype.ready = function() {
  this.node.status({fill: "blue", shape: "dot", text: "ready !"});
}

biglib.prototype.rated_status = function() {
  var last = new Date();
  return function(msg) {
    var now = Date.now();
    if (now - last > this.runtime_control.config.status_rate || 0) {
      this.node.status(msg);
      last = now;
    }
  }
}();

biglib.prototype.control_rated_send = function() {
  var last = new Date();
  return function(cb) {
    var now = Date.now();
    if (now - last > this.runtime_control.config.control_rate || 0) {
      this.node.send([undefined, cb()]);
      last = now;
    }
  }      
}();

// Principe #2, end message on output #2
biglib.prototype.on_finish = function(err) {

  this.runtime_control.state = "end";
  this.runtime_control.end = new Date();
  this.runtime_control.speed = 0;

  if (err) {
    this.runtime_control.state = "error";
    this.runtime_control.error = err;
    this.node.status({fill: "red", shape: "dot", text: err.message });
  } else {
    this.node.status({fill: "green", shape: "dot", text: "done with " + this.runtime_control.records + " records" });
  }

  this.node.send([undefined, { control: this.runtime_control }]);

  this.running = false;

  if (err) this.node.error(err);
}

biglib.prototype.on_start = function(config, control) {

  this.runtime_control.records = this.runtime_control.size = 0;
  this.runtime_control.start = new Date();
  this.runtime_control.speed = 0;
  this.runtime_control.control = control;  // parent control message
  this.runtime_control.config = config;
  delete this.runtime_control.end;
  this.runtime_control.state = "start";      

  this.node.send([undefined, { control: this.runtime_control }]);   

  this.running = true; 
}

biglib.prototype.out_stream = function(my_config) {
  // 2. Sender
  var outstream = new stream.Transform({ objectMode: true });
  outstream._transform = (function(data, encoding, done) {

    // #3 big node principle: tell me what you are doing, so far
    if (++this.runtime_control.records % this.runtime_control.config.checkpoint == 0) 
      this.rated_status({fill: "blue", shape: "dot", text: "sending... " + this.runtime_control.records + " records so far"});

    // #1 big node principle: send blocks for big files management
    this.node.send([{ payload: data }]);

    done();
  }).bind(this);      
  return outstream;
}

var d;

// control is an incoming control message { control: {}, config: {} }
biglib.prototype.create_stream = function(msg, in_stream, last) {

  var my_config = (msg || {}).config || this.def_config;

  var input;
  var output;

  assert(this.runtime_control, "create_stream, no runtime_control");

  // Error management using domain
  // Everything linked together with error management
  // Cf documentation
  // Run the supplied function in the context of the domain, implicitly binding all event emitters, timers, and lowlevel requests that are created in that context
  domain.create()
    .on('error', this.on_finish.bind(this))
    .run((function() {
      (output = (input = (in_stream.call(this, my_config)))
      .pipe(this.parser_stream(my_config))
      .pipe(this.out_stream(my_config))
      .on('finish', this.on_finish.bind(this)))
    }).bind(this));

  // Big node status and statistics
  this.on_start(my_config, msg.control);

  // Return is the entry point for incoming data
  return { input: input, output: output };
}

var has_data = function(msg) {
  return msg.payload || msg.filename;
}

biglib.prototype.speed_message = function() {
  var duration = moment.duration(moment().diff(this.runtime_control.start, 'seconds'));

  if (duration > 0) {         
    this.runtime_control.speed = this.runtime_control.size / duration;
    this.runtime_control.state = 'running';
    return { control: this.runtime_control };
  }      
}

biglib.prototype.size_stream = function(my_config) {

  var biglib = this;
  assert(biglib.runtime_control, "size_stream, pas de runtime_control");

  // Streams are created in the scope of domain (very very important)
  var size_stream = new stream.Transform({ objectMode: true });
  size_stream._transform = (function(data, encoding, done) {
    biglib.runtime_control.size += data.length;

    this.push(data);

    biglib.control_rated_send((biglib.speed_message).bind(biglib));

    done();
  });

  return size_stream;
}

var fs_stream = function(my_config) {
  return fs.createReadStream(my_config.filename, my_config);
}    

biglib.prototype.file_stream = function() {

  var stack = [];

  return function(msg) {

    var next = function() {
      var msg = stack.pop();
      if (msg) create(msg);
    }

    var create = (function(msg) {
      this.create_stream(msg, fs_stream).output.on('finish', next);
    }).bind(this);

    if (this.running) { 
    	console.log("Already running, push...");
      stack.push(msg);
    } else {
      create(msg);
    }
  }   

}();

biglib.prototype.data_stream = function() {

  var input_stream;

  return function(msg) {

    if (msg.control && msg.control.state == "start") {
      input_stream = close_stream(input_stream);

      this.ready();

      if (msg.config) input_stream = this.create_stream(msg, this.size_stream).input;
    }

    if (has_data(msg)) {
      if (! input_stream) input_stream = this.create_stream(msg, this.size_stream).input;

      input_stream.write(msg.payload);
    }

    if (msg.control && msg.control.state == "end") {
      this.runtime_control.control = msg.control;    // Parent control message

      input_stream = close_stream(input_stream);
    }  
  };

}();

biglib.prototype.config = function() {
	return this.runtime_control.config;
}

module.exports = biglib;

