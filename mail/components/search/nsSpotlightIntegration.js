# -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const MSG_DB_LARGE_COMMIT = 1;

// Module object
var SpotlightIntegrationMod = {
  firstTime:  true,
  cid :  Components.ID("{42EFAD76-FCDC-4757-951E-26896759E87E}"),
  progid: "@mozilla.org/desktop-search-integration;1",
  className: "Spotlight Integration",

factory:  
  {
  createInstance: function (aOuter, aIID) 
    {
      if (aOuter != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      if (!aIID.equals(Components.interfaces.nsISupports))
        throw Components.results.NS_ERROR_INVALID_ARG;
      
      InitSpotlightIntegration();
      // return the singleton
      return nsSpotlightIntegration.QueryInterface(aIID);
    }       
  }, // factory
  

  getClassObject: function(aCompMgr, aCID, aIID)
  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    
      if (aCID.equals(this.cid))
        return this.factory;
    
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType)
  {        
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(this.cid, this.className, this.progid, aFileSpec, aLocation, aType);  
  },

  unregisterSelf: function(aCompMgr, aFileSpec, aLocation)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(this.cid, aFileSpec);  
  },

  canUnload: function(aCompMgr)
  {
    return true;
  }
};

function NSGetModule(aCompMgr, aFileSpec)
{
  return SpotlightIntegrationMod;
}

var nsSpotlightIntegration = {
  
  QueryInterface: function(aIID)
  {
    if (aIID.equals(Components.interfaces.nsISupports))
      return this;
    
    Components.returnCode = Components.results.NS_ERROR_NO_INTERFACE;
    return null;
  }
}

var gCurrentFolderToIndex;
var gLastFolderIndexedUri = ""; // this is stored in the pref "mail.spotlight.lastFolderIndexedUri"
var gHeaderEnumerator;
var gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch(null);
var gIndexMsgsToSpotlight;
var gAlarm;
var gBackgroundIndexingDone;
var gMessenger;

function InitSpotlightIntegration()
{
  SIDump("initializing spotlight integration\n");

  try {
    gIndexMsgsToSpotlight = gPrefBranch.getBoolPref("mail.spotlight.enable");
    gLastFolderIndexedUri = gPrefBranch.getCharPref("mail.spotlight.lastFolderIndexedUri");
  } catch (ex) {}
  
  if (!gIndexMsgsToSpotlight)
    return;
  var nsIFolderListener = Components.interfaces.nsIFolderListener;
  gMessenger = Components.classes["@mozilla.org/messenger;1"].createInstance().QueryInterface(Components.interfaces.nsIMessenger);

  var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"].getService(Components.interfaces.nsIMsgFolderNotificationService);
  notificationService.addListener(gFolderListener);
  var ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  ObserverService.addObserver(CreateMsgDisplayedObserver, "MsgMsgDisplayed", false);
  gMsgHdrsToIndex = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
  
  restartTimer(60);
}

function FindNextFolderToIndex()
{
  accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);
  var servers = accountManager.allServers;
  var foundFolder = false;
  var useNextFolder = false;
  
  for (var i = 0; i < servers.Count() && !foundFolder; i++)
  {
    var server = servers.QueryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
    var rootFolder = server.rootFolder;
    var allFolders = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
    rootFolder.ListDescendents(allFolders);
    var numFolders = allFolders.Count();
    SIDump("in find next folder, gLastFolderIndexedUri = " + gLastFolderIndexedUri + "\n");
    for (var folderIndex = 0; folderIndex < numFolders && !foundFolder; folderIndex++)
    {
      var folder = allFolders.GetElementAt(folderIndex).QueryInterface(Components.interfaces.nsIMsgFolder);
      // if no folder was indexed (or the pref's not set), just use the first folder
      if (!gLastFolderIndexedUri.length || useNextFolder)
      {
        gCurrentFolderToIndex = folder;
        foundFolder = true;
      }
      else
      {
        if (gLastFolderIndexedUri == folder.URI)
          useNextFolder = true;
      }
    }
  }
  
}

