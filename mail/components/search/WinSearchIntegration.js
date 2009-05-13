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
const CRLF="\r\n";

/**
 * Required to access the 64-bit registry, even though we're probably a 32-bit
 * program
 */
const ACCESS_WOW64_64KEY = 0x0100;

/**
 * All the registry keys required for integration
 */
const gRegKeys =
[
  // This is the property handler
  {
    root: Ci.nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE,
    key: "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PropertySystem\\PropertyHandlers\\.wdseml",
    name: "",
    value: "{5FA29220-36A1-40f9-89C6-F4B384B7642E}"
  },
  // These two are the association with the MIME IFilter
  {
    root: Ci.nsIWindowsRegKey.ROOT_KEY_CLASSES_ROOT,
    key: ".wdseml",
    name: "Content Type",
    value: "message/rfc822"
  },
  {
    root: Ci.nsIWindowsRegKey.ROOT_KEY_CLASSES_ROOT,
    key: ".wdseml\\PersistentHandler",
    name: "",
    value: "{5645c8c4-e277-11cf-8fda-00aa00a14f93}"
  },
  // This is the association with the Windows mail preview handler
  {
    root: Ci.nsIWindowsRegKey.ROOT_KEY_CLASSES_ROOT,
    key: ".wdseml\\shellex\\{8895B1C6-B41F-4C1C-A562-0D564250836F}",
    name: "",
    value: "{b9815375-5d7f-4ce2-9245-c9d4da436930}"
  },
  // This is the association made to display results under email
  {
    root: Ci.nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE,
    key: "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\explorer\\KindMap",
    name: ".wdseml",
    value: "email;communication"
  }
];

/**
 * @namespace Windows Search-specific desktop search integration functionality
 */
