/*
  Copyright (c) 2016 Jacques W.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  This a Blue Node!

  /\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\
 
   Big Nodes principles:
 
   #1 can handle big data
   #2 send status messages on a second output (start, end, running, error)
   #3 visually tell what they are doing (blue: ready/running, green: ok/done, error)

   Any issues? https://github.com/Jacques44
 
  /\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\

*/

var fs = require('fs');
var stream = require('stream');
var moment = require('moment');
var filesize = require('filesize');
var callerId = require('caller-id');
var byline = require('byline');
var util = require('util');
var assert = require('assert');
var sq = require('shell-quote');

var StatusTypeStream = "ring";
var StatusTypeGenerator = "dot";

var line_options = { "encoding": 'utf8', "keepEmptyLines": true };
var file_options = { 
  "encoding": 'utf8', start: undefined, end: undefined, 
  "highWaterMark": { default: 64, validation: function(v) { return v*1024 } }
}

'use strict';

function biglib(obj) {

  // Clone the configuration
	this._def_config = Object.assign({}, this._validate_config(obj.config));

  // If node is configured as a parser, store the information
  this._set_parser(obj.parser, obj.parser_config || {});

  // This is a library that uses the node methods (status, error, send) so we need a reference to the node instance
	this._node = obj.node;

  this._credentials = obj.credentials;

  // This stack is used in case of multiple incoming "generator" messages. We don't want data from 2 files to be melt
  this._stack = [];

  // Properties to propagate for all messages
  this._templates = obj.templates || [ '_msgid', 'topic', '__combineId' ];

  // Custom finish event
  this._finish_event = obj.finish_event || 'finish';

  // These control the refresh rates for visual statuses and running control messages
  this._last_rated_status = new Date();
  this._last_control_rated_send = new Date();

  // Custom finish event to listen to
  this._before_finish = obj.on_finish;

  this._sending_msg = obj.sending_msg || "sending";

  // We don't care about internal node-red property for the nodes. I delete this because I have previously cloned the config
  delete this._def_config.wires;
  delete this._def_config.x;
  delete this._def_config.y;
  delete this._def_config.z;   

  this._running = false;

  // this property tells the node can act as a data generator if defined in an incoming msg
  this._generator = obj.generator || "";

  this._createCB = obj.createCB;

  // If the node is configured as a data generator, by default, its status will be of type generator (dot)
  this._default_status_type = this._status_type = (this._generator && this._def_config[this._generator]) ? StatusTypeGenerator : StatusTypeStream;

  // This function is used to show the running status of the node in a human form
  this.progress = function () { 
    switch (obj.status || 'filesize') {
      case 'filesize':
        return function(running) { return (running ? "sending " : "done with ") + filesize(this._runtime_control.size) + (running ? " so far" : "") }
        break;
      case 'records': 
        return function(running) { return (running ? "sending " : "done with ") + this._runtime_control.records + " record" + (this._runtime_control.records > 1 ? "s" : "") + (running ? " so far" : "") }
        break;
      case 'orders': 
        return function(running) { return (running ? "sending " : "done with ") + this._runtime_control.records + " order" + (this._runtime_control.records > 1 ? "s" : "") + (running ? " so far" : "") }
        break;        
      default:
        if (typeof obj.status == "function") return obj.status;
        return function(running) { return (running ? "running" : "done") }
    }
  }();

  // Property used to store running statistics. It's the control message
	this._runtime_control = {
		  config: Object.assign({}, this._def_config)
	}	

  // Show a blue ready message
  this._ready();
}

//
// If the node is a parser, configure it
//
biglib.prototype._set_parser = function(parser, parser_config) {
  try {
    switch (parser) {
      case 'line':
        this.parser_stream = function (myconfig) { 
          return new byline.LineStream(myconfig);
        }
        this.parser_config = line_options;
        break;     
      default:
        this.parser_stream = parser;
        this.parser_config = parser_config;
        break;
    }
  } catch (err) {
    throw err;
  }  
}

//
// Local validation configuration method
//
biglib.prototype._validate_config = function(config) {
  config.checkpoint = config.checkpoint || 100;   
  config.status_rate = config.status_rate || 1000;
  config.control_rate = config.control_rate || 1000;
  config.start_point_type = config.start_point_type || 'filename';

  return config;
}

