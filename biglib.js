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
var domain = require('domain');
var stream = require('stream');
var moment = require('moment');
var filesize = require('filesize');
var callerId = require('caller-id');
var byline = require('byline');
var Client = require('ssh2').Client;
var duplex = require('./duplex');
const util = require('util');
const assert = require('assert');

const StatusTypeStream = "ring";
const StatusTypeGenerator = "dot";

const line_options = { "encoding": 'utf8', "keepEmptyLines": true };
const file_options = { 
  "encoding": 'utf8', start: undefined, end: undefined, 
  "highWaterMark": { default: 64, validation: function(v) { return v*1024 } }
}
const ssh_options = {
  "host": "", "port": 22, 
  "privateKey": { default: "", validation: function(v) { return require('fs').readFileSync(v) } },
  "username": "",
  "commandLine": "",
  "minError": 1
}

const data_generators = {
  "filename": {

  }
}

'use strict';

function biglib(obj) {

  // Clone the configuration
	this._def_config = Object.assign({}, this._validate_config(obj.config));

  // If node is configured as a parser, store the information
  this._set_parser(obj.parser, obj.parser_config);

  // This is a library that uses the node methods (status, error, send) so we need a reference to the node instance
	this._node = obj.node;

  // This stack is used in case of multiple incoming "generator" messages. We don't want data from 2 files to be melt
  this._stack = [];

  // These control the refresh rates for visual statuses and running control messages
  this._last_rated_status = new Date();
  this._last_control_rated_send = new Date();

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
        return function() { return filesize(this._runtime_control.size) }
        break;
      case 'records': 
        return function() { return this._runtime_control.records + " records" }
        break;
      default:
        if (typeof obj.status == "function") return obj.status;
        return function() { return "..." }
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
      case 'remote':
        this.parser_stream = function (myconfig) { 
          return this.remote_stream(myconfig);
        }
        this.parser_config = ssh_options;
        break;
      default:
        this.parser_stream = parser;
        this.parser_config = parser_config;
        break;
    }
  } catch (err) {
    console.log(err.message);
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
      if (given_config.hasOwnProperty(name)) {
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
    console.log(err);
    throw err;
  }
}

// Require stream to close
biglib.prototype._close_stream = function(input) {
  if (input) {
    this.log("");
    input.end();
  } else {
    //this.log("damn, no input stream to close");
  }
  return;
}

biglib.prototype._ready = function() {
  this._node.status({fill: "blue", shape: this._status_type, text: "ready !"});
}

biglib.prototype._working = function(text) {
  this._node.status({fill: "blue", shape: this._status_type, text: text});
}

biglib.prototype._rated_status = function(msg) {
  var now = Date.now();
  if (now - this._last_rated_status > this._runtime_control.config.status_rate || 0) {
    this._node.status(msg);
    this._last_rated_status = now;
  }
}

biglib.prototype._control_rated_send = function(cb) {
  var now = Date.now();
  if (now - this._last_control_rated_send > this._runtime_control.config.control_rate || 0) {
    this._node.send([ null, cb()]);
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

//
// Callback when the job is done
//
biglib.prototype._on_finish = function(err) {

  this._runtime_control.state = "end";
  this._runtime_control.message = "success";
  this._runtime_control.end = new Date();
  this._runtime_control.speed = 0;

  err = err || this._err;
  delete this._err;

  if (err) {
    this._runtime_control.state = "error";
    this._runtime_control.error = err;
    this._runtime_control.message = err.message;
    this._node.status({fill: "red", shape: this._status_type, text: err.message });
  } else {
    this._node.status({fill: "green", shape: this._status_type, text: "done with " + this.progress() });
  }

  this._node.send([ null, { control: this._runtime_control }]);

  this._running = false;

  if (err) this._node.error(err);
}

//
// Callback when the job stats
//
biglib.prototype._on_start = function(config, control) {

  this._runtime_control.records = this._runtime_control.size = 0;
  this._runtime_control.start = new Date();
  this._runtime_control.speed = 0;
  this._runtime_control.control = control;  // parent control message
  this._runtime_control.config = config;
  delete this._runtime_control.end;
  this._runtime_control.state = "start";  
  this._runtime_control.message = "running...";

  this._node.send([ null, { control: this._runtime_control }]);   

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

    this._rated_status({fill: "blue", shape: this._status_type, text: "sending... " + this.progress() + " so far"});

    // #1 big node principle: send blocks for big files management
    this._node.send([{ payload: format(data) }]);

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
    var d = []; d[n] = { payload: format(data) };

    this._node.send(d);

    done();
  }).bind(this);      

  return outstream;
}

//
// Main stream pipes creator
//
biglib.prototype.create_stream = function(msg, in_streams, other_outputs) {

  var my_config = (msg || {}).config || this._def_config;

  var input;
  var output;

  assert(this._runtime_control, "create_stream, no runtime_control");

  // Error management using domain
  // Everything linked together with error management
  // Cf documentation
  // Run the supplied function in the context of the domain, implicitly binding all event emitters, timers, and lowlevel requests that are created in that context
  domain.create()

    .on('error', this._on_finish.bind(this))

    .run((function() {
      input = output = in_streams.shift().call(this, my_config);

      in_streams.forEach((function(s) {
        output = output.pipe(s.call(this, my_config));
      }).bind(this));

      if (this.parser_stream) {
        output = output
          .pipe((p = this.parser_stream(this._extract_config(my_config, this.parser_config))))
          .pipe(this._record_stream(my_config));
      }

      output = output.pipe(this._out_stream(my_config));

      output.on('finish', this._on_finish.bind(this));

      if (p.stderr) {
        other_outputs = 'stderr';
      }

      if (other_outputs) {
        console.log("Has other outputs to bind");
        var i = 2;
        (Array.isArray(other_outputs) ? other_outputs : [ other_outputs ]).forEach(function(other_output) {
          p[other_output].pipe(this._out_stream_n(my_config, i++));
          console.log("Output #" + (i-1) + " bound");
        }.bind(this));
      }

    }).bind(this));

  // Big node status and statistics
  this._on_start(my_config, msg.control);

  // Return is the entry point for incoming data
  return { input: input, output: output };
}

