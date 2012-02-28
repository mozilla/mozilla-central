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
# The Original Code is Thunderbird RSS Utils
#
# The Initial Developer of the Original Code is
# The Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2005
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Myk Melez <myk@mozilla.org>
#  Scott MacGregor <mscott@mozilla.org>
#  Ian Neal <iann_bugzilla@blueyonder.co.uk>
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
# ***** END LICENSE BLOCK ******

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var FeedUtils = {
  kBiffMinutesDefault: 100,
  kNewsBlogSuccess: 0,
  // Usually means there was an error trying to parse the feed.
  kNewsBlogInvalidFeed: 1,
  // Generic networking failure when trying to download the feed.
  kNewsBlogRequestFailure: 2,
  kNewsBlogFeedIsBusy: 3,
  // There are no new articles for this feed
  kNewsBlogNoNewItems: 4,

  // Progress glue code.  Acts as a go between the RSS back end and the mail
  // window front end determined by the aMsgWindow parameter passed into
  // nsINewsBlogFeedDownloader.
  progressNotifier: {
    mSubscribeMode: false,
    mMsgWindow: null,
    mStatusFeedback: null,
    mFeeds: {},
    // Keeps track of the total number of feeds we have been asked to download.
    // This number may not reflect the # of entries in our mFeeds array because
    // not all feeds may have reported in for the first time.
    mNumPendingFeedDownloads: 0,

    init: function(aMsgWindow, aSubscribeMode)
    {
      if (!this.mNumPendingFeedDownloads)
      {
        // If we aren't already in the middle of downloading feed items.
        this.mStatusFeedback = aMsgWindow ? aMsgWindow.statusFeedback : null;
        this.mSubscribeMode = aSubscribeMode;
        this.mMsgWindow = aMsgWindow;

        if (this.mStatusFeedback)
        {
          this.mStatusFeedback.startMeteors();
          this.mStatusFeedback.showStatusString(
            FeedUtils.strings.GetStringFromName(
              aSubscribeMode ? "subscribe-validating-feed" :
                               "newsblog-getNewMsgsCheck"));
        }
      }
    },

    downloaded: function(feed, aErrorCode)
    {
      FeedUtils.log.debug("downloaded: feed:errorCode - " +
                          feed.name+" : "+aErrorCode);
      if (this.mSubscribeMode && aErrorCode == FeedUtils.kNewsBlogSuccess)
      {
        // If we get here we should always have a folder by now, either in
        // feed.folder or FeedItems created the folder for us.
        updateFolderFeedUrl(feed.folder, feed.url, false);

        // Add feed just adds the feed to the subscription UI and flushes the
        // datasource.
        addFeed(feed.url, feed.name, feed.folder);

        // Nice touch: select the folder that now contains the newly subscribed
        // feed.  This is particularly nice if we just finished subscribing
        // to a feed URL that the operating system gave us.
        this.mMsgWindow.windowCommands.selectFolder(feed.folder.URI);
      }
      else if (feed.folder && aErrorCode != FeedUtils.kNewsBlogFeedIsBusy)
        // Free msgDatabase after new mail biff is set; if busy let the next
        // result do the freeing.  Otherwise new messages won't be indicated.
        feed.folder.msgDatabase = null;

      if (this.mStatusFeedback)
      {
        if (aErrorCode == FeedUtils.kNewsBlogNoNewItems)
          this.mStatusFeedback.showStatusString(
            FeedUtils.strings.GetStringFromName("newsblog-noNewArticlesForFeed"));
        else if (aErrorCode == FeedUtils.kNewsBlogInvalidFeed)
          this.mStatusFeedback.showStatusString(
            FeedUtils.strings.formatStringFromName("newsblog-feedNotValid",
                                                   [feed.url], 1));
        else if (aErrorCode == FeedUtils.kNewsBlogRequestFailure)
          this.mStatusFeedback.showStatusString(
            FeedUtils.strings.formatStringFromName("newsblog-networkError",
                                                   [feed.url], 1));
        this.mStatusFeedback.stopMeteors();
      }

      if (!--this.mNumPendingFeedDownloads)
      {
        this.mFeeds = {};
        this.mSubscribeMode = false;

        // Should we do this on a timer so the text sticks around for a little
        // while?  It doesnt look like we do it on a timer for newsgroups so
        // we'll follow that model.  Don't clear the status text if we just
        // dumped an error to the status bar!
        if (aErrorCode == FeedUtils.kNewsBlogSuccess && this.mStatusFeedback)
          this.mStatusFeedback.showStatusString("");
      }
    },

    // This gets called after the RSS parser finishes storing a feed item to
    // disk. aCurrentFeedItems is an integer corresponding to how many feed
    // items have been downloaded so far.  aMaxFeedItems is an integer
    // corresponding to the total number of feed items to download
    onFeedItemStored: function (feed, aCurrentFeedItems, aMaxFeedItems)
    {
      // We currently don't do anything here.  Eventually we may add status
      // text about the number of new feed articles received.

      if (this.mSubscribeMode && this.mStatusFeedback)
      {
        // If we are subscribing to a feed, show feed download progress.
        this.mStatusFeedback.showStatusString(
          FeedUtils.strings.formatStringFromName("subscribe-gettingFeedItems",
                                                 [aCurrentFeedItems, aMaxFeedItems], 2));
        this.onProgress(feed, aCurrentFeedItems, aMaxFeedItems);
      }
    },

    onProgress: function(feed, aProgress, aProgressMax)
    {
      if (feed.url in this.mFeeds)
        // Have we already seen this feed?
        this.mFeeds[feed.url].currentProgress = aProgress;
      else
        this.mFeeds[feed.url] = {currentProgress: aProgress,
                                 maxProgress: aProgressMax};

      this.updateProgressBar();
    },

    updateProgressBar: function()
    {
      var currentProgress = 0;
      var maxProgress = 0;
      for (let index in this.mFeeds)
      {
        currentProgress += this.mFeeds[index].currentProgress;
        maxProgress += this.mFeeds[index].maxProgress;
      }

      // If we start seeing weird "jumping" behavior where the progress bar
      // goes below a threshold then above it again, then we can factor a
      // fudge factor here based on the number of feeds that have not reported
      // yet and the avg progress we've already received for existing feeds.
      // Fortunately the progressmeter is on a timer and only updates every so
      // often.  For the most part all of our request have initial progress
      // before the UI actually picks up a progress value. 
      if (this.mStatusFeedback)
      {
        let progress = (currentProgress * 100) / maxProgress;
        this.mStatusFeedback.showProgress(progress);
      }
    }
  }
};