//
// Returns an instance of the configuration. Useful to avoid overlaps as nodes can be configured on the fly
//
biglib.prototype.new_config = function(config) {
	if (! config) config = Object.assign({}, this._def_config);
	return this._validate_config(config);
}

// 
// Helper function to pick only necessary properties with needed defaults and validated
//
biglib.prototype._extract_config = function(given_config, expected_keys) {

  try {
    var out_config = {};
    keys = 
      Array.isArray(expected_keys) ? expected_keys : ( 
        typeof expected_keys == 'object' ? Object.keys(expected_keys) : 
        [ expected_keys ]
      );

    for (i in keys) {
      var name = keys[i];
      var def = expected_keys[name];
      var validate = false;

      // If this expected configuration key is given, take it
      if (this._credentials && this._credentials.hasOwnProperty(name)) {
        out_config[name] = this._credentials[name];
        validate = true;
      }
      else if (this._credentials && this._credentials.credentials && this._credentials.credentials.hasOwnProperty(name)) {
        out_config[name] = this._credentials.credentials[name];
        validate = true;
      }
      else if (given_config.hasOwnProperty(name)) {
        out_config[name] = given_config[name];
        validate = true;
      } else {
        // Default value?
        if (expected_keys.hasOwnProperty(name)) {
          if (typeof def == 'object') {
            if (def.default) {
              out_config[name] = def.default; 
              validate = true;
            }
          } else {
            out_config[name] = def;
            validate = true;
          }
        }
      }

      if (validate && def && def.validation) {
        out_config[name] = def.validation(out_config[name]);
      }

    }
    return out_config;
  } catch (err) {
    throw err;
  }
}

// Require stream to close
biglib.prototype._close_stream = function(input) {
  if (input) {
    input.end();
  } else {
    //this.log("damn, no input stream to close");
  }
  return;
}

biglib.prototype._ready = function() {
  this._node.status({fill: "blue", shape: this._status_type, text: "ready !"});
}

biglib.prototype.working = function(text) {
  this._node.status({fill: "blue", shape: this._status_type, text: text});
}

biglib.prototype.stats = function(stats) { 
  for (k in stats) {
    this._runtime_control[k] = stats[k];    
  }
}

biglib.prototype._rated_status = function(msg) {
  if (!this._running) return;
  var now = Date.now();
  if (now - this._last_rated_status > this._runtime_control.config.status_rate || 0) {
    this._node.status(msg);
    this._last_rated_status = now;
  }
}

biglib.prototype._control_rated_send = function(cb) {
  var now = Date.now();
  if (now - this._last_control_rated_send > this._runtime_control.config.control_rate || 0) {

    var msg = cb();
    if (msg) this._node.send([ null, this._control_message(msg) ]);

    this._last_control_rated_send = now;
  }
}      

//
// Local log function
//
biglib.prototype.log = function(msg) {
  var caller = callerId.getData();
  console.log("[" + this._node.constructor.name + "@" + caller.functionName + "] " + JSON.stringify(msg, null, 2));
}

biglib.prototype.set_error = function(err) {
  this._err = err;
}

biglib.prototype.set_warning = function() {
  this._warn = true;
}

//
// Callback when the job is done
//
biglib.prototype._on_finish = function(err) {

  this._running = false;

  if (this._before_finish) this._before_finish(this._runtime_control); 

  this._runtime_control.state = "end";
  this._runtime_control.message = "success";
  this._runtime_control.end = new Date();
  this._runtime_control.speed = 0;

  err = err || this._err;
  this._err = err;

  if (err) {    
    this._runtime_control.state = "error";
    this._runtime_control.error = err;
    this._runtime_control.message = err.message;
    this._node.status({fill: "red", shape: this._status_type, text: err.message });
  } else {
    this._node.status({fill: this._warn ? "yellow": "green", shape: this._status_type, text: this.progress(false) });
  }

  this._node.send([ null, this._control_message(this._runtime_control) ]);
  
  if (err) {
    //console.log(err, err.stack.split("\n"))
    this._node.error(err);
  }
}

//
// Callback when the job stats
//
biglib.prototype._on_start = function(config, control) {

  this._i = 0;
  config = config || this.config();

  this._runtime_control.records = this._runtime_control.size = 0;
  this._runtime_control.start = new Date();
  this._runtime_control.speed = 0;
  this._runtime_control.control = control;  // parent control message
  this._runtime_control.config = config;
  delete this._runtime_control.end;
  this._runtime_control.state = "start";  
  this._runtime_control.message = "running...";
  delete this._err;
  delete this._warn;
  delete this._runtime_control.rc;
  delete this._runtime_control.ok;

  this._node.send([ null, this._control_message(this._runtime_control) ]);

  this._running = true;
}

