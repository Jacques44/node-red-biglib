# node-red-biglib

"Big Lib" is the core library for "Big Nodes"

## Installation
```bash
npm install node-red-biglib
```

## Principles for Big Nodes

See [biglib](https://www.npmjs.com/package/node-red-biglib) for details on Big Nodes.
`Big Lib` and subsequent `Big Nodes` are a family of nodes built for my own purpose. They are all designed to help me build a complete process for **production purposes**. For that I needed nodes able to:

* Flow **big volume** of data (memory control, work with buffers)
* Work with *a flow of blocks* (buffers) (multiple payload within a single job)
* Tell what *they are doing* with extended use of statuses (color/message)
* Use their *second output for flow control* (start/stop/running/status)
* *Reuse messages* in order to propagate _msgid, topic
* Depends on **state of the art** libraries for parsing (csv, xml, xlsxs, line, ...)
* Acts as **filters by default** (1 payload = 1 action) or **data generators** (block flow)

All functionnalities are built under a library named `biglib` and all `Big Nodes` rely on it

## The Big Nodes family

This library is used for big nodes developpement.

Here is the family

![alt tag](https://cloud.githubusercontent.com/assets/18165555/15454010/bd400bdc-202b-11e6-887f-786bcbb425a7.png)

## Dependencies

[byline](https://www.npmjs.com/package/byline) simple line-by-line stream reader

[filesize](http://filesizejs.com/) provides an easy way to get a human readable file size String

[moment](http://momentjs.com/) Parse, validate, manipulate, and display dates in JavaScript

## API

Work in progress. Please look at the following `Big Nodes`:

* [big file](https://github.com/Jacques44/node-red-contrib-bigfile) for reading files in multiple ways/format/encoding
* [big csv](https://github.com/Jacques44/node-red-contrib-bigcsv) for parsing CSV
* [big line](https://github.com/Jacques44/node-red-contrib-bigline) for parsing by lines
* [big fixed](https://github.com/Jacques44/node-red-contrib-bigfixed) for fixed format parsing
* [big status](https://github.com/Jacques44/node-red-contrib-bigstatus) for visual statuses
* [big exec](https://github.com/Jacques44/node-red-contrib-bigexec) for executing commands
* [big ssh](https://github.com/Jacques44/node-red-contrib-bigssh) for executing remote command over SSH
* [big mongo](https://github.com/Jacques44/node-red-contrib-bigmongo) fork from node-red-contrib-mongodb2 for executing MongoDB requests with cursor support
* [big db2]() in progress
* [big xlsx](https://github.com/Jacques44/node-red-contrib-bigxlsx) for parsing XLSX files
* [big splitter](https://github.com/Jacques44/node-red-contrib-bigsplitter) fork from node-red-contrib-splitter with big control support
* [big tail](https://github.com/Jacques44/node-red-contrib-bigtail) used for converting multiple payloads in one message with line and size constraints

## Sample use of Big Nodes

### Workflow of actions with statuses and last messages capture

It uses several nodes which are needed for this to work:
```bash
npm install node-red-contrib-bigline
npm install node-red-contrib-bigtail
npm install node-red-contrib-bigexec
npm install node-red-contrib-bigsplitter
npm install node-red-contrib-bigstatus
npm install node-red-contrib-traffic
```

```json
[{"id":"c5ca4d63.3a35b","type":"bigtail","z":"894b4f7b.76b4b","name":"","size":"2","add_cr":true,"size_kbyte":"","x":620,"y":60,"wires":[["449b97f1.bb6468"],[]]},{"id":"dd148b1f.22eb78","type":"bigline","z":"894b4f7b.76b4b","name":"","filename":"","format":"utf8","keepEmptyLines":false,"x":480,"y":60,"wires":[["c5ca4d63.3a35b"],["c5ca4d63.3a35b"]]},{"id":"99748aff.668b78","type":"debug","z":"894b4f7b.76b4b","name":"tail stdout","active":true,"console":"false","complete":"payload","x":1000,"y":80,"wires":[]},{"id":"449b97f1.bb6468","type":"traffic","z":"894b4f7b.76b4b","name":"","property_allow":"control.ok","filter_allow":"true","ignore_case_allow":false,"negate_allow":false,"send_allow":false,"property_stop":"control.state","filter_stop":"start","ignore_case_stop":false,"negate_stop":false,"send_stop":false,"default_start":false,"differ":false,"x":850,"y":80,"wires":[["99748aff.668b78"]]},{"id":"9323a207.6cdc6","type":"bigline","z":"894b4f7b.76b4b","name":"","filename":"","format":"utf8","keepEmptyLines":false,"x":480,"y":220,"wires":[["d991b04e.266e5"],["d991b04e.266e5"]]},{"id":"d991b04e.266e5","type":"bigtail","z":"894b4f7b.76b4b","name":"","size":"3","add_cr":true,"x":620,"y":220,"wires":[["4ac88b64.b53774"],[]]},{"id":"4ac88b64.b53774","type":"traffic","z":"894b4f7b.76b4b","name":"","property_allow":"control.ok","filter_allow":"true","ignore_case_allow":false,"negate_allow":true,"send_allow":false,"property_stop":"control.state","filter_stop":"start","ignore_case_stop":false,"negate_stop":false,"send_stop":false,"default_start":false,"differ":false,"x":850,"y":200,"wires":[["83cde6d9.7c3218"]]},{"id":"83cde6d9.7c3218","type":"debug","z":"894b4f7b.76b4b","name":"tail stderr","active":true,"console":"false","complete":"payload","x":1000,"y":200,"wires":[]},{"id":"109cae54.ef6352","type":"inject","z":"894b4f7b.76b4b","name":"no file","topic":"","payload":"non/existent","payloadType":"str","repeat":"","crontab":"","once":false,"x":130,"y":160,"wires":[["5e919a71.a16e64"]]},{"id":"dbc04ed6.243fb","type":"bigstatus","z":"894b4f7b.76b4b","name":"","locale":"","x":850,"y":140,"wires":[["cfd54729.302ab8"]]},{"id":"5e919a71.a16e64","type":"bigexec","z":"894b4f7b.76b4b","name":"cat","command":"cat","commandArgs":"","minError":1,"minWarning":1,"cwd":"","shell":"","extraArgumentProperty":"","envProperty":"","format":"utf8","limiter":true,"payloadIs":"argumentNoStdin","x":290,"y":140,"wires":[["dd148b1f.22eb78"],["dd148b1f.22eb78","449b97f1.bb6468","9323a207.6cdc6","4ac88b64.b53774","dbc04ed6.243fb"],["9323a207.6cdc6"]]},{"id":"cfd54729.302ab8","type":"filter","z":"894b4f7b.76b4b","name":"ok?","property":"control.ok","filter":"true","ignorecase":true,"x":990,"y":140,"wires":[["d05541bf.2faac"],["fbb38f7b.044c7"],[]]},{"id":"d05541bf.2faac","type":"debug","z":"894b4f7b.76b4b","name":"next in the flow","active":true,"console":"false","complete":"payload","x":1160,"y":120,"wires":[]},{"id":"fbb38f7b.044c7","type":"debug","z":"894b4f7b.76b4b","name":"KO, other action","active":true,"console":"false","complete":"payload","x":1160,"y":160,"wires":[]},{"id":"6d4a788a.92b588","type":"comment","z":"894b4f7b.76b4b","name":"Change to suit your conf","info":"","x":170,"y":100,"wires":[]},{"id":"321868ab.cde798","type":"comment","z":"894b4f7b.76b4b","name":"Sample use of big nodes","info":"","x":130,"y":40,"wires":[]},{"id":"34616222.cb9e9e","type":"inject","z":"894b4f7b.76b4b","name":"test file","topic":"","payload":"test.csv","payloadType":"str","repeat":"","crontab":"","once":false,"x":130,"y":120,"wires":[["5e919a71.a16e64"]]}]
```

![alt tag](https://cloud.githubusercontent.com/assets/18165555/15455918/c5313024-2061-11e6-822a-2a55d1964eee.png)

## Author

  - Jacques W

## License

This code is Open Source under an Apache 2 License.

You may not use this code except in compliance with the License. You may obtain an original copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. Please see the
License for the specific language governing permissions and limitations under the License.

## Feedback and Support

Please report any issues or suggestions via the [Github Issues list for this repository](https://github.com/Jacques44/node-red-contrib-bigfile/issues).

For more information, feedback, or community support see the Node-Red Google groups forum at https://groups.google.com/forum/#!forum/node-red


