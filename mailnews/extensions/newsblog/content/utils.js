/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource:///modules/MailUtils.js");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var FeedUtils = {
  MOZ_PARSERERROR_NS: "http://www.mozilla.org/newlayout/xml/parsererror.xml",

  RDF_SYNTAX_NS: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDF_SYNTAX_TYPE: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  get RDF_TYPE() { return this.rdf.GetResource(this.RDF_SYNTAX_TYPE) },

  RSS_090_NS: "http://my.netscape.com/rdf/simple/0.9/",

  RSS_NS: "http://purl.org/rss/1.0/",
  get RSS_CHANNEL()     { return this.rdf.GetResource(this.RSS_NS + "channel") },
  get RSS_TITLE()       { return this.rdf.GetResource(this.RSS_NS + "title") },
  get RSS_DESCRIPTION() { return this.rdf.GetResource(this.RSS_NS + "description") },
  get RSS_ITEMS()       { return this.rdf.GetResource(this.RSS_NS + "items") },
  get RSS_ITEM()        { return this.rdf.GetResource(this.RSS_NS + "item") },
  get RSS_LINK()        { return this.rdf.GetResource(this.RSS_NS + "link") },

  RSS_CONTENT_NS: "http://purl.org/rss/1.0/modules/content/",
  get RSS_CONTENT_ENCODED() {
    return this.rdf.GetResource(this.RSS_CONTENT_NS + "encoded");
  },

  DC_NS: "http://purl.org/dc/elements/1.1/",
  get DC_CREATOR()      { return this.rdf.GetResource(this.DC_NS + "creator") },
  get DC_SUBJECT()      { return this.rdf.GetResource(this.DC_NS + "subject") },
  get DC_DATE()         { return this.rdf.GetResource(this.DC_NS + "date") },
  get DC_TITLE()        { return this.rdf.GetResource(this.DC_NS + "title") },
  get DC_LASTMODIFIED() { return this.rdf.GetResource(this.DC_NS + "lastModified") },
  get DC_IDENTIFIER()   { return this.rdf.GetResource(this.DC_NS + "identifier") },

  MRSS_NS: "http://search.yahoo.com/mrss/",

  FZ_NS: "urn:forumzilla:",
  FZ_ITEM_NS: "urn:feeditem:",
  get FZ_ROOT()       { return this.rdf.GetResource(this.FZ_NS + "root") },
  get FZ_FEEDS()      { return this.rdf.GetResource(this.FZ_NS + "feeds") },
  get FZ_FEED()       { return this.rdf.GetResource(this.FZ_NS + "feed") },
  get FZ_QUICKMODE()  { return this.rdf.GetResource(this.FZ_NS + "quickMode") },
  get FZ_DESTFOLDER() { return this.rdf.GetResource(this.FZ_NS + "destFolder") },
  get FZ_STORED()     { return this.rdf.GetResource(this.FZ_NS + "stored") },
  get FZ_VALID()      { return this.rdf.GetResource(this.FZ_NS + "valid") },
  get FZ_LAST_SEEN_TIMESTAMP() {
    return this.rdf.GetResource(this.FZ_NS + "last-seen-timestamp");
  },

  get RDF_LITERAL_TRUE()  { return this.rdf.GetLiteral("true") },
  get RDF_LITERAL_FALSE() { return this.rdf.GetLiteral("false") },

  // Atom constants
  ATOM_03_NS: "http://purl.org/atom/ns#",
  ATOM_IETF_NS: "http://www.w3.org/2005/Atom",
  ATOM_THREAD_NS: "http://purl.org/syndication/thread/1.0",

  // The approximate amount of time, specified in milliseconds, to leave an
  // item in the RDF cache after the item has dissappeared from feeds.
  // The delay is currently one day.
  INVALID_ITEM_PURGE_DELAY: 24 * 60 * 60 * 1000,

  // The delimiter used to delimit feed urls in the folder's "feedUrl" property.
  kFeedUrlDelimiter: "|",
  kBiffMinutesDefault: 100,
  kNewsBlogSuccess: 0,
  // Usually means there was an error trying to parse the feed.
  kNewsBlogInvalidFeed: 1,
  // Generic networking failure when trying to download the feed.
  kNewsBlogRequestFailure: 2,
  kNewsBlogFeedIsBusy: 3,
  // There are no new articles for this feed
  kNewsBlogNoNewItems: 4,
  kNewsBlogCancel: 5,

  CANCEL_REQUESTED: false,