//
// Build a running control status with speed informations
//
biglib.prototype._speed_message = function() {
  var duration = moment.duration(moment().diff(this._runtime_control.start, 'seconds'));

  if (duration > 0) {         
    this._runtime_control.speed = this._runtime_control.size / duration;
    this._runtime_control.state = 'running';
    return { control: this._runtime_control };
  }      
}

// 
// Default stream for storing data size
//
biglib.prototype._size_stream = function(my_config) {

  var biglib = this;
  assert(biglib._runtime_control, "size_stream, pas de runtime_control");

  // Streams are created in the scope of domain (very very important)
  var size_stream = new stream.Transform({ objectMode: true });
  size_stream._transform = (function(data, encoding, done) {
    biglib._runtime_control.size += data.length;

    // TEMPORARY
    this.push(data.toString());

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
  assert(biglib._runtime_control, "record_stream, pas de runtime_control");

  // Streams are created in the scope of domain (very very important)
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
      this.log("Running next in queue");
      create(elt.msg, elt.input_stream, elt.second_output);
    }
  }).bind(this);

  var create = (function(msg, input_stream, second_output) {
    var s = []; if (input_stream) s.push(input_stream);
    s.push(this._size_stream);
    (ret = this.create_stream(msg, s, second_output)).output.on('finish', next);
  }).bind(this);

  if (this._running) {
    this.log("Pushing...");
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
biglib.prototype.stream_data_lines = function(my_config) {

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

biglib.prototype.remote_stream = function(my_config) {

  var transform = stream.Transform;
  var readable = stream.Readable;
  var node = this;

  var rc = new readable({ objectMode: true }); 
  rc._read = function() {};

  // flow -> [ size_stream ] -> bufstream / -> / ssh.stdin
  //                                             ssh.stdout / -> / [ outWStream, inRStream ] -> [ send_stream] -> flow
  //                                             ssh.stderr / -> / stderr -> [ send_stream ] -> flow

  var bufstream = new stream.PassThrough({ objectMode: true });
  var stderr = new stream.PassThrough({ objectMode: true });

  // duplex streams from http://codewinds.com/blog/2013-08-31-nodejs-duplex-streams.html
  util.inherits(RemoteStream, duplex);
  function RemoteStream(config) {

    if (!(this instanceof RemoteStream))
      return new RemoteStream(options);

    var conn = new Client();
    node._working("Connecting to " + config.host + "...");

    this.stderr = stderr;
    this.rc = rc;

    var me = this;

    conn.on('ready', function() {
      node._working("Executing ...");

      conn.exec(config.commandLine, function(err, stream) {
        if (err) throw err;

        stream.on('close', function(code, signal) {
          node._runtime_control.rc = code;
          node._runtime_control.signal = signal;
          console.log("Ending with rc " + code);
          me.rc.push({ code: code, signal: signal });
          me.end();
          if (code >= config.minError) throw new Error("Return code " + code);
        })

        console.log("piping");
        // SSH stream is available, connect the bufstream
        bufstream.pipe(stream).pipe(me.outWStream);

        // Also connect the ssh stderr stream to the pre allocated stderr 
        stream.stderr.pipe(stderr);
      });      

    }).connect(config);

    duplex.call(this, config);

    // Incoming data from the flow is buffered into bufstream, waiting for the ssh stream to be available
    this.inRStream.pipe(bufstream);
  }

  return new RemoteStream(my_config);
}

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

    //if (msg.config) 
    this._input_stream = this.create_stream(msg, [ this._size_stream ]).input;
  }

  if (msg.payload) {
    assert(this._input_stream, "strange state");
    // if (! this._input_stream) this._input_stream = this.create_stream(msg, [ this._size_stream ]).input;

    this._input_stream.write(msg.payload);
  }

  if (msg.control && (msg.control.state == "end" || msg.control.state == "standalone" || msg.control.state == "error")) {

    if (msg.control.state == "error") {
      // Resend error message
      console.log("resending error message");
      this._node.send([ null, msg ]);
      this._err = new Error(msg.control.error + " from upstream");
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
    return this.stream_data_blocks(msg);
  }

  // more complicated now
  // if node is configured to work as a data generator, payload is a trigger
  // if the incoming message contains a value for the defined property "generator", will work as a data generator, configured on the fly

  // if node is not configured, acts as a classical filter (ie block mode with start + data + end in a whole message)
  //   payload should not be considered as anything other than data

  if (msg[this._generator] || this._def_config[this._generator]) {

    console.log("Generator mode " + this._generator + " - " + this._def_config[this._generator] + ".");

    this._status_type = StatusTypeGenerator;
    this.set_generator_property(msg);

    // Only data generators registered here are known for the moment
    switch (this._generator) {

      case 'filename':
        this.stream_file_blocks(msg);
        break;

      case 'remote':
        this.stream_remote_command(msg);
        break;

      default:
        throw new Error("Can't act as a data generator as property \"generator\" is unknown");
    }

    return;

  }

  console.log("Standalone mode");

  // Classical mode, acts as a filter
  msg.control = { state: "standalone" }
  this.stream_data_blocks(msg);
}

module.exports = biglib;

