# node-red-biglib

"Big Lib" is the core library for "Big Nodes" I've made to contribute to the node-red node library. This library is used by nodes such as [big file](https://github.com/Jacques44/node-red-contrib-bigfile), [big csv](https://github.com/Jacques44/node-red-contrib-bigcsv) and [big line](https://github.com/Jacques44/node-red-contrib-bigline)

This library 

## Installation
```bash
npm install node-red-biglib
```

## Principles for Big Nodes

###1 can handle big data or block mode

  That means, in block mode, not only "one message is a whole file" and able to manage start/end control messages

###2 send start/end messages as well as statuses

  That means it uses a second output to give control states (start/end/running and error) control messages

###3 tell visually what they are doing

  Visual status on the node tells it's ready/running (blue), all is ok and done (green) or in error (red)

## Usage

This library is only used for node developpement.

## Dependencies

[byline](https://www.npmjs.com/package/byline) simple line-by-line stream reader

[filesize](http://filesizejs.com/) provides an easy way to get a human readable file size String

[moment](http://momentjs.com/) Parse, validate, manipulate, and display dates in JavaScript

## API

Work in progress. Please look at big file](https://github.com/Jacques44/node-red-contrib-bigfile), [big csv](https://github.com/Jacques44/node-red-contrib-bigcsv) and [big line](https://github.com/Jacques44/node-red-contrib-bigline) for examples 

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


