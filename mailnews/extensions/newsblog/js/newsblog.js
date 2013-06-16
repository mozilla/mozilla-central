/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var gExternalScriptsLoaded = false;

var nsNewsBlogFeedDownloader =
{
  downloadFeed: function(aA, aFolder, aB, aC, aUrlListener, aMsgWindow)
  {
    if (!gExternalScriptsLoaded)
      loadScripts();

    if (Services.io.offline)
      return;

    // We don't yet support the ability to check for new articles while we are
    // in the middle of subscribing to a feed. For now, abort the check for
    // new feeds.
    if (FeedUtils.progressNotifier.mSubscribeMode)
    {
      FeedUtils.log.warn("downloadFeed: Aborting RSS New Mail Check. " +
                         "Feed subscription in progress\n");
      return;
    }

    let allFolders = Cc["@mozilla.org/array;1"].
                     createInstance(Ci.nsIMutableArray);
    if (!aFolder.isServer) {
      // Add the base folder; it does not get returned by ListDescendants. Do not
      // add the account folder as it doesn't have the feedUrl property or even
      // a msgDatabase necessarily.
      allFolders.appendElement(aFolder, false);
    }

    aFolder.ListDescendants(allFolders);

    let trashFolder =
        aFolder.rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);

    function feeder() {
      let folder;
      let numFolders = allFolders.length;
      for (let i = 0; i < numFolders; i++) {
        folder = allFolders.queryElementAt(i, Ci.nsIMsgFolder);
        FeedUtils.log.debug("downloadFeed: START x/# foldername:uri - " +
                            (i+1) + "/" + numFolders + " " +
                            folder.name + ":" + folder.URI);

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
          FeedUtils.log.debug("downloadFeed: rebuild msgDatabase for " +
                              folder.name + " - " + folder.filePath.path);
          try
          {
            // Ignore error returns.
            folder.QueryInterface(Ci.nsIMsgLocalMailFolder).
                   getDatabaseWithReparse(null, null);
          }
          catch (ex) {}
          continue;
        }

        let feedUrlArray = FeedUtils.getFeedUrlsInFolder(folder);
        // Continue if there are no feedUrls for the folder in the feeds
        // database.  All folders in Trash are now unsubscribed, so perhaps
        // we may not want to check that here each biff each folder.
        if (!feedUrlArray ||
            (aFolder.isServer && trashFolder && trashFolder.isAncestorOf(folder)))
          continue;

        FeedUtils.log.debug("downloadFeed: CONTINUE foldername:urlArray - " +
                            folder.name + ":" + feedUrlArray);

        FeedUtils.progressNotifier.init(aMsgWindow, false);

        // We need to kick off a download for each feed.
        let id, feed;
        for (let url in feedUrlArray)
        {
          if (feedUrlArray[url])
          {
            id = FeedUtils.rdf.GetResource(feedUrlArray[url]);
            feed = new Feed(id, folder.server);
            feed.folder = folder;
            // Bump our pending feed download count.
            FeedUtils.progressNotifier.mNumPendingFeedDownloads++;
            feed.download(true, FeedUtils.progressNotifier);
            FeedUtils.log.debug("downloadFeed: DOWNLOAD feed url - " +
                                feedUrlArray[url]);
          }

          Services.tm.mainThread.dispatch(function() {
            try {
              getFeed.next();
            }
            catch (ex) {
              if (ex instanceof StopIteration)
                // Finished with all feeds in base folder and its subfolders.
                FeedUtils.log.debug("downloadFeed: Finished with folder - " +
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
        FeedUtils.log.debug("downloadFeed: Nothing to do in folder - " +
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
      aFolder = FeedUtils.getAllRssServerRootFolders()[0];

    // If the user has no Feeds account yet, create one.
    if (!aFolder)
      aFolder = FeedUtils.createRssAccount().incomingServer.rootFolder;

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
    if (FeedUtils.feedAlreadyExists(aUrl, aFolder.server))
    {
      aMsgWindow.statusFeedback.showStatusString(
        FeedUtils.strings.GetStringFromName("subscribe-feedAlreadySubscribed"));
      return;
    }

    let itemResource = FeedUtils.rdf.GetResource(aUrl);
    let feed = new Feed(itemResource, aFolder.server);
    feed.quickMode = feed.server.getBoolValue("quickMode");

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

    FeedUtils.log.debug("updateSubscriptionsDS: folder changed, name:unsubscribe - " +
                        aFolder.filePath.path + ":" + aUnsubscribe);

    // An rss folder was just changed, get the folder's feedUrls and update
    // our feed data source.
    let feedUrlArray = FeedUtils.getFeedUrlsInFolder(aFolder);
    if (!feedUrlArray)
      // No feedUrls in this folder.
      return;

    let newFeedUrl, id, resource, node;
    let ds = FeedUtils.getSubscriptionsDS(aFolder.server);
    let trashFolder =
        aFolder.rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);
    for (let url in feedUrlArray)
    {
      newFeedUrl = feedUrlArray[url];
      if (newFeedUrl)
      {
        FeedUtils.log.debug("updateSubscriptionsDS: processing url - " +
                            newFeedUrl);

        id = FeedUtils.rdf.GetResource(newFeedUrl);
        // If explicit delete or move to trash, unsubscribe.
        if (aUnsubscribe ||
            (trashFolder && trashFolder.isAncestorOf(aFolder)))
        {
          FeedUtils.deleteFeed(id, aFolder.server, aFolder);
        }
        else
        {
          resource = FeedUtils.rdf.GetResource(aFolder.URI);
          // Get the node for the current folder URI.
          node = ds.GetTarget(id, FeedUtils.FZ_DESTFOLDER, true);
          if (node)
            ds.Change(id, FeedUtils.FZ_DESTFOLDER, node, resource);
          else
            FeedUtils.addFeed(newFeedUrl, resource.name, resource);
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
  Services.scriptloader.loadSubScript("chrome://messenger-newsblog/content/Feed.js");
  Services.scriptloader.loadSubScript("chrome://messenger-newsblog/content/FeedItem.js");
  Services.scriptloader.loadSubScript("chrome://messenger-newsblog/content/feed-parser.js");
  Services.scriptloader.loadSubScript("chrome://messenger-newsblog/content/utils.js");

  gExternalScriptsLoaded = true;
}