XPCOMUtils.defineLazyGetter(FeedUtils, "log", function() {
  return Log4Moz.getConfiguredLogger("Feeds");
});

XPCOMUtils.defineLazyGetter(FeedUtils, "strings", function() {
  return Services.strings.createBundle(
    "chrome://messenger-newsblog/locale/newsblog.properties");
});

// Whether or not to dump debugging messages to the console.
const DEBUG = false;
var debug;
if (DEBUG)
  debug = function(msg) { dump(' -- FZ -- : ' + msg + '\n'); }
else
  debug = function() {}

var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                    .getService(Components.interfaces.nsIRDFService);
var rsspref = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);

const RDF_TYPE = rdf.GetResource("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

const RSS_NS = "http://purl.org/rss/1.0/";
const RSS_CHANNEL = rdf.GetResource(RSS_NS + "channel");
const RSS_TITLE = rdf.GetResource(RSS_NS + "title");
const RSS_DESCRIPTION = rdf.GetResource(RSS_NS + "description");
const RSS_ITEMS = rdf.GetResource(RSS_NS + "items");
const RSS_ITEM = rdf.GetResource(RSS_NS + "item");
const RSS_LINK = rdf.GetResource(RSS_NS + "link");

const RSS_CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";
const RSS_CONTENT_ENCODED = rdf.GetResource(RSS_CONTENT_NS + "encoded");

const DC_NS = "http://purl.org/dc/elements/1.1/";
const DC_CREATOR = rdf.GetResource(DC_NS + "creator");
const DC_SUBJECT = rdf.GetResource(DC_NS + "subject");
const DC_DATE = rdf.GetResource(DC_NS + "date");
const DC_TITLE = rdf.GetResource(DC_NS + "title");
const DC_LASTMODIFIED = rdf.GetResource(DC_NS + "lastModified");
const DC_IDENTIFIER = rdf.GetResource(DC_NS + "identifier");

const FZ_NS = "urn:forumzilla:";
const FZ_ITEM_NS = "urn:feeditem:";
const FZ_ROOT = rdf.GetResource(FZ_NS + "root");
const FZ_FEEDS = rdf.GetResource(FZ_NS + "feeds");
const FZ_FEED = rdf.GetResource(FZ_NS + "feed");
const FZ_QUICKMODE = rdf.GetResource(FZ_NS + "quickMode");
const FZ_DESTFOLDER = rdf.GetResource(FZ_NS + "destFolder");
const FZ_STORED = rdf.GetResource(FZ_NS + "stored");
const FZ_VALID = rdf.GetResource(FZ_NS + "valid");
const FZ_LAST_SEEN_TIMESTAMP = rdf.GetResource(FZ_NS + "last-seen-timestamp");

const RDF_LITERAL_TRUE = rdf.GetLiteral("true");
const RDF_LITERAL_FALSE = rdf.GetLiteral("false");

// Atom constants
const ATOM_03_NS = "http://purl.org/atom/ns#";
const ATOM_IETF_NS = "http://www.w3.org/2005/Atom";

// The approximate amount of time, specified in milliseconds, to leave an item in the
// RDF cache after the item has dissappeared from feeds.
// The delay is currently one day.
const INVALID_ITEM_PURGE_DELAY = 24 * 60 * 60 * 1000;

// The delimiter used to delimit feed urls in the folder's "feedUrl" property.
const kFeedUrlDelimiter = "|";

// XXX There's a containerutils in forumzilla.js that this should be merged with.
var containerUtils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                               .getService(Components.interfaces.nsIRDFContainerUtils);

var fileHandler = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService)
                            .getProtocolHandler("file")
                            .QueryInterface(Components.interfaces.nsIFileProtocolHandler);