// 
// Default ending stream. It sends data to the flow
//
biglib.prototype._out_stream = function(my_config) {

  var format = function(data) { return data }
  if (my_config.format) {
    format = function(data) { return data.toString(my_config.format) }
  }

  // 2. Sender
  var outstream = new stream.Transform( { objectMode: true });
  outstream._transform = (function(data, encoding, done) {

    this._rated_status({fill: "blue", shape: this._status_type, text: this.progress(true) });

    // #1 big node principle: send blocks for big files management
    this._node.send([ this._data_message(format(data)) ]);

    this._i++;

    done();
  }).bind(this);      

  return outstream;
}

// 
// Default ending stream. It sends data to the flow
//
biglib.prototype._out_stream_n = function(my_config, n) {

  var format = function(data) { return data }
  if (my_config.format) {
    format = function(data) { return data.toString(my_config.format) }
  }

  // 0: std output, 1: control
  if (n < 2) throw new Error("_out_stream only works with n > 1");
  
  // 2. Sender
  var outstream = new stream.Transform({ objectMode: true });
  outstream._transform = (function(data, encoding, done) {

    // #1 big node principle: send blocks for big files management
    var d = []; d[n] = this._data_message(format(data));
    this._node.send(d);    

    done();
  }).bind(this);      

  return outstream;
}

biglib.prototype.merge_config = function(msg) {

  msg.config = msg.config || {};
  for (var k in this._def_config) {
    if (!msg.config.hasOwnProperty(k)) msg.config[k] = this._def_config[k];
  }
  return msg;
}

//
// Main stream pipes creator
//
biglib.prototype.create_stream = function(msg, in_streams) {

  // msg is stored as a template for all messages
  this._template_message(msg);

  var my_config = this.merge_config(msg).config;

  // Big node status and statistics
  this._on_start(my_config, msg.control);

  var input;
  var output;
  var p;

  assert(this._runtime_control, "create_stream, no runtime_control");

  try {

    // Still using domain (I know they are deprecated) but there is no other way to catch async event by now
    var d = require('domain').create();

    d.on('error', this._on_finish.bind(this));

    d.run(function() {
      output = input = in_streams.shift().call(this, my_config);

      in_streams.forEach((function(s) {
        output = output.pipe(s.call(this, my_config));
      }).bind(this));

      if (this.parser_stream) {
        output = output
          .pipe((p = this.parser_stream(this._extract_config(my_config, this.parser_config))))
          .pipe(this._record_stream(my_config));
      }
      if (p) {
        p
        .on('error', function(err) {
          this._on_finish(err);
        }.bind(this))
        .on('working', this.working.bind(this))
        .on(this._finish_event, this._on_finish.bind(this))
      }

      // finale pipe to the tranform stream binding the data to the node output (using node.send)
      output = output.pipe(this._out_stream(my_config));

      // If no parser_stream then no custom finish event (_finish_event) so wait for std finish event
      if (!p) output.on('finish', this._on_finish.bind(this));

      // If parser_stream as an array of others output streams, bind them to the node outputs starting by 2
      if (p && p.others) {
        //console.log("Has other outputs to bind");
        var i = 2;
        (Array.isArray(p.others) ? p.others : [ p.others ]).forEach(function(other_output) {
          other_output.pipe(this._out_stream_n(my_config, i++));
          //console.log("Output #" + (i-1) + " bound");
        }.bind(this));
      }

    }.bind(this));

  } catch (err) {
    this._on_finish(err);
  }

  // Return is the entry point for incoming data
  return { input: input, output: output, parser: p };
}

//
// Build a running control status with speed informations
// Returns a control value
//
biglib.prototype._speed_message = function() {
  var duration = moment.duration(moment().diff(this._runtime_control.start, 'seconds'));

  if (duration > 0) {
    this._runtime_control.speed = this._runtime_control.size / duration;
    this._runtime_control.state = 'running';
    return this._runtime_control;
  }
}