function FindNextHdrToIndex()
{
  if (!gHeaderEnumerator)
  {
    var msgDB = gCurrentFolderToIndex.getMsgDatabase(null);
    gHeaderEnumerator = msgDB.EnumerateMessages();
  }
  // iterate over the folder finding the next message to 
  // index...
  while (gHeaderEnumerator.hasMoreElements())
  {
    var msgHdr = gHeaderEnumerator.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
    if (!msgHdr.getUint32Property("indexed"))
      return msgHdr;
  }
  gHeaderEnumerator = null;
  return null;  
}

function onTimer()
{
  var msgHdrToIndex = null;

  if (gBackgroundIndexingDone)
    return;
  
  // find the current folder we're working on
  if (!gCurrentFolderToIndex)
    FindNextFolderToIndex();
  
  
  // we'd like to index more than one message on each timer fire,
  // but since streaming is async, it's hard to know how long
  // it's going to take to stream any particular message. Mozilla has no way of telling
  // us when the system is idle.
  if (gCurrentFolderToIndex)
  {
    var msgHdrToIndex = FindNextHdrToIndex();
  }
  else
  {
    // we've cycled through all the folders, we should take a break
    // from indexing of existing messages
    gBackgroundIndexingDone = true;
    
  }
  if (!msgHdrToIndex)
  {
    SIDump("reached end of folder\n");
    if (gCurrentFolderToIndex)
    {
      gLastFolderIndexedUri = gCurrentFolderToIndex.URI;
      gPrefBranch.setCharPref("mail.spotlight.lastFolderIndexedUri", gLastFolderIndexedUri);
      gCurrentFolderToIndex = null;
    }
  }
  else
  {
    QueueMessageToGetIndexed(msgHdrToIndex);
  }
  restartTimer(gMsgHdrsToIndex.Count() > 1 ? 5 : 1);
}

function restartTimer(seconds)
{
  if (gAlarm)
    gAlarm.cancel();
  var jslib = Cc["@mozilla.org/url-classifier/jslib;1"]
    .getService().wrappedJSObject;
  
  gAlarm = new jslib.G_Alarm(onTimer, seconds*1000);
}

function xmlEscapeString(s)
{
 s = s.replace(/&/g, "&amp;");
 s = s.replace(/>/g, "&gt;");
 s = s.replace(/</g, "&lt;");
 return s; 
}

var CreateMsgDisplayedObserver = 
{
  // Components.interfaces.nsIObserver
  observe: function(aHeaderSink, aTopic, aData)
    {
    // if the user is reading messages, we're not idle, so restart timer.
    restartTimer(60);
    SIDump("topic = " + aTopic + " uri = " + aData + "\n");
    var msgHdr = gMessenger.msgHdrFromURI(aData);
    var indexed = msgHdr.getUint32Property("indexed");
    if (!indexed)
    {
      var file = GetSpotlightFileForMsgHdr(msgHdr);
      if (!file.exists())
        QueueMessageToGetIndexed(msgHdr);
    }
  }
};


var gMsgHdrsToIndex;


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
    var file = GetSpotlightFileForMsgHdr(this.msgHdr);
    if (file && file.exists())
      file.remove(false);
  }
  // should we try to delete the file on disk in case not successful?
  gMsgHdrsToIndex.DeleteElementAt(0);
  
  if (gMsgHdrsToIndex.GetElementAt(0))
  {
    var msgHdr = gMsgHdrsToIndex.QueryElementAt(0, Components.interfaces.nsIMsgDBHdr);
    GenerateSpotlightFile(msgHdr);
  }
},
  
  
  
QueryInterface: function(aIId, instance) {
  if (aIId.equals(Components.interfaces.nsIStreamListener) ||
      aIId.equals(Components.interfaces.nsISupports))
    return this;
  
  Components.returnCode = Components.results.NS_ERROR_NO_INTERFACE;
  return null;
},

