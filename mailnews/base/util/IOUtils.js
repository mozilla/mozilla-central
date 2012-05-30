/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["IOUtils"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var IOUtils =
{
  /**
   * Read a file containing ASCII text into a string.
   *
   * @param aFile An nsIFile representing the file to read.
   * @returns A string containing the contents of the file, presumed to be ASCII
   *          text.
   */
  loadFileToString: function IOUtils_loadFileToString(aFile) {
    let fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                    .createInstance(Ci.nsIFileInputStream);
    fstream.init(aFile, -1, 0, 0);

    let sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                    .createInstance(Ci.nsIScriptableInputStream);
    sstream.init(fstream);

    let data = "";
    let str = sstream.read(4096);
    while (str.length > 0) {
      data += str;
      str = sstream.read(4096);
    }

    sstream.close();
    fstream.close();

    return data;
  },

  /**
   * This is provided by the JS component loader.
   */
  btoa: btoa,

  getPhysicalMemorySize: function IOUtils_getPhysicalMemorySize() {
    let systemInfo = Cc["@mozilla.org/system-info;1"]
                      .createInstance(Ci.nsIPropertyBag2);
    return systemInfo.getPropertyAsInt64("memsize");
  },
};