// 
// Default stream for storing data size
//
biglib.prototype._size_stream = function(my_config) {

  var biglib = this;
  assert(biglib._runtime_control, "size_stream, no runtime_control");

  var size_stream = new stream.Transform({ objectMode: true });
  size_stream._transform = (function(data, encoding, done) {
    biglib._runtime_control.size += data.length || 0;

    this.push(data);

    biglib._control_rated_send((biglib._speed_message).bind(biglib));

    done();
  });

  return size_stream;
}

//
// Default stream for storing records number
//
biglib.prototype._record_stream = function(my_config) {

  var biglib = this;
  assert(biglib._runtime_control, "record_stream, no runtime_control");
  
  var record_stream = new stream.Transform({ objectMode: true });
  record_stream._transform = (function(data, encoding, done) {
    biglib._runtime_control.records++;

    this.push(data);

    biglib._control_rated_send((biglib._speed_message).bind(biglib));

    done();
  });

  return record_stream;
}

// 
// Wrapper for incoming messages in data generator mode
// It avoids overlaps if, for example, a second filename is coming and the previous one is still in progress
//
biglib.prototype._enqueue = function(msg, input_stream, second_output) {

  var next = (function() {
    var elt = this._stack.pop();
    if (elt) {
      create(elt.msg, elt.input_stream, elt.second_output);
    }
  }).bind(this);

  var create = (function(msg, input_stream, second_output) {
    var s = []; if (input_stream) s.push(input_stream);
    s.push(this._size_stream);
    ret = this.create_stream(msg, s, second_output);
    if (ret.parser) {
      ret.parser.on(this._finish_event, next);
    } else {
      ret.output.on(this._finish_event, next);
    }
  }).bind(this);

  if (this._running) {
    //this.log("Pushing...");
    this._stack.push({ msg: msg, input_stream: input_stream, second_output: second_output });
  } else {
    create(msg, input_stream, second_output);
  }

}

//
// input message: filename
// output messages: data blocks (n blocks)
//
biglib.prototype.stream_file_blocks = function(msg) {

  var input_stream = function(my_config) {

    // Documentation: https://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options
    var config = this._extract_config(my_config, file_options);

    try {
      return fs.createReadStream(my_config.filename, config);
    } catch (err) {
      this._on_finish(err);
    }
  }

  this._enqueue(msg, input_stream);
};

//
// input message: filename
// output messages: data blocks (n blocks)
// Documentation: https://www.npmjs.com/package/line-by-line
//
biglib.prototype.stream_data_lines = function(msg) {

  var input_stream = function(my_config) {

    this._set_parser('line');

    // Documentation: https://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options
    var config_file = this._extract_config(my_config, file_options);

    try {    
      return fs.createReadStream(my_config.filename, config_file.encoding);
    } catch (err) {
      this._on_finish(err);
    }      
  }

  this._enqueue(msg, input_stream);
};

//
// input message: filename
// output message: file content (1 message)
//
biglib.prototype.stream_full_file = function(msg) {

  var input_stream = function(my_config) {

    var r = new stream.Readable();

    // Avoid Error: not implemented error message
    r._read = function() {}    

    var config = this._extract_config(my_config, file_options);

    try {
      fs.readFile(my_config.filename, config, (function(err, data) {
        if (err) throw err;
        this.push(data);
        this.push(null);
      }).bind(r));

      return r;

    } catch (err) {
      this._on_finish(err);
    }

  }

  this._enqueue(msg, input_stream);
};

//
// input: data blocks
// output: data blocks
// acts as a transform stream
// manages start, end control messages
//
biglib.prototype.stream_data_blocks = function(msg) {

  if (msg.control && (msg.control.state == "start" || msg.control.state == "standalone")) {

    this._status_type = StatusTypeStream;

    this._input_stream = this._close_stream(this._input_stream);

    this._ready();

    this._input_stream = this.create_stream(msg, [ this._size_stream ]).input;
  }

  if (msg.payload) {

    if (!this._input_stream) return this._on_finish(new Error("Unexpected state, incoming data and no stream"))

    this._input_stream.write(msg.payload);
  }

  if (msg.control && (msg.control.state == "end" || msg.control.state == "standalone" || msg.control.state == "error")) {

    if (msg.control.state == "error") {
      //if (msg.control.error instanceof Error && msg.control.error.message.endsWith("from upstream")) this._err = msg.control.error; 
      //else this._err = new Error(msg.control.error.message + " from upstream");
    }

    this._runtime_control.control = msg.control;    // Parent control message

    this._input_stream = this._close_stream(this._input_stream);
  }

}

