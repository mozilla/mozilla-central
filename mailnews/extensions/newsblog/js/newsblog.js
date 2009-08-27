/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is the News&Blog Feed Downloader
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Myk Melez <myk@mozilla.org) (Original Author)
 *  David Bienvenu <bienvenu@nventure.com> 
 *  Ian Neal <iann_bugzilla@blueyonder.co.uk>
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

var gExternalScriptsLoaded = false;

var nsNewsBlogFeedDownloader =
{
  downloadFeed: function(aUrl, aFolder, aQuickMode, aTitle, aUrlListener, aMsgWindow)
  {
    const Ci = Components.interfaces;
    
    if (!gExternalScriptsLoaded)
      loadScripts();

    // we don't yet support the ability to check for new articles while we are in the middle of 
    // subscribing to a feed. For now, abort the check for new feeds. 
    if (progressNotifier.mSubscribeMode)
    {
      debug('Aborting RSS New Mail Check. Feed subscription in progress\n');
      return;
    }
    // if folder seems to have lost its feeds, look in DS for feeds.
    if (!aUrl.length)
    {
      var ds = getSubscriptionsDS(aFolder.server);
      var enumerator = ds.GetSources(FZ_DESTFOLDER, aFolder, true);
      var concatenatedUris = "";
      while (enumerator.hasMoreElements())
      {
        var containerArc = enumerator.getNext();
        var uri = containerArc.QueryInterface(Ci.nsIRDFResource).Value;
        if (concatenatedUris.length > 0)
          concatenatedUris += "|";
        concatenatedUris += uri;
      }
      if (concatenatedUris.length > 0)
      {
        aUrl = concatenatedUris;
        try
        {
          var msgdb = aFolder.msgDatabase;
          var folderInfo = msgdb.dBFolderInfo;
          folderInfo.setCharProperty("feedUrl", concatenatedUris);
        }
        catch (ex) {dump(ex);}
      }
    }

    // Return if there is still nothing in aUrl or the folder is in Trash.
    if (!aUrl.length ||
        aFolder.isSpecialFolder(Ci.nsMsgFolderFlags.Trash, true))
      return;

    // Maybe just pull all these args out of the aFolder DB,
    // instead of passing them in...
    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                        .getService(Ci.nsIRDFService);
    progressNotifier.init(aMsgWindow, false);

    // aUrl may be a delimited list of feeds for a particular folder.
    // We need to kick off a download for each feed.
    var feedUrlArray = aUrl.split("|");
    for (var url in feedUrlArray)
    {
      if (feedUrlArray[url])
      {
        var id = rdf.GetResource(feedUrlArray[url]);
        var feed = new Feed(id, aFolder.server);
        feed.folder = aFolder;
        gNumPendingFeedDownloads++; // bump our pending feed download count
        feed.download(true, progressNotifier);
      }
    }
  },

  subscribeToFeed: function(aUrl, aFolder, aMsgWindow)
  {
    if (!gExternalScriptsLoaded)
      loadScripts();

    // we don't support the ability to subscribe to several feeds at once yet...
    // for now, abort the subscription if we are already in the middle of subscribing to a feed
    // via drag and drop.
    if (gNumPendingFeedDownloads)
    {
      debug('Aborting RSS subscription. Feed downloads already in progress\n');
      return;
    }

    // if aFolder is null, then use the root folder for the first RSS account
    if (!aFolder)
    {
      var accountManager =
        Components.classes["@mozilla.org/messenger/account-manager;1"]
                  .getService(Components.interfaces.nsIMsgAccountManager);
      var allServers = accountManager.allServers;
      for (var i = 0; i < allServers.Count() && !aFolder; i++)
      {
        var currentServer = allServers.QueryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
        if (currentServer && currentServer.type == 'rss')
          aFolder = currentServer.rootFolder;      
      }
    }

    // If the user has no RSS account yet, create one; also check then if
    // the "Local Folders" exist yet and create if necessary
    if (!aFolder)
    {
      var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                              .getService(Components.interfaces.nsIMsgAccountManager);

      var server = acctMgr.createIncomingServer("nobody", "Feeds", "rss");

      server.biffMinutes = 100;
      server.prettyName = GetNewsBlogStringBundle().GetStringFromName("feeds-accountname");
      server.valid = true;
      var account = acctMgr.createAccount();
      account.incomingServer = server;

      aFolder = account.incomingServer.rootFolder;

      // Create "Local Folders" if none exist yet as it's guaranteed that those
      // exist when any account exists
      var localFolders = null;
      try  {
        localFolders = acctMgr.localFoldersServer;
      } catch (ex) {
      }

      if (!localFolders)
        acctMgr.createLocalMailAccount();

      // Save new accounts in case of a crash
      try {
        acctMgr.saveAccountInfo();
      } catch (ex) {
      }
    }

    if (!aMsgWindow)
    {
      var wmed = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);

      var wlist = wmed.getEnumerator("mail:3pane");
      if (wlist.hasMoreElements())
      {
        var win = wlist.getNext()
                       .QueryInterface(Components.interfaces.nsIDOMWindow);
        win.focus();
        aMsgWindow = win.msgWindow;
      }
      else
      {
        // If there are no open windows, open one, pass it the URL, and
        // during opening it will subscribe to the feed.
        var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                           .getService(Components.interfaces.nsIWindowWatcher);
        var arg = Components.classes["@mozilla.org/supports-string;1"]
                            .createInstance(Components.interfaces.nsISupportsString);
        arg.data = aUrl;
        ww.openWindow(null, "chrome://messenger/content/", "_blank",
                      "chrome,dialog=no,all", arg);
        return;
      }
    }

    // If aUrl is a feed url, then it is either of the form
    // feed://example.org/feed.xml or feed:https://example.org/feed.xml.
    // Replace feed:// with http:// per the spec, then strip off feed:
    // for the second case.
    aUrl = aUrl.replace(/^feed:\x2f\x2f/i, "http://");
    aUrl = aUrl.replace(/^feed:/i, "");

    // make sure we aren't already subscribed to this feed before we attempt to subscribe to it.
    if (feedAlreadyExists(aUrl, aFolder.server))
    {
      aMsgWindow.statusFeedback.showStatusString(GetNewsBlogStringBundle().GetStringFromName('subscribe-feedAlreadySubscribed'));     
      return;
    }

    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
              .getService(Components.interfaces.nsIRDFService);
    
    var itemResource = rdf.GetResource(aUrl);
    var feed = new Feed(itemResource, aFolder.server);
    feed.quickMode = feed.server.getBoolValue('quickMode');

    if (!aFolder.isServer) // if the root server, create a new folder for the feed
      feed.folder = aFolder; // user must want us to add this subscription url to an existing RSS folder.

    progressNotifier.init(aMsgWindow, true);
    gNumPendingFeedDownloads++;
    feed.download(true, progressNotifier);
  },

  updateSubscriptionsDS: function(aFolder, aUnsubscribe)
  {
    if (!gExternalScriptsLoaded)
      loadScripts();

    // an rss folder was just renamed...we need to update our feed data source
    var msgdb = aFolder.QueryInterface(Components.interfaces.nsIMsgFolder)
                       .msgDatabase;
    var folderInfo = msgdb.dBFolderInfo;
    var feedUrlArray = folderInfo.getCharProperty("feedUrl").split("|");

    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
    var ds = getSubscriptionsDS(aFolder.server);

    for (var url in feedUrlArray)
    {
      var newFeedUrl = feedUrlArray[url];
      if (newFeedUrl)
      {
        var id = rdf.GetResource(newFeedUrl);
        // We need to check and see if the folder is a child of the trash...
        // if it is, then we can treat this as an unsubscribe action.
        if (aUnsubscribe)
        {
          deleteFeed(id, aFolder.server);
        }
        else
        {
          var resource = rdf.GetResource(aFolder.URI);
          // get the node for the current folder URI
          var node = ds.GetTarget(id, FZ_DESTFOLDER, true);
          if (node)
            ds.Change(id, FZ_DESTFOLDER, node, resource);
          else
            addFeed(newFeedUrl, resource.name, resource);
        }
      }
    } // for each feed url in the folder property

    ds.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush(); // flush any changes
  },

  QueryInterface: function(aIID)
  {
    if (aIID.equals(Components.interfaces.nsINewsBlogFeedDownloader) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

var nsNewsBlogAcctMgrExtension = 
{ 
  name: "newsblog",
  chromePackageName: "messenger-newsblog",
  showPanel: function (server)
  {
    return false;
  },
  QueryInterface: function(aIID)
  {
    if (aIID.equals(Components.interfaces.nsIMsgAccountManagerExtension) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }  
}

var nsNewsBlogFeedDownloaderModule =
{
  getClassObject: function(aCompMgr, aCID, aIID)
  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    for (var key in this.mObjects) 
      if (aCID.equals(this.mObjects[key].CID))
        return this.mObjects[key].factory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  mObjects: 
  {
    feedDownloader: 
    { 
      CID: Components.ID("{5c124537-adca-4456-b2b5-641ab687d1f6}"),
      contractID: "@mozilla.org/newsblog-feed-downloader;1",
      className: "News+Blog Feed Downloader",
      factory: 
      {
        createInstance: function (aOuter, aIID) 
        {
          if (aOuter != null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
          if (!aIID.equals(Components.interfaces.nsINewsBlogFeedDownloader) &&
              !aIID.equals(Components.interfaces.nsISupports))
            throw Components.results.NS_ERROR_INVALID_ARG;

          // return the singleton
          return nsNewsBlogFeedDownloader.QueryInterface(aIID);
        }       
      } // factory
    }, // feed downloader
    
    nsNewsBlogAcctMgrExtension: 
    { 
      CID: Components.ID("{E109C05F-D304-4ca5-8C44-6DE1BFAF1F74}"),
      contractID: "@mozilla.org/accountmanager/extension;1?name=newsblog",
      className: "News+Blog Account Manager Extension",
      factory: 
      {
        createInstance: function (aOuter, aIID) 
        {
          if (aOuter != null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
          if (!aIID.equals(Components.interfaces.nsIMsgAccountManagerExtension) &&
              !aIID.equals(Components.interfaces.nsISupports))
            throw Components.results.NS_ERROR_INVALID_ARG;

          // return the singleton
          return nsNewsBlogAcctMgrExtension.QueryInterface(aIID);
        }       
      } // factory
    } // account manager extension
  },

  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType)
  {        
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    for (var key in this.mObjects) 
    {
      var obj = this.mObjects[key];
      aCompMgr.registerFactoryLocation(obj.CID, obj.className, obj.contractID, aFileSpec, aLocation, aType);
    }

    // we also need to do special account extension registration
    var catman = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
    catman.addCategoryEntry("mailnews-accountmanager-extensions",
                            "newsblog account manager extension",
                            "@mozilla.org/accountmanager/extension;1?name=newsblog", true, true);
  },

  unregisterSelf: function(aCompMgr, aFileSpec, aLocation)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    for (var key in this.mObjects) 
    {
      var obj = this.mObjects[key];
      aCompMgr.unregisterFactoryLocation(obj.CID, aFileSpec);
    }

    // unregister the account manager extension
    catman = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
    catman.deleteCategoryEntry("mailnews-accountmanager-extensions",
                               "@mozilla.org/accountmanager/extension;1?name=newsblog", true);
  },

  canUnload: function(aCompMgr)
  {
    return true;
  }
};

function NSGetModule(aCompMgr, aFileSpec)
{
  return nsNewsBlogFeedDownloaderModule;
}

function loadScripts()
{
  var scriptLoader =  Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                     .getService(Components.interfaces.mozIJSSubScriptLoader);
  if (scriptLoader)
  { 
    scriptLoader.loadSubScript("chrome://messenger-newsblog/content/Feed.js");
    scriptLoader.loadSubScript("chrome://messenger-newsblog/content/FeedItem.js");
    scriptLoader.loadSubScript("chrome://messenger-newsblog/content/feed-parser.js");
    scriptLoader.loadSubScript("chrome://messenger-newsblog/content/file-utils.js");
    scriptLoader.loadSubScript("chrome://messenger-newsblog/content/utils.js");
  }

  gExternalScriptsLoaded = true;
}

// Progress glue code. Acts as a go between the RSS back end and the mail window front end
// determined by the aMsgWindow parameter passed into nsINewsBlogFeedDownloader.
// gNumPendingFeedDownloads: keeps track of the total number of feeds we have been asked to download
//                           this number may not reflect the # of entries in our mFeeds array because not all
//                           feeds may have reported in for the first time...
var gNumPendingFeedDownloads = 0;

var progressNotifier = {
  mSubscribeMode: false,
  mMsgWindow: null, 
  mStatusFeedback: null,
  mFeeds: {},

  init: function(aMsgWindow, aSubscribeMode)
  {
    if (!gNumPendingFeedDownloads) // if we aren't already in the middle of downloading feed items...
    {
      this.mStatusFeedback = aMsgWindow ? aMsgWindow.statusFeedback : null;
      this.mSubscribeMode = aSubscribeMode;
      this.mMsgWindow = aMsgWindow;

      if (this.mStatusFeedback)
      {
        this.mStatusFeedback.startMeteors();
        this.mStatusFeedback.showStatusString(aSubscribeMode ?
          GetNewsBlogStringBundle().GetStringFromName('subscribe-validating-feed') :
          GetNewsBlogStringBundle().GetStringFromName('newsblog-getNewMsgsCheck'));
      }
    }
  },

  downloaded: function(feed, aErrorCode)
  {
    if (this.mSubscribeMode && aErrorCode == kNewsBlogSuccess)
    {
      // if we get here...we should always have a folder by now...either
      // in feed.folder or FeedItems created the folder for us....
      updateFolderFeedUrl(feed.folder, feed.url, false);        
      addFeed(feed.url, feed.name, feed.folder); // add feed just adds the feed to the subscription UI and flushes the datasource
      
      // Nice touch: select the folder that now contains the newly subscribed feed...this is particularly nice 
      // if we just finished subscribing to a feed URL that the operating system gave us.
      this.mMsgWindow.windowCommands.selectFolder(feed.folder.URI);
    } 
    else if (feed.folder)
      feed.folder.msgDatabase = null;

    if (this.mStatusFeedback)
    {
      var newsBlogBundle = GetNewsBlogStringBundle();
      if (aErrorCode == kNewsBlogNoNewItems)
        this.mStatusFeedback.showStatusString(newsBlogBundle.GetStringFromName("newsblog-noNewArticlesForFeed"));
      else if (aErrorCode == kNewsBlogInvalidFeed)
        this.mStatusFeedback.showStatusString(
          newsBlogBundle.formatStringFromName("newsblog-feedNotValid", [feed.url], 1));
      else if (aErrorCode == kNewsBlogRequestFailure)
        this.mStatusFeedback.showStatusString(newsBlogBundle.formatStringFromName("newsblog-networkError",
                                              [feed.url], 1));                                           
      this.mStatusFeedback.stopMeteors();
    }

    if (!--gNumPendingFeedDownloads)
    {
      this.mFeeds = {};

      this.mSubscribeMode = false;

      // should we do this on a timer so the text sticks around for a little while? 
      // It doesnt look like we do it on a timer for newsgroups so we'll follow that model.
      if (aErrorCode == kNewsBlogSuccess && this.mStatusFeedback) // don't clear the status text if we just dumped an error to the status bar!
        this.mStatusFeedback.showStatusString("");
    }
  },

  // this gets called after the RSS parser finishes storing a feed item to disk
  // aCurrentFeedItems is an integer corresponding to how many feed items have been downloaded so far
  // aMaxFeedItems is an integer corresponding to the total number of feed items to download
  onFeedItemStored: function (feed, aCurrentFeedItems, aMaxFeedItems)
  { 
    // we currently don't do anything here. Eventually we may add
    // status text about the number of new feed articles received.

    if (this.mSubscribeMode && this.mStatusFeedback) // if we are subscribing to a feed, show feed download progress
    {
      this.mStatusFeedback.showStatusString(
        GetNewsBlogStringBundle().formatStringFromName("subscribe-gettingFeedItems",
                                                       [aCurrentFeedItems, aMaxFeedItems], 2));
      this.onProgress(feed, aCurrentFeedItems, aMaxFeedItems);
    }
  },

  onProgress: function(feed, aProgress, aProgressMax)
  {
    if (feed.url in this.mFeeds) // have we already seen this feed?
      this.mFeeds[feed.url].currentProgress = aProgress;
    else
      this.mFeeds[feed.url] = {currentProgress: aProgress, maxProgress: aProgressMax};
    
    this.updateProgressBar();     
  },

  updateProgressBar: function()
  {
    var currentProgress = 0;
    var maxProgress = 0;
    for (index in this.mFeeds)
    {
      currentProgress += this.mFeeds[index].currentProgress;
      maxProgress += this.mFeeds[index].maxProgress;
    }

    // if we start seeing weird "jumping" behavior where the progress bar goes below a threshold then above it again,
    // then we can factor a fudge factor here based on the number of feeds that have not reported yet and the avg
    // progress we've already received for existing feeds. Fortunately the progressmeter is on a timer
    // and only updates every so often. For the most part all of our request have initial progress
    // before the UI actually picks up a progress value. 

    if (this.mStatusFeedback)
    {
      var progress = (currentProgress * 100) / maxProgress;
      this.mStatusFeedback.showProgress(progress);
    }
  }
}

function GetNewsBlogStringBundle(name)
{
  var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(); 
  strBundleService = strBundleService.QueryInterface(Components.interfaces.nsIStringBundleService);
  var strBundle = strBundleService.createBundle("chrome://messenger-newsblog/locale/newsblog.properties"); 
  return strBundle;
}