// Helper routine that checks our subscriptions list array and returns
// true if the url is already in our list. This is used to prevent the
// user from subscribing to the same feed multiple times for the same server...
function feedAlreadyExists(aUrl, aServer)
{
  var ds = getSubscriptionsDS(aServer);
  var feeds = getSubscriptionsList(aServer, ds);
  return feeds.IndexOf(rdf.GetResource(aUrl)) != -1;
}

function addFeed(url, title, destFolder)
{
  var ds = getSubscriptionsDS(destFolder.server);
  var feeds = getSubscriptionsList(destFolder.server, ds);

  // Generate a unique ID for the feed.
  var id = url;
  var i = 1;
  while (feeds.IndexOf(rdf.GetResource(id)) != -1 && ++i < 1000)
    id = url + i;
  if (id == 1000)
    throw("couldn't generate a unique ID for feed " + url);

  // Add the feed to the list.
  id = rdf.GetResource(id);
  feeds.AppendElement(id);
  ds.Assert(id, RDF_TYPE, FZ_FEED, true);
  ds.Assert(id, DC_IDENTIFIER, rdf.GetLiteral(url), true);
  if (title)
    ds.Assert(id, DC_TITLE, rdf.GetLiteral(title), true);
  ds.Assert(id, FZ_DESTFOLDER, destFolder, true);
  ds = ds.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  ds.Flush();
}

function deleteFeed(aId, aServer, aParentFolder)
{
  let feed = new Feed(aId, aServer);
  let ds = getSubscriptionsDS(aServer);

  if (feed && ds)
  {
    // Remove the feed from the subscriptions ds.
    let feeds = getSubscriptionsList(aServer, ds);
    let index = feeds.IndexOf(aId);
    if (index != -1)
      feeds.RemoveElementAt(index, false);

    // Remove all assertions about the feed from the subscriptions database.
    removeAssertions(ds, aId);
    ds.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();

    // Remove all assertions about items in the feed from the items database.
    let itemds = getItemsDS(aServer);
    feed.invalidateItems();
    feed.removeInvalidItems(true);
    itemds.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();

    // Finally, make sure to remove the url from the folder's feedUrl
    // property.  The correct folder is passed in by the Subscribe dialog or
    // a folder pane folder delete.  The correct current folder cannot be
    // currently determined from the feed's destFolder in the db, as it is not
    // synced with folder pane moves.  Do this at the very end.
    let feedUrl = aId.ValueUTF8;
    updateFolderFeedUrl(aParentFolder, feedUrl, true);
  }
}