biglib.prototype.config = function() {
	return this._runtime_control.config;
}

biglib.prototype.set_generator_property = function(msg) {
  if (msg[this._generator]) {
    msg.config = msg.config || {};
    msg.config[this._generator] = msg[this._generator];
  }  
  return msg;
}

//
// Usually bound to incoming messages
// Switch for data generator mode or data block mode
//
biglib.prototype.main = function(msg) {

  // control message = block mode
  // already in block mode, go on
  if (msg.control || this._input_stream) {
    //this.log("Block mode");
    return this.stream_data_blocks(msg);
  }

  // more complicated now
  // if node is configured to work as a data generator, payload is a trigger
  // if the incoming message contains a value for the defined property "generator", will work as a data generator, configured on the fly

  // if node is not configured, acts as a classical filter (ie block mode with start + data + end in a whole message)
  //   payload should not be considered as anything other than data

  if (msg[this._generator] || this._def_config[this._generator]) {

    //this.log("Generator mode " + this._generator + " - " + this._def_config[this._generator] + ".");

    this._status_type = StatusTypeGenerator;
    this.set_generator_property(msg);

    // Only data generators registered here are known for the moment
    switch (this._generator) {

      case 'filename':
        this.stream_file_blocks(msg);
        break;   

      case 'limiter':
        this._enqueue(msg);
        break;

      default:
        throw new Error("Can't act as a data generator as property \"generator\" is unknown");
    }

    return;

  }

  // Classical mode, acts as a filter
  msg.control = { state: "standalone" }
  this.stream_data_blocks(msg);

}

biglib.argument_to_array = function(arg) {

  if (Array.isArray(arg)) return arg;
  if (typeof arg == 'object') {
    var ret = [];
    Object.keys(arg).forEach(function(k) {
      ret.push(k);
      ret.push(typeof arg[k] == 'object' ? JSON.stringify(arg[k]) : arg[k].toString());
    })
    return ret;
  }
  return sq.parse((arg||"").toString());
}    

biglib.argument_to_string = function(arg) {
  return sq.quote(biglib.argument_to_array(arg));
}

biglib.min_finish = function(stats) {  
  var config = this._runtime_control.config;
  if (!stats.hasOwnProperty('rc')) stats.rc = 255;
  if (config.minError && stats.rc >= config.minError) {
    this.set_error(new Error("Return code " + stats.rc));
    this.stats({ ok: false });
  }
  else {
    this.stats({ ok: true });
    if (config.minWarning && stats.rc >= config.minWarning) this.set_warning();
  }
};

biglib.dummy_writable = function() {
  // Build a dummy stream that discards input message. If not in objectMode, throws typeError: Invalid non-string/buffer chunk if 
  // receiving a timestamp
  dummy = new require('stream').Writable({ objectMode: true });
  dummy._write = function(data, encoding, done) { done() }  
  return dummy;
}

biglib.prototype.duration = function(locale) { 
  var old_loc = moment.locale();
  if (locale) moment.locale(locale);
  var duration = moment.duration(moment().diff(this._runtime_control.start, 'seconds')).humanize();
  moment.locale(old_loc);
  return duration;
}

biglib.prototype.filesize = function() {
  return filesize(this._runtime_control.size);
}

biglib.stringify_stream = function(eol) {
  var ret = new stream.Transform({ objectMode: true });
  ret._transform = function(data, encoding, done) {
    // Stringify
    if (typeof data == 'object') {
      this.push(JSON.stringify(data) + eol);
    } else {
      this.push(data.toString() + eol);
    }
    done();
  }
  return ret;
}

// Return an empty message to be filled with data
biglib.prototype._empty_message = function() {
  return Object.assign({}, this._msg || {});
}

biglib.prototype._control_message = function(data) {
  var m = this._empty_message();
  m.control = data;
  return m;
}

biglib.prototype._data_message = function(data) {
  var m = this._empty_message();
  m.payload = data;
  return m;  
}

biglib.prototype._template_message = function(msg) {
  var _msg = {}; 
  this._templates.forEach(function(k, i) {
    if (msg.hasOwnProperty(k)) _msg[k] = msg[k];
  })
  this._msg = _msg;
}

module.exports = biglib;