onStartRequest: function(request, context) {
  try
  {
    
    var outputFileStream =  Components.classes["@mozilla.org/network/file-output-stream;1"].
    createInstance(Components.interfaces.nsIFileOutputStream);
    outputFileStream.init(this.outputFile, -1, -1, 0);
    this.outputStream = outputFileStream.QueryInterface(Components.interfaces.nsIOutputStream);
    this.outputStream.write(fileHeader, fileHeader.length);
    this.outputStream.write("<key>kMDItemLastUsedDate</key><string>", 38);
    // need to write the date as a string
    var curTimeStr = new Date().toLocaleString();
    this.outputStream.write(curTimeStr, curTimeStr.length);
    // need to write the subject in utf8 as the title
    this.outputStream.write("</string>\n<key>kMDItemTitle</key>\n<string>", 42);
    
    if (!this.unicodeConverter)
    {
      this.unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
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
    
    var stringStream = Components.classes["@mozilla.org/io/string-input-stream;1"].
      createInstance(Components.interfaces.nsIStringInputStream);
    stringStream.setData(this.message, this.message.length);
    var temp = this.msgHdr.folder.getMsgTextFromStream(this.msgHdr, stringStream, 20000, 20000, false);
    temp = xmlEscapeString(temp);
    SIDump("utf8 text = *****************\n"+ temp + "\n");
    this.outputStream.write(temp, temp.length);
    // close out the content, dict, and plist
    this.outputStream.write("</string>\n</dict>\n</plist>\n", 26);
    
    this.outputStream.close();
   // this.outputFile.
    this.msgHdr.setUint32Property("indexed", 1);
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
      
    // ignore stuff after the first 20K or so 
    if (this.message && this.message.length > 20000)
      return 0;
    var inStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
      createInstance(Components.interfaces.nsIScriptableInputStream);
    
    inStream.init(inputStream);
    
    this.message += inStream.read(count);
    return 0;
  }
  catch (ex)
  {
    dump(ex);
    onDoneStreamingCurMessage(false);
  }
}

}

// the folderListener object
var gFolderListener = {
  
  itemAdded: function(aItem)
  {
    restartTimer(30);
    SIDump("itemAdded\n");
    var msgHdr;
    try
    {
      msgHdr = aItem.QueryInterface(Components.interfaces.nsIMsgDBHdr);
    }
    catch (ex) {}
    if (msgHdr)
      QueueMessageToGetIndexed(msgHdr);
  },
  
  // folder or msg deleted (no trash)
   itemDeleted: function(aItem)
  {
     SIDump("in itemDeleted\n");
     // mail getting deleted, we're not idle, so restart timer.
     restartTimer(60);
     var msgHdr;
     try{
       msgHdr = aItem.QueryInterface(Components.interfaces.nsIMsgDBHdr);
     } catch (ex) {}
     
     if (msgHdr)
     {
       var file = GetSpotlightFileForMsgHdr(msgHdr);
       if (file.exists())
         file.remove(false);
     }
     else
     {
       var folder = aItem.QueryInterface(Components.interfaces.nsIMsgFolder);
       if (folder)
       {
         var srcFile = folder.filePath;
         srcFile.leafName = srcFile.leafName + ".mozmsgs";
         srcFile.remove(true);
         
       }
     }
     
  },
  
  itemMoveCopyCompleted: function(aMove, aSrcItems, aDestFolder)
  {
    var folder;
    try {
       folder = aSrcItems.QueryElementAt(0, Components.interfaces.nsIMsgFolder);
    } catch (ex) {   }
    if (folder)
    {
      var destFile = aDestFolder.filePath;
      var srcFile = folder.filePath;
      srcFile.leafName = srcFile.leafName + ".mozmsgs";
      destFile.leafName += ".sbd";
      SIDump ("dst file path = " + destFile.path + "\n");
      SIDump ("src file path = " + srcFile.path + "\n");
      if (srcFile.exists())
      {
        if (aMove)
          srcFile.moveTo(destFile, "");
        else
          srcFile.copyTo(destFile, "");
      }
    }
    else
    {
      var msg = aSrcItems.QueryElementAt(0, Components.interfaces.nsIMsgDBHdr);
      if (msg)
      {
        var numMsgs = aSrcItems.Count();
        for (var msgIndex = 0; msgIndex < numMsgs; msgIndex++)
        {
          msg = aSrcItems.QueryElementAt(msgIndex, Components.interfaces.nsIMsgDBHdr);
          var srcFile = GetSpotlightFileForMsgHdr(msg);
          if (srcFile && srcFile.exists())
          {
            var destFile = aDestFolder.filePath;
            destFile.leafName = destFile.leafName + ".mozmsgs";
            if (!destFile.exists())
            {
              try
              {
                // create the directory, if it doesn't exist
                destFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0644);
              }
              catch(ex) {dump(ex);}
            }
            SIDump ("dst file path = " + destFile.path + "\n");
            SIDump ("src file path = " + srcFile.path + "\n");
            if (destFile.exists())
              if (aMove)
                srcFile.moveTo(destFile, "");
              else
                srcFile.copyTo(destfile, "");
            
          }
        }
        
      }
    }
    restartTimer(30);
    SIDump("moveCopyCompleted move = " + aMove + "\n");     
  },
  
  folderRenamed: function(aOrigFolder, aNewFolder)
  {
    
  },
  // extensibility hook
  itemEvent: function(aItem, aEvent, aData)
  {
    
  }, 
};