/**
 * Get all rss account servers rootFolders.
 * 
 * @return array of nsIMsgIncomingServer (empty array if none).
 */
  getAllRssServerRootFolders: function() {
    let rssRootFolders = [];
    let allServers = MailServices.accounts.allServers;
    for (let i = 0; i < allServers.length; i++)
    {
      let server = allServers.queryElementAt(i, Ci.nsIMsgIncomingServer);
      if (server && server.type == "rss")
        rssRootFolders.push(server.rootFolder);
    }

    // By default, Tb sorts by hostname, ie Feeds, Feeds-1, and not by alpha
    // prettyName.  Do the same as a stock install to match folderpane order.
    rssRootFolders.sort(function(a, b) { return a.hostname > b.hostname });

    return rssRootFolders;
  },

/**
 * Create rss account.
 * 
 * @param  string [aName] - optional account name to override default.
 * @return nsIMsgAccount.
 */
  createRssAccount: function(aName) {
    let userName = "nobody";
    let hostName = "Feeds";
    let hostNamePref = hostName;
    let server;
    let serverType = "rss";
    let defaultName = FeedUtils.strings.GetStringFromName("feeds-accountname");
    let i = 2;
    while (MailServices.accounts.findRealServer(userName, hostName, serverType, 0))
      // If "Feeds" exists, try "Feeds-2", then "Feeds-3", etc.
      hostName = hostNamePref + "-" + i++;

    server = MailServices.accounts.createIncomingServer(userName, hostName, serverType);
    server.biffMinutes = FeedUtils.kBiffMinutesDefault;
    server.prettyName = aName ? aName : defaultName;
    server.valid = true;
    let account = MailServices.accounts.createAccount();
    account.incomingServer = server;

    // Ensure the Trash folder db (.msf) is created otherwise folder/message
    // deletes will throw until restart creates it.
    server.msgStore.discoverSubFolders(server.rootMsgFolder, false);

    // Create "Local Folders" if none exist yet as it's guaranteed that
    // those exist when any account exists.
    let localFolders;
    try {
      localFolders = MailServices.accounts.localFoldersServer;
    }
    catch (ex) {}

    if (!localFolders)
      MailServices.accounts.createLocalMailAccount();

    // Save new accounts in case of a crash.
    try {
      MailServices.accounts.saveAccountInfo();
    }
    catch (ex) {
      this.log.error("FeedUtils.createRssAccount: error on saveAccountInfo - " + ex);
    }

    this.log.debug("FeedUtils.createRssAccount: " +
                   account.incomingServer.rootFolder.prettyName);

    return account;
  },

/**
 * Helper routine that checks our subscriptions list array and returns
 * true if the url is already in our list.  This is used to prevent the
 * user from subscribing to the same feed multiple times for the same server.
 * 
 * @param  string aUrl                  - the url.
 * @param  nsIMsgIncomingServer aServer - account server.
 * @return boolean                      - true if exists else false.
 */
  feedAlreadyExists: function(aUrl, aServer) {
    let ds = this.getSubscriptionsDS(aServer);
    let feeds = this.getSubscriptionsList(ds);
    return feeds.IndexOf(this.rdf.GetResource(aUrl)) != -1;
  },