/**
 * Get the list of feed urls for a folder.  For legacy reasons, we try
 * 1) getStringProperty on the folder;
 * 2) getCharProperty on the folder's msgDatabase.dBFolderInfo;
 * 3) directly from the feeds.rdf subscriptions database, as identified by
 *    the destFolder tag (currently not synced on folder moves in folder pane).
 * 
 * If folder move/renames are fixed, remove msgDatabase accesses and get the
 * list directly from the feeds db.
 * 
 * @param  nsIMsgFolder - the folder.
 * @return array of urls, or null if none.
 */
function getFeedUrlsInFolder(aFolder)
{
  let feedUrlArray = [];

  let feedurls = aFolder.getStringProperty("feedUrl");
  if (feedurls)
    return feedurls.split(kFeedUrlDelimiter);

  // Go to msgDatabase for the property, make sure to handle errors.
  let msgDb;
  try {
    msgDb = aFolder.msgDatabase;
  }
  catch (ex) {}
  if (msgDb && msgDb.dBFolderInfo) {
    feedurls = msgDb.dBFolderInfo.getCharProperty("feedUrl");
    // Clean up the feedUrl string.
    feedurls.split(kFeedUrlDelimiter).forEach(
      function(url) {
        if (url && feedUrlArray.indexOf(url) == -1)
          feedUrlArray.push(url);
      });

    feedurls = feedUrlArray.join(kFeedUrlDelimiter);
    if (feedurls) {
      // Do a onetime per folder re-sync of the feeds db here based on the
      // urls in the feedUrl property.
      let ds = getSubscriptionsDS(aFolder.server);
      let resource = rdf.GetResource(aFolder.URI);
      feedUrlArray.forEach(
        function(url) {
          let id = rdf.GetResource(url);
          // Get the node for the current folder URI.
          let node = ds.GetTarget(id, FZ_DESTFOLDER, true);
          if (node)
            ds.Change(id, FZ_DESTFOLDER, node, resource);
          else
            addFeed(url, resource.name, resource);
          FeedUtils.log.debug("getFeedUrlsInFolder: sync folder:url - " +
                              aFolder.name+" : "+url);
      });
      ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();

      // Set property on folder so we don't come here ever again.
      aFolder.setStringProperty("feedUrl", feedurls);
      aFolder.msgDatabase = null;

      return feedUrlArray.length ? feedUrlArray : null;
    }
  }
  else {
    // Forcing a reparse with listener here is the last resort.  Not implemented
    // as it may be unnecessary once feedUrl is property set on folder and not
    // msgDatabase, and if eventually feedUrls are derived from the feeds db
    // directly.
  }

  // Get the list from the feeds database.
  let ds = getSubscriptionsDS(aFolder.server);
  let enumerator = ds.GetSources(FZ_DESTFOLDER, aFolder, true);
  while (enumerator.hasMoreElements())
  {
    let containerArc = enumerator.getNext();
    let uri = containerArc.QueryInterface(Components.interfaces.nsIRDFResource).Value;
    feedUrlArray.push(uri);
  }

  return feedUrlArray.length ? feedUrlArray : null;
}

/**
 * Add or remove urls from feedUrl folder property.  Property is used for
 * access to a folder's feeds in Subscribe dialog and when doing downloadFeed
 * on a folder.  Ensure no dupes.
 * 
 * @param  nsIMsgFolder - the folder.
 * @param  string       - the feed's url.
 * @param  boolean      - true if removing the url.
 */