function QueueMessageToGetIndexed(msgHdr)
{
  var isupportsHdr = msgHdr.QueryInterface(Components.interfaces.nsISupports);
  gMsgHdrsToIndex.AppendElement(isupportsHdr);
  if (gMsgHdrsToIndex.Count() == 1)
  {
    SIDump("generating spotlight file\n");
    GenerateSpotlightFile(msgHdr);
  }
  else
    SIDump("queueing spotlight file generation\n");
}

function GetSpotlightFileForMsgHdr(msgHdr)
{
  var folder = msgHdr.folder;
  if (folder)
  {
    var messageId = msgHdr.messageId;
    messageId = encodeURIComponent(messageId);
    SIDump("encoded message id = " + messageId + "\n");
    // this should work on the trunk, but not in 2.0
//    messageId = netUtils.escapeString(messageId, 3 /* netUtils.ESCAPE_URL_PATH */);
    if (folder)
    {
      var file = folder.filePath;
      file.leafName = file.leafName + ".mozmsgs";
      file.appendRelativePath(messageId + ".mozeml");
      SIDump("getting spotlight file path = " + file.path + "\n");
      return file;
    }
  }
  return nsnull;    
}

const MSG_FLAG_HAS_RE = 0x0010;

function GenerateSpotlightFile(msgHdr)
{
  try
  {
    var folder = msgHdr.folder;
    if (folder)
    {
      var messageId = msgHdr.messageId;
      // for the trunk, this should work
  //    var netUtils = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsINetUtil);
  //    messageId = netUtils.escapeString(messageId, netUtils.ESCAPE_URL_PATH);
      messageId = encodeURIComponent(messageId);
      gStreamListener.subject = ((msgHdr.flags & MSG_FLAG_HAS_RE) ? "Re: " : "") + msgHdr.mime2DecodedSubject;
      SIDump("generate spotlight file subject = " + gStreamListener.subject + "message id = " + messageId + "\n");
      var file = folder.filePath;
      
      file.leafName = file.leafName + ".mozmsgs";
      SIDump("file leafname = " + file.leafName + "\n");
      if (!file.exists())
      {
        try
        {
          // create the directory, if it doesn't exist
          file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0644);
        }
        catch(ex) {dump(ex);}
      }
      gStreamListener.msgHdr = msgHdr;
      file.appendRelativePath(messageId + ".mozeml");
      //file.leafName = messageId + ".mozeml";
      SIDump("file path = " + file.path + "\n");
      file.create(0, 0644);
      var uri = folder.getUriForMsg(msgHdr);
      //SIDump("in onItemAdded messenger = " + messenger + "\n");
      var msgService = gMessenger.messageServiceFromURI(uri);
      gStreamListener.outputFile = file;
      
      msgService.streamMessage(uri, gStreamListener, null, null, false, "", null);
    }
  }
  catch (ex) 
  {
    dump(ex);
    gStreamListener.onDoneStreamingCurMessage(false);
  }

};

var gSIDump = true;

function SIDump(str)
{
  if (gSIDump)
    dump(str);
}