/**
 * Add a feed record to the feeds.rdf database.
 * 
 * @param  string aUrl              - feed url.
 * @param  string aTitle            - feed title.
 * @param  nsIMsgFolder aDestFolder - owning folder.
 */
  addFeed: function(aUrl, aTitle, aDestFolder) {
    let ds = this.getSubscriptionsDS(aDestFolder.server);
    let feeds = this.getSubscriptionsList(ds);

    // Generate a unique ID for the feed.
    let id = aUrl;
    let i = 1;
    while (feeds.IndexOf(this.rdf.GetResource(id)) != -1 && ++i < 1000)
      id = aUrl + i;
    if (id == 1000)
      throw new Error("FeedUtils.addFeed: couldn't generate a unique ID " +
                      "for feed " + aUrl);

    // Add the feed to the list.
    id = this.rdf.GetResource(id);
    feeds.AppendElement(id);
    ds.Assert(id, this.RDF_TYPE, this.FZ_FEED, true);
    ds.Assert(id, this.DC_IDENTIFIER, this.rdf.GetLiteral(aUrl), true);
    if (aTitle)
      ds.Assert(id, this.DC_TITLE, this.rdf.GetLiteral(aTitle), true);
    ds.Assert(id, this.FZ_DESTFOLDER, aDestFolder, true);
    ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();
  },