function updateFolderFeedUrl(aFolder, aFeedUrl, aRemoveUrl)
{
  if (!aFeedUrl)
    return;

  let curFeedUrls = aFolder.getStringProperty("feedUrl");
  curFeedUrls = curFeedUrls ? curFeedUrls.split(kFeedUrlDelimiter) : [];
  let index = curFeedUrls.indexOf(aFeedUrl);

  if (aRemoveUrl)
  {
    if (index == -1)
      return;
    curFeedUrls.splice(index, 1);
  }
  else {
    if (index != -1)
      return;
    curFeedUrls.push(aFeedUrl);
  }

  let newFeedUrls = curFeedUrls.join(kFeedUrlDelimiter);
  aFolder.setStringProperty("feedUrl", newFeedUrls);
}

function getNodeValue(node)
{
  if (node && node.textContent)
    return node.textContent;
  else if (node && node.firstChild)
  {
    var ret = "";
    for (var child = node.firstChild; child; child = child.nextSibling)
    {
      var value = getNodeValue(child);
      if (value)
        ret += value;
    }

    if (ret)
      return ret;
  }

  return null;
}

function getRDFTargetValue(ds, source, property)
{
  var node = ds.GetTarget(source, property, true);
  if (node)
  {
    try{
      node = node.QueryInterface(Components.interfaces.nsIRDFLiteral);
      if (node)
        return node.Value;
    }catch(e){
      // If the RDF was bogus, do nothing. Rethrow if it's some other problem
      if (!((e instanceof Components.interfaces.nsIXPCException) &&
            (e.result==Components.results.NS_ERROR_NO_INTERFACE)))
        throw e;
    }

  }
  return null;
}

function getSubscriptionsDS(server)
{
  var file = getSubscriptionsFile(server);
  var url = fileHandler.getURLSpecFromFile(file);

  // GetDataSourceBlocking has a cache, so it's cheap to do this again
  // once we've already done it once.
  var ds = rdf.GetDataSourceBlocking(url);

  if (!ds)
    throw("can't get subscriptions data source");

  return ds;
}

function getSubscriptionsList(server, ds)
{
  var list = ds.GetTarget(FZ_ROOT, FZ_FEEDS, true);
  //list = feeds.QueryInterface(Components.interfaces.nsIRDFContainer);
  list = list.QueryInterface(Components.interfaces.nsIRDFResource);
  list = containerUtils.MakeSeq(ds, list);
  return list;
}

function getSubscriptionsFile(server)
{
  server.QueryInterface(Components.interfaces.nsIRssIncomingServer);
  var file = server.subscriptionsDataSourcePath;

  // If the file doesn't exist, create it.
  if (!file.exists())
    createSubscriptionsFile(file);

  return file;
}

// Generic get feed property, based on child value. Assumes 1 unique
// child value with 1 unique parent, valid for feeds.rdf structure.
function getParentTargetForChildResource(childResource, parentTarget, server)
{
  var ds = getSubscriptionsDS(server);
  var childRes = rdf.GetResource(childResource);
  var parent = null;

  var arcsIn = ds.ArcLabelsIn(childRes);
  while (arcsIn.hasMoreElements()){
    var arc = arcsIn.getNext();
    if (arc instanceof Components.interfaces.nsIRDFResource){
      parent = ds.GetSource(arc, childRes, true);
      parent = parent.QueryInterface(Components.interfaces.nsIRDFResource);
      break;
    }
  }

  if (parent) {
    var resource = rdf.GetResource(parent.Value);
    return ds.GetTarget(resource, parentTarget, true);
  }

  return null;
}

function createSubscriptionsFile(file)
{
  file = new LocalFile(file, MODE_WRONLY | MODE_CREATE);
  file.write('\
<?xml version="1.0"?>\n\
<RDF:RDF xmlns:dc="http://purl.org/dc/elements/1.1/"\n\
         xmlns:fz="' + FZ_NS + '"\n\
         xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n\
  <RDF:Description about="' + FZ_ROOT.Value + '">\n\
    <fz:feeds>\n\
      <RDF:Seq>\n\
      </RDF:Seq>\n\
    </fz:feeds>\n\
  </RDF:Description>\n\
</RDF:RDF>\n\
');
  file.close();
}

