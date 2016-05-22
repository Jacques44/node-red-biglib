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

Work in progress. Please look at `Big Nodes`

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


