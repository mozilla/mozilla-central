# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is spotlight integration code.
#
# The Initial Developer of the Original Code is
# David Bienvenu <bienvenu@mozilla.com>
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Siddharth Agarwal <sid1337@gmail.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

#include content/searchCommon.js

const MSG_DB_LARGE_COMMIT = 1;
const MSG_FLAG_ATTACHMENT = 0x10000000;
const CRLF="\r\n";

// The property of the header that's used to check if a message is indexed
const gHdrIndexedProperty = "wds_indexed";

// The file extension that is used for support files of this component
const gFileExt = ".wdseml";

// The pref base
const gPrefBase = "mail.winsearch";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function InitWinSearchIntegration()
{
  var enabled;
  try {
    enabled = gPrefBranch.getBoolPref(gPrefBase + ".enable");
    gLastFolderIndexedUri = gPrefBranch.getCharPref(gPrefBase + ".lastFolderIndexedUri");
  } catch (ex) {}

  if (!enabled)
    return;

  SIDump("Initializing Windows Search integration\n");
  InitSupportIntegration();
}

// The stream listener to read messages
var gStreamListener = {
_buffer: "",
outputFile: null,
outputStream: null,
unicodeConverter: null,
// subject: null,
message: null,
msgHdr: null,
mimeHdrObj: null,
mimeHdrParamObj: null,

onDoneStreamingCurMessage: function(successful)
{
  if (this.outputStream)
    this.outputStream.close();
  if (!successful && this.msgHdr)
  {
    var file = GetSupportFileForMsgHdr(this.msgHdr);
    if (file && file.exists())
      file.remove(false);
  }
  // should we try to delete the file on disk in case not successful?
  gMsgHdrsToIndex.shift();

  if (gMsgHdrsToIndex.length > 0)
    GenerateSupportFile(gMsgHdrsToIndex[0]);
},

QueryInterface: function(aIId, instance) {
  if (aIId.equals(Ci.nsIStreamListener) || aIId.equals(Ci.nsISupports))
    return this;

  Components.returnCode = Components.results.NS_ERROR_NO_INTERFACE;
  return null;
},

onStartRequest: function(request, context) {
  try
  {
    var outputFileStream =  Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    outputFileStream.init(this.outputFile, -1, -1, 0);
    this.outputStream = Cc["@mozilla.org/intl/converter-output-stream;1"]
      .createInstance(Ci.nsIConverterOutputStream);
    this.outputStream.init(outputFileStream, "UTF-8", 0, 0x0000);
  }
  catch (ex)
  {
    onDoneStreamingCurMessage(false);
  }
},

onStopRequest: function(request, context, status, errorMsg) {
  try
  {
    // If, for some reason, the first four characters are "null", then remove them
    if (this.message.substring(0, 4) == "null")
      this.message = this.message.substring(4);

    // First get all the headers (everything till a double CRLF)
    var headerLength = this.message.indexOf(CRLF+CRLF)+1;

    // XXX the below has to be replaced with getMsgTextFromStream

    // Filter out attachments. First locate the content-type header.
    if (!this.mimeHdrObj)
      this.mimeHdrObj = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    this.mimeHdrObj.initialize(this.message.substring(0, headerLength), headerLength);
    var contentTypeHeader = this.mimeHdrObj.extractHeader("Content-Type", false);

    if (!this.mimeHdrParamObj)
      this.mimeHdrParamObj = Cc["@mozilla.org/network/mime-hdrparam;1"].createInstance(Ci.nsIMIMEHeaderParam);
    // If a multipart header, then strip out attachments
    var contentType = this.mimeHdrParamObj.getParameter(contentTypeHeader, null, null, true, {});
    if (contentType.substring(0,10) == "multipart/")
    {
      var boundary = this.mimeHdrParamObj.getParameter(contentTypeHeader, "boundary", null, true, {});

      // Search for the boundary after the headers. Remove everything from the second occurrence.
      boundary = CRLF + "--" + boundary;
      var getRidFrom = this.message.indexOf(boundary, headerLength);
      getRidFrom = this.message.indexOf(boundary, getRidFrom + boundary.length);

      // In case we've got more than one boundary so far
      if (getRidFrom != -1) {
        this.message = this.message.substring(0, getRidFrom);

        // Add RFC required stuff to the end
        this.message += boundary + "--" + CRLF;
      }
    }

    // We just write whatever we have in |message| out to the file
    this.outputStream.writeString(this.message);

    this.msgHdr.setUint32Property(gHdrIndexedProperty, 1);
    var msgDB = this.msgHdr.folder.getMsgDatabase(null);
    msgDB.Commit(MSG_DB_LARGE_COMMIT);

    this.message = "";
    SIDump("Successfully written file\n");
  }
  catch (ex)
  {
    SIDump(ex);
    this.onDoneStreamingCurMessage(false);
    return;
  }
  this.onDoneStreamingCurMessage(true);
},

onDataAvailable: function(request, context, inputStream, offset, count) {
  try
  {
    var inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    inStream.init(inputStream);

    // It is necessary to read in data from the input stream
    var inData = inStream.read(count);

    // If we've already reached the attachments, safely ignore.
    if (this.filteredAttachments)
      return 0;

    // Also ignore stuff after the first 20K or so
    if (this.message && this.message.length > 20000)
      return 0;
    var inStream = Cc["@mozilla.org/scriptableinputstream;1"].
      createInstance(Ci.nsIScriptableInputStream);

    inStream.init(inputStream);

    this.message += inData;
    return 0;
  }
  catch (ex)
  {
    SIDump(ex);
    onDoneStreamingCurMessage(false);
  }
}
};

/* XPCOM boilerplate code */
function WinSearchIntegration() { }
WinSearchIntegration.prototype = {
  classDescription: "Windows Search Integration",
  classID: Components.ID("{451a70f0-1b4f-11dd-bd0b-0800200c9a66}"),
  contractID: "@mozilla.org/windows-search-integration;1",

  _xpcom_categories: [{
    category: "app-startup",
    service: true
  }],

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupports]),

  observe : function(aSubject, aTopic, aData)
  {
    switch(aTopic)
    {
    case "app-startup":
      var obsSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
      obsSvc.addObserver(this, "profile-after-change", false);
    break;
    case "profile-after-change":
      try { InitWinSearchIntegration(); }
      catch(err) { SIDump("Could not initialize winsearch component"); }
    break;
    default:
      throw Components.Exception("Unknown topic: " + aTopic);
    }
  }
};
var components = [WinSearchIntegration];
function NSGetModule(aCompMgr, aFileSpec)
{
  return XPCOMUtils.generateModule(components);
}
