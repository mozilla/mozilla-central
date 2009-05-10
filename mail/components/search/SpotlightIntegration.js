/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is spotlight integration code.
 *
 * The Initial Developer of the Original Code is
 * David Bienvenu <bienvenu@mozilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Siddharth Agarwal <sid1337@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include content/searchCommon.js

var EXPORTED_SYMBOLS = ["SearchIntegration"];

const MSG_DB_LARGE_COMMIT = 1;
const gFileHeader = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.\ncom/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>";

let SearchIntegration =
{
  __proto__: SearchSupport,

  /// The property of the header and (sometimes) folders that's used to check
  /// if a message is indexed
  _hdrIndexedProperty: "spotlight_reindex_time",

  /// The file extension that is used for support files of this component
  _fileExt: ".mozeml",

  /// The Spotlight pref base
  _prefBase: "mail.spotlight.",

  /// The user's profile dir, which we'll cache and use a lot for path clean-up
  get _profileDir()
  {
    delete this._profileDir;
    return this._profileDir = Cc["@mozilla.org/file/directory_service;1"]
                                .getService(Ci.nsIProperties)
                                .get("ProfD", Ci.nsIFile);
  },

  /// Spotlight won't index files in the profile dir, but will use ~/Library/Caches/Metadata
  _getSearchPathForFolder: function spotlight_get_search_path(aFolder)
  {
    // Swap the metadata dir for the profile dir prefix in the folder's path
    let folderPath = aFolder.filePath.path;
    let fixedPath = folderPath.replace(this._profileDir.path,
                                       "~/Library/Caches/Metadata/Thunderbird");
    let searchPath = Cc["@mozilla.org/file/local;1"]
                       .createInstance(Ci.nsILocalFile);
    searchPath.initWithPath(fixedPath);
    return searchPath;
  },

  _init: function spotlight_init()
  {
    this._initLogging();

    let enabled;
    try {
      enabled = this._prefBranch.getBoolPref("enable");
    } catch (ex) {}

    if (enabled)
      this._log.info("Initializing Spotlight integration");
    this._initSupport(enabled);
  },

  /// The stream listener to read messages
  _streamListener: {
    __proto__: SearchSupport._streamListenerBase,

    /// Buffer to store the message
    _message: null,

    /// Encodes reserved XML characters
    _xmlEscapeString: function spotlight_xml_escape_string(s)
    {
      return s.replace(/[<>&]/g, function(s) {
        switch (s) {
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "&": return "&amp;";
          default: throw Error("Unexpected match");
          }
        }
      );
    },

    onStartRequest: function(request, context) {
      try {
        let outputFileStream = Cc["@mozilla.org/network/file-output-stream;1"]
                               .createInstance(Ci.nsIFileOutputStream);
        outputFileStream.init(this._outputFile, -1, -1, 0);
        this._outputStream = Cc["@mozilla.org/intl/converter-output-stream;1"]
                               .createInstance(Ci.nsIConverterOutputStream);
        this._outputStream.init(outputFileStream, "UTF-8", 0, 0x0000);

        this._outputStream.writeString(gFileHeader);
        this._outputStream.writeString(
          "<key>kMDItemLastUsedDate</key><string>");
        // need to write the date as a string
        let curTimeStr = new Date().toLocaleString();
        this._outputStream.writeString(curTimeStr);

        // need to write the subject in utf8 as the title
        this._outputStream.writeString(
          "</string>\n<key>kMDItemTitle</key>\n<string>");

        let escapedSubject = this._xmlEscapeString(
          this._msgHdr.mime2DecodedSubject);
        this._outputStream.writeString(escapedSubject);

        this._outputStream.writeString(
          "</string>\n<key>kMDItemDisplayName</key>\n<string>");
        this._outputStream.writeString(escapedSubject);

        this._outputStream.writeString(
          "</string>\n<key>kMDItemTextContent</key>\n<string>");
        this._outputStream.writeString(this._xmlEscapeString(
          this._msgHdr.mime2DecodedAuthor));
        this._outputStream.writeString(this._xmlEscapeString(
          this._msgHdr.mime2DecodedRecipients));

        this._outputStream.writeString(escapedSubject);
        this._outputStream.writeString(" ");
      }
      catch (ex) { this._onDoneStreaming(false); }
    },

    onStopRequest: function(request, context, status, errorMsg) {
      try {
        // we want to write out the from, to, cc, and subject headers into the
        // Text Content value, so they'll be indexed.
        let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
                             .createInstance(Ci.nsIStringInputStream);
        stringStream.setData(this._message, this._message.length);
        let folder = this._msgHdr.folder;
        let text = folder.getMsgTextFromStream(stringStream,
                                               this._msgHdr.Charset, 20000,
                                               20000, false, true, {});
        text = this._xmlEscapeString(text);
        SearchIntegration._log.debug("escaped text = *****************\n" + text);
        this._outputStream.writeString(text);
        // close out the content, dict, and plist
        this._outputStream.writeString("</string>\n</dict>\n</plist>\n");

        this._msgHdr.setUint32Property(SearchIntegration._hdrIndexedProperty,
                                       this._reindexTime);
        folder.msgDatabase.Commit(MSG_DB_LARGE_COMMIT);

        this._message = "";
      }
      catch (ex) {
        SearchIntegration._log.error(ex);
        this._onDoneStreaming(false);
        return;
      }
      this._onDoneStreaming(true);
    },

    onDataAvailable: function(request, context, inputStream, offset, count) {
      try {
        let inStream = Cc["@mozilla.org/scriptableinputstream;1"]
                         .createInstance(Ci.nsIScriptableInputStream);
        inStream.init(inputStream);

        // It is necessary to read in data from the input stream
        let inData = inStream.read(count);

        // ignore stuff after the first 20K or so
        if (this._message && this._message.length > 20000)
          return 0;

        this._message += inData;
        return 0;
      }
      catch (ex) {
        SearchIntegration._log.error(ex);
        this._onDoneStreaming(false);
      }
    }
  }
};

/* Initialize the search integration object */
try {
  SearchIntegration._init();
}
catch (ex) {
  SearchIntegration._log.error("Could not initialize spotlight component");
}
