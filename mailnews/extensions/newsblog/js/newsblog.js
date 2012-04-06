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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var gExternalScriptsLoaded = false;

var nsNewsBlogFeedDownloader =
{
  downloadFeed: function(aA, aFolder, aB, aC, aUrlListener, aMsgWindow)
  {
    if (!gExternalScriptsLoaded)
      loadScripts();

    // We don't yet support the ability to check for new articles while we are
    // in the middle of subscribing to a feed. For now, abort the check for
    // new feeds.
    if (FeedUtils.progressNotifier.mSubscribeMode)
    {
      FeedUtils.log.warn("downloadFeed: Aborting RSS New Mail Check. " +
                         "Feed subscription in progress\n");
      return;
    }

    let feedUrlArray = getFeedUrlsInFolder(aFolder);

    // Return if there are no feedUrls for the base folder in the feeds
    // database, the base folder has no subfolders, or the folder is in Trash.
    if ((!feedUrlArray && !aFolder.hasSubFolders) ||
        aFolder.isSpecialFolder(Ci.nsMsgFolderFlags.Trash, true))
      return;

    let allFolders = Cc["@mozilla.org/supports-array;1"].
                     createInstance(Ci.nsISupportsArray);
    // Add the base folder; it does not get added by ListDescendents.
    allFolders.AppendElement(aFolder);
    aFolder.ListDescendents(allFolders);
    let numFolders = allFolders.Count();
    let trashFolder =
        aFolder.rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);

    function feeder() {
      let folder;
      for (let i = 0; i < numFolders; i++) {
        folder = allFolders.GetElementAt(i).QueryInterface(Ci.nsIMsgFolder);
        FeedUtils.log.debug("downloadFeed: START x/# foldername:uri - "+
                            (i+1)+"/"+ numFolders+" "+
                            folder.name+":"+folder.URI);

        // Ensure msgDatabase for the folder is open for new message processing.
        let msgDb;
        try {
          msgDb = folder.msgDatabase;
        }
        catch (ex) {}
        if (!msgDb) {
          // Force a reparse.  After the async reparse the folder will be ready
          // for the next cycle; don't bother with a listener.  Continue with
          // the next folder, as attempting to add a message to a folder with
          // an unavailable msgDatabase will throw later.
          FeedUtils.log.debug("downloadFeed: rebuild msgDatabase for "+
                              folder.name+" - "+folder.filePath.path);
          try
          {
            // Ignore error returns.
            folder.QueryInterface(Ci.nsIMsgLocalMailFolder).
                   getDatabaseWithReparse(null, null);
          }
          catch (ex) {}
          continue;
        }

        let feedUrlArray = getFeedUrlsInFolder(folder);
        // Continue if there are no feedUrls for the folder in the feeds
        // database.  All folders in Trash are now unsubscribed, so perhaps
        // we may not want to check that here each biff each folder.
        if (!feedUrlArray ||
            (aFolder.isServer && trashFolder && trashFolder.isAncestorOf(folder)))
          continue;

        FeedUtils.log.debug("downloadFeed: CONTINUE foldername:urlArray - "+
                            folder.name+":"+feedUrlArray);

        FeedUtils.progressNotifier.init(aMsgWindow, false);

        // We need to kick off a download for each feed.
        let id, feed;
        for (let url in feedUrlArray)
        {
          if (feedUrlArray[url])
          {
            id = rdf.GetResource(feedUrlArray[url]);
            feed = new Feed(id, folder.server);
            feed.folder = folder;
            // Bump our pending feed download count.
            FeedUtils.progressNotifier.mNumPendingFeedDownloads++;
            feed.download(true, FeedUtils.progressNotifier);
            FeedUtils.log.debug("downloadFeed: DOWNLOAD feed url - "+
                                feedUrlArray[url]);
          }

          Services.tm.mainThread.dispatch(function() {
            try {
              getFeed.next();
            }
            catch (ex) {
              if (ex instanceof StopIteration)
                // Finished with all feeds in base folder and its subfolders.
                FeedUtils.log.debug("downloadFeed: Finished with folder - "+
                                    aFolder.name);
              else
              {
                FeedUtils.log.error("downloadFeed: error - " + ex);
                FeedUtils.progressNotifier.downloaded({name: folder.name}, 0);
              }
            }
          }, Ci.nsIThread.DISPATCH_NORMAL);

          yield;
        }
      }
    }

    let getFeed = feeder();
    try {
      getFeed.next();
    }
    catch (ex) {
      if (ex instanceof StopIteration)
        // Nothing to do.
        FeedUtils.log.debug("downloadFeed: Nothing to do in folder - "+
                            aFolder.name);
      else
      {
        FeedUtils.log.error("downloadFeed: error - " + ex);
        FeedUtils.progressNotifier.downloaded({name: aFolder.name}, 0);
      }
    }
  },

  subscribeToFeed: function(aUrl, aFolder, aMsgWindow)
  {
    if (!gExternalScriptsLoaded)
      loadScripts();

    // We don't support the ability to subscribe to several feeds at once yet.
    // For now, abort the subscription if we are already in the middle of
    // subscribing to a feed via drag and drop.
    if (FeedUtils.progressNotifier.mNumPendingFeedDownloads)
    {
      FeedUtils.log.warn("subscribeToFeed: Aborting RSS subscription. " +
                         "Feed downloads already in progress\n");
      return;
    }

    // If aFolder is null, then use the root folder for the first RSS account.
    if (!aFolder)
    {
      let allServers = MailServices.accounts.allServers;
      for (let i = 0; i < allServers.Count() && !aFolder; i++)
      {
        let currentServer = allServers.QueryElementAt(i, Ci.nsIMsgIncomingServer);
        if (currentServer && currentServer.type == 'rss')
          aFolder = currentServer.rootFolder;
      }
    }

    // If the user has no RSS account yet, create one; also check then if
    // the "Local Folders" exist yet and create if necessary.
    if (!aFolder)
    {
      let server = MailServices.accounts.createIncomingServer("nobody",
                                                              "Feeds",
                                                              "rss");
      server.biffMinutes = FeedUtils.kBiffMinutesDefault;
      server.prettyName = FeedUtils.strings.GetStringFromName("feeds-accountname");
      server.valid = true;
      let account = MailServices.accounts.createAccount();
      account.incomingServer = server;

      aFolder = account.incomingServer.rootFolder;

      // Create "Local Folders" if none exist yet as it's guaranteed that
      // those exist when any account exists.
      let localFolders = null;
      try {
        localFolders = MailServices.accounts.localFoldersServer;
      }
      catch (ex) {}

      if (!localFolders)
        MailServices.accounts.createLocalMailAccount();

      // Save new accounts in case of a crash.
      try {
        MailServices.accounts.saveAccountInfo();
      } catch (ex) {}
    }

    if (!aMsgWindow)
    {
      let wlist = Services.wm.getEnumerator("mail:3pane");
      if (wlist.hasMoreElements())
      {
        let win = wlist.getNext().QueryInterface(Ci.nsIDOMWindow);
        win.focus();
        aMsgWindow = win.msgWindow;
      }
      else
      {
        // If there are no open windows, open one, pass it the URL, and
        // during opening it will subscribe to the feed.
        let arg = Cc["@mozilla.org/supports-string;1"].
                  createInstance(Ci.nsISupportsString);
        arg.data = aUrl;
        Services.ww.openWindow(null, "chrome://messenger/content/",
                               "_blank", "chrome,dialog=no,all", arg);
        return;
      }
    }

    // If aUrl is a feed url, then it is either of the form
    // feed://example.org/feed.xml or feed:https://example.org/feed.xml.
    // Replace feed:// with http:// per the spec, then strip off feed:
    // for the second case.
    aUrl = aUrl.replace(/^feed:\x2f\x2f/i, "http://");
    aUrl = aUrl.replace(/^feed:/i, "");

    // Make sure we aren't already subscribed to this feed before we attempt
    // to subscribe to it.
    if (feedAlreadyExists(aUrl, aFolder.server))
    {
      aMsgWindow.statusFeedback.showStatusString(
        FeedUtils.strings.GetStringFromName('subscribe-feedAlreadySubscribed'));
      return;
    }

    let itemResource = rdf.GetResource(aUrl);
    let feed = new Feed(itemResource, aFolder.server);
    feed.quickMode = feed.server.getBoolValue('quickMode');

    // If the root server, create a new folder for the feed.  The user must
    // want us to add this subscription url to an existing RSS folder.
    if (!aFolder.isServer)
      feed.folder = aFolder;

    FeedUtils.progressNotifier.init(aMsgWindow, true);
    FeedUtils.progressNotifier.mNumPendingFeedDownloads++;
    feed.download(true, FeedUtils.progressNotifier);
  },

  updateSubscriptionsDS: function(aFolder, aUnsubscribe)
  {
    if (!gExternalScriptsLoaded)
      loadScripts();

    // An rss folder was just changed, get the folder's feedUrls and update
    // our feed data source.
    let feedUrlArray = getFeedUrlsInFolder(aFolder);
    if (!feedUrlArray)
      // No feedUrls in this folder.
      return;

    let newFeedUrl, id, resource, node;
    let ds = getSubscriptionsDS(aFolder.server);
    let trashFolder =
        aFolder.rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);
    for (let url in feedUrlArray)
    {
      newFeedUrl = feedUrlArray[url];
      if (newFeedUrl)
      {
        id = rdf.GetResource(newFeedUrl);
        // If explicit delete or move to trash, unsubscribe.
        if (aUnsubscribe ||
            (trashFolder && trashFolder.isAncestorOf(aFolder)))
        {
          deleteFeed(id, aFolder.server, aFolder);
        }
        else
        {
          resource = rdf.GetResource(aFolder.URI);
          // Get the node for the current folder URI.
          node = ds.GetTarget(id, FZ_DESTFOLDER, true);
          if (node)
            ds.Change(id, FZ_DESTFOLDER, node, resource);
          else
            addFeed(newFeedUrl, resource.name, resource);
        }
      }
    } // for each feed url in the folder property

    ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();
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

function FeedDownloader() {}

FeedDownloader.prototype =
{
  classID: Components.ID("{5c124537-adca-4456-b2b5-641ab687d1f6}"),
  _xpcom_factory:
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
}; // feed downloader

function AcctMgrExtension() {}

AcctMgrExtension.prototype =
{
  classID: Components.ID("{E109C05F-D304-4ca5-8C44-6DE1BFAF1F74}"),
  _xpcom_factory:
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
}; // account manager extension

var components = [FeedDownloader, AcctMgrExtension];
var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);

function loadScripts()
{
  var scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
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
