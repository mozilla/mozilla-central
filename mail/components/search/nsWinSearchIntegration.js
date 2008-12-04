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

var gWinSearchHelper;

var gFoldersInCrawlScope;

var gRegKeysPresent;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function InitWinSearchIntegration()
{
  // We're currently only enabled on Vista and above
  var sysInfo = Cc["@mozilla.org/system-info;1"].getService(Ci.nsIPropertyBag2);
  var windowsVersion = sysInfo.getProperty("version");
  if (parseFloat(windowsVersion) < 6)
  {
    SIDump("Windows version " + windowsVersion + " < 6.0\n");
    return;
  }

  // enabled === undefined means that the first run hasn't occurred yet (pref isn't present).
  // false or true means that the first run has occurred, and the user has selected
  // the corresponding decision.
  var enabled;
  try {
    enabled = gPrefBranch.getBoolPref(gPrefBase + ".enable");
    gLastFolderIndexedUri = gPrefBranch.getCharPref(gPrefBase + ".lastFolderIndexedUri");
  } catch (ex) {}

  gWinSearchHelper = Cc["@mozilla.org/mail/windows-search-helper;1"].getService(Ci.nsIMailWinSearchHelper);
  var serviceRunning = false;
  try
  {
    serviceRunning = gWinSearchHelper.serviceRunning;
  }
  catch (e) {}
  // If the service isn't running, then we should stay in backoff mode
  if (!serviceRunning)
  {
    SIDump("Windows Search service not running\n");
    InitSupportIntegration(false);
    return;
  }

  gFoldersInCrawlScope = gWinSearchHelper.foldersInCrawlScope;
  gRegKeysPresent = CheckRegistryKeys();

  if (enabled === undefined)
    // First run has to be handled after the main mail window is open
    return true;

  if (enabled)
    SIDump("Initializing Windows Search integration\n");
  InitSupportIntegration(enabled);
}

// Handles first run, once the main mail window has popped up.
function WinSearchFirstRun(window)
{
  // If any of the two are not present, we need to elevate.
  var needsElevation = !gFoldersInCrawlScope || !gRegKeysPresent;
  var params = {in: {showUAC: needsElevation}};
  var scope = this;

  params.callback = function(enable)
  {
    CheckRegistryKeys();
    if (enable && needsElevation)
    {
      try { scope.gWinSearchHelper.runSetup(true); }
      catch (e) { enable = false; }
    }
    if (enable)
    {
      if (!scope.gWinSearchHelper.isFileAssociationSet)
      {
        try { scope.gWinSearchHelper.setFileAssociation(); }
        catch (e) { SIDump("File association not set\n"); }
      }
      // Also set the FANCI bit to 0 for the profile directory
      scope.gWinSearchHelper.setFANCIBit(Cc["@mozilla.org/file/directory_service;1"]
                                         .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile),
                                         false, true);
    }
    scope.gPrefBranch.setBoolPref(gPrefBase + ".enable", enable);
    scope.InitSupportIntegration(enable);
  }

  window.openDialog("chrome://messenger/content/search/searchIntegrationDialog.xul", "",
                    "chrome, dialog, resizable=no, centerscreen", params).focus();
}

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

// Required to access the 64-bit registry, even though we're probably a 32-bit program
const ACCESS_WOW64_64KEY = 0x0100;

// Check whether the required registry keys exist
function CheckRegistryKeys()
{
  for (var i = 0; i < gRegKeys.length; i++)
  {
    var regKey = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);
    try {
      regKey.open(gRegKeys[i].root, gRegKeys[i].key, regKey.ACCESS_READ | ACCESS_WOW64_64KEY);
    }
    catch (e) { return false; }
    var valuePresent = regKey.hasValue(gRegKeys[i].name) &&
                        (regKey.readStringValue(gRegKeys[i].name) == gRegKeys[i].value);
    regKey.close();
    if (!valuePresent)
      return false;
  }
  return true;
}

// The stream listener to read messages
var gStreamListener = {
_buffer: "",
outputFile: null,
outputStream: null,
unicodeConverter: null,
// subject: null,
message: "",
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

  throw Components.results.NS_ERROR_NO_INTERFACE;
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
    // XXX Once the JS emitter gets checked in, this code should probably be
    // switched over to use that
    // Decode using getMsgTextFromStream
    var stringStream = Cc["@mozilla.org/io/string-input-stream;1"].
      createInstance(Ci.nsIStringInputStream);
    stringStream.setData(this.message, this.message.length);
    var contentType = {};
    var folder = this.msgHdr.folder;
    var text = folder.getMsgTextFromStream(stringStream, this.msgHdr.charset,
                                           65536, 50000, false, false, contentType);

    // To get the Received header, we need to parse the message headers.
    // We only need the first header, which contains the latest received date
    var headers = this.message.split(/\r\n\r\n|\r\r|\n\n/, 1)[0];
    var mimeHeaders = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    mimeHeaders.initialize(headers, headers.length);
    var receivedHeader = mimeHeaders.extractHeader("Received", false);

    this.outputStream.writeString("From: " + this.msgHdr.author + CRLF);
    // If we're a newsgroup, then add the name of the folder as the newsgroups header
    if (folder instanceof Ci.nsIMsgNewsFolder)
      this.outputStream.writeString("Newsgroups: " + folder.name + CRLF);
    else
      this.outputStream.writeString("To: " + this.msgHdr.recipients + CRLF);
    this.outputStream.writeString("CC: " + this.msgHdr.ccList + CRLF);
    this.outputStream.writeString("Subject: " + this.msgHdr.subject + CRLF);
    if (receivedHeader)
      this.outputStream.writeString("Received: " + receivedHeader + CRLF);
    this.outputStream.writeString("Date: " + new Date(this.msgHdr.date / 1000).toUTCString() + CRLF);
    this.outputStream.writeString("Content-Type: " + contentType.value + "; charset=utf-8" + CRLF + CRLF);

    this.outputStream.writeString(text + CRLF + CRLF);

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

    // Also ignore stuff after the first 50K or so
    if (this.message && this.message.length > 50000)
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
    var obsSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    switch(aTopic)
    {
    case "app-startup":
      obsSvc.addObserver(this, "profile-after-change", false);
      break;
    case "profile-after-change":
      try
      {
        if (InitWinSearchIntegration())
          obsSvc.addObserver(this, "mail-startup-done", false);
      }
      catch(err) { SIDump("Could not initialize winsearch component"); }
      break;
    case "mail-startup-done":
      aSubject.QueryInterface(Ci.nsIDOMWindowInternal);
      obsSvc.removeObserver(this, "mail-startup-done");
      try { WinSearchFirstRun(aSubject); }
      catch(err) { SIDump("First run unsuccessful\n"); }
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
