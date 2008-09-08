# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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

// The property of the header that's used to check if a message is indexed
const gHdrIndexedProperty = "indexed";

// The file extension that is used for support files of this component
const gFileExt = ".mozeml";

// The pref base
const gPrefBase = "mail.spotlight";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function InitSpotlightIntegration()
{
  var enabled;
  try {
    enabled = gPrefBranch.getBoolPref(gPrefBase + ".enable");
    gLastFolderIndexedUri = gPrefBranch.getCharPref(gPrefBase + ".lastFolderIndexedUri");
  } catch (ex) {}

  if (enabled)
    SIDump("initializing spotlight integration\n");
  InitSupportIntegration(enabled);
}

function xmlEscapeString(s)
{
 s = s.replace(/&/g, "&amp;");
 s = s.replace(/>/g, "&gt;");
 s = s.replace(/</g, "&lt;");
 return s;
}

var fileHeader = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.\ncom/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>";

var gStreamListener = {
_buffer: "",
outputFile: null,
outputStream: null,
unicodeConverter: null,
subject: null,
message: null,
msgHdr:null,

onDoneStreamingCurMessage: function(successful)
{
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
  if (aIId.equals(Ci.nsIStreamListener) ||
      aIId.equals(Ci.nsISupports))
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
    this.outputStream = outputFileStream.QueryInterface(Ci.nsIOutputStream);
    this.outputStream.write(fileHeader, fileHeader.length);
    this.outputStream.write("<key>kMDItemLastUsedDate</key><string>", 38);
    // need to write the date as a string
    var curTimeStr = new Date().toLocaleString();
    this.outputStream.write(curTimeStr, curTimeStr.length);
    // need to write the subject in utf8 as the title
    this.outputStream.write("</string>\n<key>kMDItemTitle</key>\n<string>", 42);

    if (!this.unicodeConverter)
    {
      this.unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);
      this.unicodeConverter.charset = "UTF-8";

    }
    var utf8Subject  = this.unicodeConverter.ConvertFromUnicode(this.subject);
    utf8Subject += this.unicodeConverter.Finish();
    utf8Subject = xmlEscapeString(utf8Subject);
    this.outputStream.write(utf8Subject, utf8Subject.length);

    // need to write the subject in utf8 as the title
    this.outputStream.write("</string>\n<key>kMDItemDisplayName</key>\n<string>", 48);
    this.outputStream.write(utf8Subject, utf8Subject.length);

    this.outputStream.write("</string>\n<key>kMDItemTextContent</key>\n<string>", 48);
    var author = this.msgHdr.mime2DecodedAuthor;
    var recipients = this.msgHdr.mime2DecodedRecipients;

    var utf8Author = this.unicodeConverter.ConvertFromUnicode(author);
    utf8Author += this.unicodeConverter.Finish() + " ";
    utf8Author = xmlEscapeString(utf8Author);
    var utf8Recipients = this.unicodeConverter.ConvertFromUnicode(recipients);
    utf8Recipients += this.unicodeConverter.Finish() + " ";
    utf8Recipients = xmlEscapeString(utf8Recipients);
    this.outputStream.write(utf8Author, utf8Author.length);
    this.outputStream.write(utf8Recipients, utf8Recipients.length);

    this.outputStream.write(utf8Subject, utf8Subject.length);
    this.outputStream.write(" ", 1);
  }
  catch (ex)
  {
    onDoneStreamingCurMessage(false);
  }
},

onStopRequest: function(request, context, status, errorMsg) {
  try
  {
    // we want to write out the from, to, cc, and subject headers into the
    // Text Content value, so they'll be indexed.

    var stringStream = Cc["@mozilla.org/io/string-input-stream;1"].
      createInstance(Ci.nsIStringInputStream);
    stringStream.setData(this.message, this.message.length);
    var temp = this.msgHdr.folder.getMsgTextFromStream(stringStream, this.msgHdr.Charset, 20000, 20000, false, true, {});
    temp = xmlEscapeString(temp);
    SIDump("utf8 text = *****************\n"+ temp + "\n");
    this.outputStream.write(temp, temp.length);
    // close out the content, dict, and plist
    this.outputStream.write("</string>\n</dict>\n</plist>\n", 26);

    this.outputStream.close();
   // this.outputFile.
    this.msgHdr.setUint32Property(gHdrIndexedProperty, 1);
    var msgDB = this.msgHdr.folder.getMsgDatabase(null);
    msgDB.Commit(MSG_DB_LARGE_COMMIT);

    this.message = "";
  }
  catch (ex)
  {
    dump(ex);
    this.onDoneStreamingCurMessage(false);
    return;
  }
  this.onDoneStreamingCurMessage(true);
},

onDataAvailable: function(request, context, inputStream, offset, count) {
  try
  {
    var inStream = Cc["@mozilla.org/scriptableinputstream;1"]
      .createInstance(Ci.nsIScriptableInputStream);
    inStream.init(inputStream);

    // It is necessary to read in data from the input stream
    var inData = inStream.read(count);

    // ignore stuff after the first 20K or so
    if (this.message && this.message.length > 20000)
      return 0;

    this.message += inData;
    return 0;
  }
  catch (ex)
  {
    dump(ex);
    onDoneStreamingCurMessage(false);
  }
}

}

/* XPCOM boilerplate code */
function SpotlightIntegration() { }
SpotlightIntegration.prototype = {
  classDescription: "Spotlight Integration",
  classID: Components.ID("{cc9c2a34-567b-451a-a942-1a1c3ec26e07}"),
  contractID: "@mozilla.org/spotlight-search-integration;1",

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
      try { InitSpotlightIntegration(); }
      catch(err) { SIDump("Could not initialize spotlight component"); }
    break;
    default:
      throw Components.Exception("Unknown topic: " + aTopic);
    }
  }
};
var components = [SpotlightIntegration];
function NSGetModule(aCompMgr, aFileSpec)
{
  return XPCOMUtils.generateModule(components);
}