function getItemsDS(server)
{
  var file = getItemsFile(server);
  var url = fileHandler.getURLSpecFromFile(file);

  // GetDataSourceBlocking has a cache, so it's cheap to do this again
  // once we've already done it once.
  var ds = rdf.GetDataSourceBlocking(url);
  if (!ds)
    throw("can't get subscriptions data source");

  // Note that it this point the datasource may not be loaded yet.
  // You have to QueryInterface it to nsIRDFRemoteDataSource and check
  // its "loaded" property to be sure.  You can also attach an observer
  // which will get notified when the load is complete.
  return ds;
}

function getItemsFile(server)
{
  server.QueryInterface(Components.interfaces.nsIRssIncomingServer);
  var file = server.feedItemsDataSourcePath;

  // If the file doesn't exist, create it.
  if (!file.exists())
  {
    var newfile = new LocalFile(file, MODE_WRONLY | MODE_CREATE);
    newfile.write('\
<?xml version="1.0"?>\n\
<RDF:RDF xmlns:dc="http://purl.org/dc/elements/1.1/"\n\
         xmlns:fz="' + FZ_NS + '"\n\
         xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n\
</RDF:RDF>\n\
');
    newfile.close();
  }
  return file;
}

function removeAssertions(ds, resource)
{
  var properties = ds.ArcLabelsOut(resource);
  var property;
  while (properties.hasMoreElements())
  {
    property = properties.getNext();
    var values = ds.GetTargets(resource, property, true);
    var value;
    while (values.hasMoreElements())
    {
      value = values.getNext();
      ds.Unassert(resource, property, value, true);
    }
  }
}

// Date validator for RSS feeds
const FZ_RFC822_RE = "^(((Mon)|(Tue)|(Wed)|(Thu)|(Fri)|(Sat)|(Sun)), *)?\\d\\d?"
+ " +((Jan)|(Feb)|(Mar)|(Apr)|(May)|(Jun)|(Jul)|(Aug)|(Sep)|(Oct)|(Nov)|(Dec))"
+ " +\\d\\d(\\d\\d)? +\\d\\d:\\d\\d(:\\d\\d)? +(([+-]?\\d\\d\\d\\d)|(UT)|(GMT)"
+ "|(EST)|(EDT)|(CST)|(CDT)|(MST)|(MDT)|(PST)|(PDT)|\\w)$";

function isValidRFC822Date(pubDate)
{
  var regex = new RegExp(FZ_RFC822_RE);
  return regex.test(pubDate);
}

function dateRescue(dateString)
{
  // Deal with various kinds of invalid dates
  if(!isNaN(parseInt(dateString)))
  {
    // It's an integer, so maybe it's a timestamp
    var d = new Date(parseInt(dateString)*1000);
    var now = new Date();
    var yeardiff = now.getFullYear()-d.getFullYear();
    debug("Rescue Timestamp date: " + d.toString() + "\nYear diff:"
        + yeardiff + "\n");
    if((yeardiff >= 0) && (yeardiff<3))
    {
      // It's quite likely the correct date
      return d.toString();
    }
  }
  if(dateString.search(/^\d\d\d\d/) != -1)
    //Could be a ISO8601/W3C date
    return new Date(dateString).toUTCString();

  // Can't help. Set to current time.
  return (new Date()).toString();
}

function htmlEscape(s)
{
  s = s.replace(/&/g, "&amp;");
  s = s.replace(/>/g, "&gt;");
  s = s.replace(/</g, "&lt;");
  s = s.replace(/'/g, "&#39;");
  s = s.replace(/"/g, "&quot;");
  return s;
}

// Returns name as a URN in the 'feeditem' namespace. The
// returned URN is (or intended to be) RFC2141 compliant. 
function createURN(name)
{
  // The builtin encodeURI provides nearly the exact
  // encoding functionality required by the RFC.  The
  // exceptions are that NULL characters should not
  // appear, and that #, /, ?, &, and ~ should be
  // escaped.
  // NULL characters are removed before encoding.

  name = name.replace(/\0/g, "");

  var encoded = encodeURI(name);

  encoded = encoded.replace(/\#/g, "%23");
  encoded = encoded.replace(/\//g, "%2f");
  encoded = encoded.replace(/\?/g, "%3f");
  encoded = encoded.replace(/\&/g, "%26");
  encoded = encoded.replace(/\~/g, "%7e");

  return FZ_ITEM_NS + encoded;
}