/**
 * Delete a feed record from the feeds.rdf database.
 * 
 * @param  nsIRDFResource aId           - feed url as rdf resource.
 * @param  nsIMsgIncomingServer aServer - folder's account server.
 * @param  nsIMsgFolder aParentFolder   - owning folder.
 */
  deleteFeed: function(aId, aServer, aParentFolder) {
    let feed = new Feed(aId, aServer);
    let ds = this.getSubscriptionsDS(aServer);

    if (feed && ds)
    {
      // Remove the feed from the subscriptions ds.
      let feeds = this.getSubscriptionsList(ds);
      let index = feeds.IndexOf(aId);
      if (index != -1)
        feeds.RemoveElementAt(index, false);

      // Remove all assertions about the feed from the subscriptions database.
      this.removeAssertions(ds, aId);
      ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();

      // Remove all assertions about items in the feed from the items database.
      let itemds = this.getItemsDS(aServer);
      feed.invalidateItems();
      feed.removeInvalidItems(true);
      itemds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();
  
      // Finally, make sure to remove the url from the folder's feedUrl
      // property.  The correct folder is passed in by the Subscribe dialog or
      // a folder pane folder delete.  The correct current folder cannot be
      // currently determined from the feed's destFolder in the db, as it is not
      // synced with folder pane moves.  Do this at the very end.
      let feedUrl = aId.ValueUTF8;
      this.updateFolderFeedUrl(aParentFolder, feedUrl, true);
    }
  },

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
  getFeedUrlsInFolder: function(aFolder) {
    if (aFolder.isServer || aFolder.getFlag(Ci.nsMsgFolderFlags.Trash))
      // There are never any feedUrls in the account folder or trash folder.
      return null;

    let feedUrlArray = [];

    let feedurls = aFolder.getStringProperty("feedUrl");
    if (feedurls)
      return this.splitFeedUrls(feedurls);

    // Go to msgDatabase for the property, make sure to handle errors.
    // NOTE: the rest of the following code is a migration of the feedUrl
    // property for pre Tb15 subscriptions.  At some point it can/should be
    // removed.
    let msgDb;
    try {
      msgDb = aFolder.msgDatabase;
    }
    catch (ex) {}
    if (msgDb && msgDb.dBFolderInfo) {
      // Clean up the feedUrl string.
      feedurls = this.splitFeedUrls(msgDb.dBFolderInfo.getCharProperty("feedUrl"));
      feedurls.forEach(
        function(url) {
          if (url && feedUrlArray.indexOf(url) == -1)
            feedUrlArray.push(url);
        });

      feedurls = feedUrlArray.join(this.kFeedUrlDelimiter);
      if (feedurls) {
        // Do a onetime per folder re-sync of the feeds db here based on the
        // urls in the feedUrl property.
        let ds = this.getSubscriptionsDS(aFolder.server);
        let resource = this.rdf.GetResource(aFolder.URI);
        feedUrlArray.forEach(
          function(url) {
            try {
              let id = this.rdf.GetResource(url);
              // Get the node for the current folder URI.
              let node = ds.GetTarget(id, this.FZ_DESTFOLDER, true);
              if (node)
              {
                ds.Change(id, this.FZ_DESTFOLDER, node, resource);
                this.log.debug("getFeedUrlsInFolder: sync update folder:url - " +
                               aFolder.filePath.path + " : " + url);
              }
              else
              {
                this.addFeed(url, null, aFolder);
                this.log.debug("getFeedUrlsInFolder: sync add folder:url - " +
                               aFolder.filePath.path + " : " + url);
              }
            }
            catch (ex) {
              this.log.debug("getFeedUrlsInFolder: error - " + ex);
              this.log.debug("getFeedUrlsInFolder: sync failed for folder:url - " +
                             aFolder.filePath.path + " : " + url);
            }
        }, this);
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
    try {
      let ds = this.getSubscriptionsDS(aFolder.server);
      let enumerator = ds.GetSources(this.FZ_DESTFOLDER, aFolder, true);
      while (enumerator.hasMoreElements())
      {
        let containerArc = enumerator.getNext();
        let uri = containerArc.QueryInterface(Ci.nsIRDFResource).Value;
        feedUrlArray.push(uri);
      }
    }
    catch(ex)
    {
      this.log.debug("getFeedUrlsInFolder: feeds db error - " + ex);
      this.log.debug("getFeedUrlsInFolder: feeds db error for folder - " +
                     aFolder.filePath.path);
    }
  
    feedurls = feedUrlArray.join(this.kFeedUrlDelimiter);
    if (feedurls)
    {
      aFolder.setStringProperty("feedUrl", feedurls);
      this.log.debug("getFeedUrlsInFolder: got urls from db, folder:feedUrl - " +
                     aFolder.filePath.path + " : " + feedurls);
    }
    else
      this.log.trace("getFeedUrlsInFolder: no urls from db, folder - " +
                     aFolder.filePath.path);
  
    return feedUrlArray.length ? feedUrlArray : null;
  },

/**
 * Add or remove urls from feedUrl folder property.  Property is used for
 * access to a folder's feeds in Subscribe dialog and when doing downloadFeed
 * on a folder.  Ensure no dupes.
 * 
 * @param  nsIMsgFolder - the folder.
 * @param  string       - the feed's url.
 * @param  boolean      - true if removing the url.
 */
  updateFolderFeedUrl: function(aFolder, aFeedUrl, aRemoveUrl) {
    if (!aFolder || !aFeedUrl)
      return;

    let curFeedUrls = this.splitFeedUrls(aFolder.getStringProperty("feedUrl"));
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

    let newFeedUrls = curFeedUrls.join(this.kFeedUrlDelimiter);
    aFolder.setStringProperty("feedUrl", newFeedUrls);
  },

/**
 * Return array of folder's feed urls.  Handle bad delimiter choice.
 *
 * @param  string aUrlString - the folder's feedUrl string property.
 * @return array             - array of urls or empty array if no property.
 */
  splitFeedUrls: function(aUrlString) {
    let urlStr = aUrlString.replace(this.kFeedUrlDelimiter + "http://",
                                    "\x01http://", "g")
                           .replace(this.kFeedUrlDelimiter + "https://",
                                    "\x01https://", "g")
                           .replace(this.kFeedUrlDelimiter + "file://",
                                    "\x01file://", "g");
    return urlStr.split("\x01");
  },

  getSubscriptionsDS: function(aServer) {
    let file = this.getSubscriptionsFile(aServer);
    let url = Services.io.getProtocolHandler("file").
                          QueryInterface(Ci.nsIFileProtocolHandler).
                          getURLSpecFromFile(file);

    // GetDataSourceBlocking has a cache, so it's cheap to do this again
    // once we've already done it once.
    let ds = this.rdf.GetDataSourceBlocking(url);

    if (!ds)
      throw new Error("FeedUtils.getSubscriptionsDS: can't get feed " +
                      "subscriptions data source - " + url);

    return ds;
  },

  getSubscriptionsList: function(aDataSource) {
    let list = aDataSource.GetTarget(this.FZ_ROOT, this.FZ_FEEDS, true);
    list = list.QueryInterface(Ci.nsIRDFResource);
    list = this.rdfContainerUtils.MakeSeq(aDataSource, list);
    return list;
  },

  getSubscriptionsFile: function(aServer) {
    aServer.QueryInterface(Ci.nsIRssIncomingServer);
    let file = aServer.subscriptionsDataSourcePath;

    // If the file doesn't exist, create it.
    if (!file.exists())
      this.createFile(file, this.FEEDS_TEMPLATE);

    return file;
  },

  FEEDS_TEMPLATE: '<?xml version="1.0"?>\n' +
    '<RDF:RDF xmlns:dc="http://purl.org/dc/elements/1.1/"\n' +
    '         xmlns:fz="urn:forumzilla:"\n' +
    '         xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    '  <RDF:Description about="urn:forumzilla:root">\n' +
    '    <fz:feeds>\n' +
    '      <RDF:Seq>\n' +
    '      </RDF:Seq>\n' +
    '    </fz:feeds>\n' +
    '  </RDF:Description>\n' +
    '</RDF:RDF>\n',

  getItemsDS: function(aServer) {
    let file = this.getItemsFile(aServer);
    let url = Services.io.getProtocolHandler("file").
                          QueryInterface(Ci.nsIFileProtocolHandler).
                          getURLSpecFromFile(file);

    // GetDataSourceBlocking has a cache, so it's cheap to do this again
    // once we've already done it once.
    let ds = this.rdf.GetDataSourceBlocking(url);
    if (!ds)
      throw new Error("FeedUtils.getItemsDS: can't get feed items " +
                      "data source - " + url);

    // Note that it this point the datasource may not be loaded yet.
    // You have to QueryInterface it to nsIRDFRemoteDataSource and check
    // its "loaded" property to be sure.  You can also attach an observer
    // which will get notified when the load is complete.
    return ds;
  },

  getItemsFile: function(aServer) {
    aServer.QueryInterface(Ci.nsIRssIncomingServer);
    let file = aServer.feedItemsDataSourcePath;

    // If the file doesn't exist, create it.
    if (!file.exists())
      this.createFile(file, this.FEEDITEMS_TEMPLATE);

    return file;
  },

  FEEDITEMS_TEMPLATE: '<?xml version="1.0"?>\n' +
    '<RDF:RDF xmlns:dc="http://purl.org/dc/elements/1.1/"\n' +
    '         xmlns:fz="urn:forumzilla:"\n' +
    '         xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    '</RDF:RDF>\n',

  createFile: function(aFile, aTemplate) {
    let fos = FileUtils.openSafeFileOutputStream(aFile);
    fos.write(aTemplate, aTemplate.length);
    FileUtils.closeSafeFileOutputStream(fos);
  },

  getParentTargetForChildResource: function(aChildResource, aParentTarget,
                                            aServer) {
    // Generic get feed property, based on child value. Assumes 1 unique
    // child value with 1 unique parent, valid for feeds.rdf structure.
    let ds = this.getSubscriptionsDS(aServer);
    let childRes = this.rdf.GetResource(aChildResource);
    let parent = null;

    let arcsIn = ds.ArcLabelsIn(childRes);
    while (arcsIn.hasMoreElements())
    {
      let arc = arcsIn.getNext();
      if (arc instanceof Ci.nsIRDFResource)
      {
        parent = ds.GetSource(arc, childRes, true);
        parent = parent.QueryInterface(Ci.nsIRDFResource);
        break;
      }
    }

    if (parent)
    {
      let resource = this.rdf.GetResource(parent.Value);
      return ds.GetTarget(resource, aParentTarget, true);
    }

    return null;
  },

  removeAssertions: function(aDataSource, aResource) {
    let properties = aDataSource.ArcLabelsOut(aResource);
    let property;
    while (properties.hasMoreElements())
    {
      property = properties.getNext();
      let values = aDataSource.GetTargets(aResource, property, true);
      let value;
      while (values.hasMoreElements())
      {
        value = values.getNext();
        aDataSource.Unassert(aResource, property, value, true);
      }
    }
  },

/**
 * Dragging something from somewhere.  It may be a nice x-moz-url or from a
 * browser or app that provides a less nice dataTransfer object in the event.
 * Extract the url and if it passes the scheme test, try to subscribe.
 * 
 * @param  nsIDOMDataTransfer aDataTransfer  - the dnd event's dataTransfer.
 * @return nsIURI uri                        - a uri if valid, null if none.
 */
  getFeedUriFromDataTransfer: function(aDataTransfer) {
    let dt = aDataTransfer;
    let types = ["text/x-moz-url-data", "text/x-moz-url"];
    let validUri = false;
    let uri = Cc["@mozilla.org/network/standard-url;1"].
              createInstance(Ci.nsIURI);

    if (dt.getData(types[0]))
    {
      // The url is the data.
      uri.spec = dt.mozGetDataAt(types[0], 0);
      validUri = this.isValidScheme(uri);
      this.log.trace("getFeedUriFromDataTransfer: dropEffect:type:value - " +
                     dt.dropEffect + " : " + types[0] + " : " + uri.spec);
    }
    else if (dt.getData(types[1]))
    {
      // The url is the first part of the data, the second part is random.
      uri.spec = dt.mozGetDataAt(types[1], 0).split("\n")[0];
      validUri = this.isValidScheme(uri);
      this.log.trace("getFeedUriFromDataTransfer: dropEffect:type:value - " +
                     dt.dropEffect + " : " + types[0] + " : " + uri.spec);
    }
    else
    {
      // Go through the types and see if there's a url; get the first one.
      for (let i = 0; i < dt.types.length; i++) {
        let spec = dt.mozGetDataAt(dt.types[i], 0);
        this.log.trace("getFeedUriFromDataTransfer: dropEffect:index:type:value - " +
                       dt.dropEffect + " : " + i + " : " + dt.types[i] + " : "+spec);
        try {
          uri.spec = spec;
          validUri = this.isValidScheme(uri);
        }
        catch(ex) {}

        if (validUri)
          break;
      };
    }

    return validUri ? uri : null;
  },

/**
 * Returns if a uri is valid to subscribe.
 * 
 * @param  nsIURI aUri  - the Uri.
 * @return boolean      - true if a valid scheme, false if not.
 */
  isValidScheme: function(aUri) {
    return (aUri instanceof Ci.nsIURI) &&
           (aUri.schemeIs("http") || aUri.schemeIs("https"));
  },

/**
 * Is a folder Trash or in Trash.
 * 
 * @param  nsIMsgFolder aFolder   - the folder.
 * @return boolean                - true if folder is Trash else false.
 */
  isInTrash: function(aFolder) {
    let trashFolder =
        aFolder.rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);
    if (trashFolder &&
        (trashFolder == aFolder || trashFolder.isAncestorOf(aFolder)))
      return true;
    return false;
  },

/**
 * Return a folder path string constructed from individual folder UTF8 names
 * stored as properties (not possible hashes used to construct disk foldername).
 * 
 * @param  nsIMsgFolder aFolder     - the folder.
 * @return string prettyName | null - name or null if not a disk folder.
 */
  getFolderPrettyPath: function(aFolder) {
    let msgFolder = MailUtils.getFolderForURI(aFolder.URI, true);
    if (!msgFolder)
      // Not a real folder uri.
      return null;

    if (msgFolder.URI == msgFolder.server.serverURI)
      return msgFolder.server.prettyName;

    // Server part first.
    let pathParts = [msgFolder.server.prettyName];
    let rawPathParts = msgFolder.URI.split(msgFolder.server.serverURI + "/");
    let folderURI = msgFolder.server.serverURI;
    rawPathParts = rawPathParts[1].split("/");
    for (let i = 0; i < rawPathParts.length - 1; i++)
    {
      // Two or more folders deep parts here.
      folderURI += "/" + rawPathParts[i];
      msgFolder = MailUtils.getFolderForURI(folderURI, true);
      pathParts.push(msgFolder.name);
    }

    // Leaf folder last.
    pathParts.push(aFolder.name);
    return pathParts.join("/");
  },

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
      let location = feed.folder ? feed.folder.filePath.path : "";
      FeedUtils.log.debug("downloaded: "+
                          (this.mSubscribeMode ? "Subscribe " : "Update ") +
                          "errorCode:feedName:folder - " +
                          aErrorCode + " : " + feed.name + " : " + location);
      if (this.mSubscribeMode)
      {
        if (aErrorCode == FeedUtils.kNewsBlogSuccess)
        {
          // If we get here we should always have a folder by now, either in
          // feed.folder or FeedItems created the folder for us.
          FeedUtils.updateFolderFeedUrl(feed.folder, feed.url, false);

          // Add feed just adds the feed to the subscription UI and flushes the
          // datasource.
          FeedUtils.addFeed(feed.url, feed.name, feed.folder);

          // Nice touch: select the folder that now contains the newly subscribed
          // feed.  This is particularly nice if we just finished subscribing
          // to a feed URL that the operating system gave us.
          this.mMsgWindow.windowCommands.selectFolder(feed.folder.URI);

          // Check for an existing feed subscriptions window and update it.
          let subscriptionsWindow =
              Services.wm.getMostRecentWindow("Mail:News-BlogSubscriptions");
          if (subscriptionsWindow)
            subscriptionsWindow.FeedSubscriptions.
                                FolderListener.folderAdded(feed.folder);
        }
        else
        {
          // Non success.  Remove intermediate traces from the feeds database.
          if (feed && feed.url && feed.server)
            FeedUtils.deleteFeed(FeedUtils.rdf.GetResource(feed.url),
                                 feed.server,
                                 feed.server.rootFolder);
        }
      }

      if (feed.folder && aErrorCode != FeedUtils.kNewsBlogFeedIsBusy)
        // Free msgDatabase after new mail biff is set; if busy let the next
        // result do the freeing.  Otherwise new messages won't be indicated.
        feed.folder.msgDatabase = null;

      let message = "";
      if (feed.folder)
        location = FeedUtils.getFolderPrettyPath(feed.folder) + " -> ";
      switch (aErrorCode) {
        case FeedUtils.kNewsBlogSuccess:
        case FeedUtils.kNewsBlogFeedIsBusy:
          message = "";
          break;
        case FeedUtils.kNewsBlogNoNewItems:
          message = feed.url+". " +
                    FeedUtils.strings.GetStringFromName(
                      "newsblog-noNewArticlesForFeed");
          break;
        case FeedUtils.kNewsBlogInvalidFeed:
          message = FeedUtils.strings.formatStringFromName(
                      "newsblog-feedNotValid", [feed.url], 1);
          break;
        case FeedUtils.kNewsBlogRequestFailure:
          message = FeedUtils.strings.formatStringFromName(
                      "newsblog-networkError", [feed.url], 1);
          break;
      }
      if (message)
        FeedUtils.log.info("downloaded: " +
                           (this.mSubscribeMode ? "Subscribe: " : "Update: ") +
                           location + message);

      if (this.mStatusFeedback)
      {
        this.mStatusFeedback.showStatusString(message);
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

    onProgress: function(feed, aProgress, aProgressMax, aLengthComputable)
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
      let currentProgress = 0;
      let maxProgress = 0;
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

XPCOMUtils.defineLazyGetter(FeedUtils, "rdf", function() {
  return Cc["@mozilla.org/rdf/rdf-service;1"].
         getService(Ci.nsIRDFService);
});

XPCOMUtils.defineLazyGetter(FeedUtils, "rdfContainerUtils", function() {
  return Cc["@mozilla.org/rdf/container-utils;1"].
         getService(Ci.nsIRDFContainerUtils);
});