let SearchIntegration =
{
  __proto__: SearchSupport,

  /// The property of the header and (sometimes) folders that's used to check
  /// if a message is indexed
  _hdrIndexedProperty: "winsearch_reindex_time",

  /// The file extension that is used for support files of this component
  _fileExt: ".wdseml",

  /// The Windows Search pref base
  _prefBase: "mail.winsearch.",

  /// Helper (native) component
  __winSearchHelper: null,
  get _winSearchHelper()
  {
    if (!this.__winSearchHelper)
      this.__winSearchHelper = Cc["@mozilla.org/mail/windows-search-helper;1"]
                                 .getService(Ci.nsIMailWinSearchHelper);
    return this.__winSearchHelper;
  },

  /// Whether the folders are already in the crawl scope
  get _foldersInCrawlScope()
  {
    return this._winSearchHelper.foldersInCrawlScope;
  },

  /**
   * Whether all the required registry keys are present
   * We'll be optimistic here and assume that once the registry keys have been
   * added, they won't be removed, at least while Thunderbird is open
   */
  __regKeysPresent: false,
  get _regKeysPresent()
  {
    if (!this.__regKeysPresent)
    {
      for (let i = 0; i < gRegKeys.length; i++)
      {
        let regKey = Cc["@mozilla.org/windows-registry-key;1"]
                       .createInstance(Ci.nsIWindowsRegKey);
        try {
          regKey.open(gRegKeys[i].root, gRegKeys[i].key, regKey.ACCESS_READ |
                                                         ACCESS_WOW64_64KEY);
        }
        catch (e) { return false; }
        let valuePresent = regKey.hasValue(gRegKeys[i].name) &&
                           (regKey.readStringValue(gRegKeys[i].name) ==
                            gRegKeys[i].value);
        regKey.close();
        if (!valuePresent)
          return false;
      }
      this.__regKeysPresent = true;
    }
    return true;
  },

  /// Use the folder's path (i.e., in profile dir) as is
  _getSearchPathForFolder: function winsearch_get_search_path(aFolder)
  {
    return aFolder.filePath;
  },

  _init: function winsearch_init()
  {
    this._initLogging();
    // We're currently only enabled on Vista and above
    let sysInfo = Cc["@mozilla.org/system-info;1"]
                    .getService(Ci.nsIPropertyBag2);
    let windowsVersion = sysInfo.getProperty("version");
    if (parseFloat(windowsVersion) < 6)
    {
      this._log.fatal("Windows version " + windowsVersion + " < 6.0");
      this.osVersionTooLow = true;
      return;
    }

    let serviceRunning = false;
    try {
      serviceRunning = this._winSearchHelper.serviceRunning;
    }
    catch (e) {}
    // If the service isn't running, then we should stay in backoff mode
    if (!serviceRunning)
    {
      this._log.info("Windows Search service not running");
      this.osComponentsNotRunning = true;
      this._initSupport(false);
      return;
    }
 
    let enabled = this.prefEnabled;

    if (enabled)
      this._log.info("Initializing Windows Search integration");
    this._initSupport(enabled);
  },

  /**
   * Add necessary hooks to Windows
   *
   * @return false if registration did not succeed, because the elevation
   * request was denied
   */
  register: function winsearch_register()
  {
    // If any of the two are not present, we need to elevate.
    if (!this._foldersInCrawlScope || !this._regKeysPresent)
    {
      try {
        this._winSearchHelper.runSetup(true);
      }
      catch (e) { return false; }
    }

    if (!this._winSearchHelper.isFileAssociationSet)
    {
      try {
        this._winSearchHelper.setFileAssociation();
      }
      catch (e) { this._log.warn("File association not set"); }
    }
    // Also set the FANCI bit to 0 for the profile directory
    let profD = Cc["@mozilla.org/file/directory_service;1"]
                  .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    this._winSearchHelper.setFANCIBit(profD, false, true);

    return true;
  },

  /**
   * Remove integration from Windows. The only thing removed is the directory
   * from the index list. This will ask for elevation.
   *
   * @return false if deregistration did not succeed, because the elevation
   * request was denied
   */
  deregister: function winsearch_deregister()
  {
    try {
      this._winSearchHelper.runSetup(false);
    }
    catch (e) { return false; }
    
    return true;
  },

  /// The stream listener to read messages
  _streamListener: {
    __proto__: SearchSupport._streamListenerBase,

    /// Buffer to store the message
    _message: "",

    onStartRequest: function(request, context) {
      try {
        let outputFileStream =  Cc["@mozilla.org/network/file-output-stream;1"]
                                  .createInstance(Ci.nsIFileOutputStream);
        outputFileStream.init(this._outputFile, -1, -1, 0);
        this._outputStream = Cc["@mozilla.org/intl/converter-output-stream;1"]
                               .createInstance(Ci.nsIConverterOutputStream);
        this._outputStream.init(outputFileStream, "UTF-8", 0, 0x0000);
      }
      catch (ex) { this._onDoneStreaming(false); }
    },

    onStopRequest: function(request, context, status, errorMsg) {
      try {
        // XXX Once the JS emitter gets checked in, this code should probably be
        // switched over to use that
        // Decode using getMsgTextFromStream
        let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
                             .createInstance(Ci.nsIStringInputStream);
        stringStream.setData(this._message, this._message.length);
        let contentType = {};
        let folder = this._msgHdr.folder;
        let text = folder.getMsgTextFromStream(stringStream,
                                               this._msgHdr.Charset, 65536,
                                               50000, false, false,
                                               contentType);

        // To get the Received header, we need to parse the message headers.
        // We only need the first header, which contains the latest received
        // date
        let headers = this._message.split(/\r\n\r\n|\r\r|\n\n/, 1)[0];
        let mimeHeaders = Cc["@mozilla.org/messenger/mimeheaders;1"]
                            .createInstance(Ci.nsIMimeHeaders);
        mimeHeaders.initialize(headers, headers.length);
        let receivedHeader = mimeHeaders.extractHeader("Received", false);

        this._outputStream.writeString("From: " + this._msgHdr.author + CRLF);
        // If we're a newsgroup, then add the name of the folder as the
        // newsgroups header
        if (folder instanceof Ci.nsIMsgNewsFolder)
          this._outputStream.writeString("Newsgroups: " + folder.name + CRLF);
        else
          this._outputStream.writeString("To: " + this._msgHdr.recipients +
                                         CRLF);
        this._outputStream.writeString("CC: " + this._msgHdr.ccList + CRLF);
        this._outputStream.writeString("Subject: " + this._msgHdr.subject +
                                       CRLF);
        if (receivedHeader)
          this._outputStream.writeString("Received: " + receivedHeader + CRLF);
        this._outputStream.writeString(
          "Date: " + new Date(this._msgHdr.date / 1000).toUTCString() + CRLF);
        this._outputStream.writeString("Content-Type: " + contentType.value +
                                       "; charset=utf-8" + CRLF + CRLF);

        this._outputStream.writeString(text + CRLF + CRLF);

        this._msgHdr.setUint32Property(SearchIntegration._hdrIndexedProperty,
                                       this._reindexTime);
        folder.msgDatabase.Commit(MSG_DB_LARGE_COMMIT);

        this._message = "";
        SearchIntegration._log.info("Successfully written file");
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

        // Ignore stuff after the first 50K or so
        if (this._message && this._message.length > 50000)
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

SearchIntegration._init();
