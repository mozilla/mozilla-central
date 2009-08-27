/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is the Feed Stream Converter.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <beng@google.com>
 *   Jeff Walden <jwalden+code@mit.edu>
 *   Will Guaraldi <will.guaraldi@pculture.org>
 *   Caio Tiago Oliveira <asrail@gmail.com>
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
Components.utils.import("resource://gre/modules/debug.js");

const TYPE_MAYBE_FEED = "application/vnd.mozilla.maybe.feed";
const TYPE_MAYBE_VIDEO_FEED = "application/vnd.mozilla.maybe.video.feed";
const TYPE_MAYBE_AUDIO_FEED = "application/vnd.mozilla.maybe.audio.feed";
const TYPE_ANY = "*/*";

const FEEDHANDLER_URI = "about:feeds";

const PREF_SELECTED_APP = "browser.feeds.handlers.application";
const PREF_SELECTED_WEB = "browser.feeds.handlers.webservice";
const PREF_SELECTED_ACTION = "browser.feeds.handler";
const PREF_SELECTED_READER = "browser.feeds.handler.default";

const PREF_VIDEO_SELECTED_APP = "browser.videoFeeds.handlers.application";
const PREF_VIDEO_SELECTED_WEB = "browser.videoFeeds.handlers.webservice";
const PREF_VIDEO_SELECTED_ACTION = "browser.videoFeeds.handler";
const PREF_VIDEO_SELECTED_READER = "browser.videoFeeds.handler.default";

const PREF_AUDIO_SELECTED_APP = "browser.audioFeeds.handlers.application";
const PREF_AUDIO_SELECTED_WEB = "browser.audioFeeds.handlers.webservice";
const PREF_AUDIO_SELECTED_ACTION = "browser.audioFeeds.handler";
const PREF_AUDIO_SELECTED_READER = "browser.audioFeeds.handler.default";

function getPrefAppForType(t) {
  switch (t) {
    case Components.interfaces.nsIFeed.TYPE_VIDEO:
      return PREF_VIDEO_SELECTED_APP;

    case Components.interfaces.nsIFeed.TYPE_AUDIO:
      return PREF_AUDIO_SELECTED_APP;

    default:
      return PREF_SELECTED_APP;
  }
}

function getPrefWebForType(t) {
  switch (t) {
    case Components.interfaces.nsIFeed.TYPE_VIDEO:
      return PREF_VIDEO_SELECTED_WEB;

    case Components.interfaces.nsIFeed.TYPE_AUDIO:
      return PREF_AUDIO_SELECTED_WEB;

    default:
      return PREF_SELECTED_WEB;
  }
}

function getPrefActionForType(t) {
  switch (t) {
    case Components.interfaces.nsIFeed.TYPE_VIDEO:
      return PREF_VIDEO_SELECTED_ACTION;

    case Components.interfaces.nsIFeed.TYPE_AUDIO:
      return PREF_AUDIO_SELECTED_ACTION;

    default:
      return PREF_SELECTED_ACTION;
  }
}

function getPrefReaderForType(t) {
  switch (t) {
    case Components.interfaces.nsIFeed.TYPE_VIDEO:
      return PREF_VIDEO_SELECTED_READER;

    case Components.interfaces.nsIFeed.TYPE_AUDIO:
      return PREF_AUDIO_SELECTED_READER;

    default:
      return PREF_SELECTED_READER;
  }
}

function LOG(str) {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);

  try {
    if (prefs.getBoolPref("feeds.log"))
      dump("*** Feeds: " + str + "\n");
  }
  catch (ex) {
  }
}

function safeGetCharPref(pref, defaultValue) {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
  try {
    return prefs.getCharPref(pref);
  }
  catch (e) {
  }
  return defaultValue;
}

function FeedConverter() {
  this._ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
}

FeedConverter.prototype = {
  /**
   * This is the downloaded text data for the feed.
   */
  _data: null,

  /**
   * This is the object listening to the conversion, which is ultimately the
   * docshell for the load.
   */
  _listener: null,

  /**
   * Records if the feed was sniffed
   */
  _sniffed: false,

  /**
   * See nsISupports.idl
   */
  QueryInterface: XPCOMUtils.generateQI(
    [Components.interfaces.nsIFeedResultListener,
     Components.interfaces.nsIStreamConverter,
     Components.interfaces.nsIStreamListener,
     Components.interfaces.nsIRequestObserver,
     Components.interfaces.nsISupports]),
  classDescription: "Feed Stream Converter",
  classID: Components.ID("{88592F45-3866-4c8e-9D8A-AB58B290FCF7}"),
  implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,

  /**
   * See nsIStreamConverter.idl
   */
  convert: function convert(sourceStream, sourceType, destinationType,
                               context) {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  /**
   * See nsIStreamConverter.idl
   */
  asyncConvertData: function asyncConvertData(sourceType, destinationType,
                                               listener, context) {
    this._listener = listener;
  },

  /**
   * Whether or not the preview page is being forced.
   */
  _forcePreviewPage: false,

  /**
   * Release our references to various things once we're done using them.
   */
  _releaseHandles: function _releaseHandles() {
    this._listener = null;
    this._request = null;
    this._processor = null;
  },

  /**
   * See nsIFeedResultListener.idl
   */
  handleResult: function handleResult(result) {
    // Feeds come in various content types, which our feed sniffer coerces to
    // the maybe.feed type. However, feeds are used as a transport for
    // different data types, e.g. news/blogs (traditional feed), video/audio
    // (podcasts) and photos (photocasts, photostreams). Each of these is
    // different in that there's a different class of application suitable for
    // handling feeds of that type, but without a content-type differentiation
    // it is difficult for us to disambiguate.
    //
    // The other problem is that if the user specifies an auto-action handler
    // for one feed application, the fact that the content type is shared means
    // that all other applications will auto-load with that handler too,
    // regardless of the content-type.
    //
    // This means that content-type alone is not enough to determine whether
    // or not a feed should be auto-handled. Therefore for feeds we need
    // to always use this stream converter, even when an auto-action is
    // specified, not the basic one provided by WebContentConverter. This
    // converter needs to consume all of the data and parse it, and based on
    // that determination make a judgement about type.
    //
    // Since there are no content types for this content, and I'm not going to
    // invent any, the upshot is that while a user can set an auto-handler for
    // generic feed content, the system will prevent them from setting an auto-
    // handler for other stream types. In those cases, the user will always see
    // the preview page and have to select a handler. We can guess and show
    // a client handler, but will not be able to show web handlers for those
    // types.
    //
    // If this is just a feed, not some kind of specialized application, then
    // auto-handlers can be set and we should obey them.
    try {
      var feedService = Components.classes["@mozilla.org/browser/feeds/result-service;1"]
                                  .getService(Components.interfaces.nsIFeedResultService);
      if (!this._forcePreviewPage && result.doc) {
        var feed = result.doc.QueryInterface(Components.interfaces.nsIFeed);
        var handler = safeGetCharPref(getPrefActionForType(feed.type), "ask");

        if (handler != "ask") {
          if (handler == "reader")
            handler = safeGetCharPref(getPrefReaderForType(feed.type), "messenger");
          switch (handler) {
            case "web":
              var wccr = Components.classes["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"]
                                   .getService(Components.interfaces.nsIWebContentConverterService);
              if ((feed.type == Components.interfaces.nsIFeed.TYPE_FEED &&
                   wccr.getAutoHandler(TYPE_MAYBE_FEED)) ||
                  (feed.type == Components.interfaces.nsIFeed.TYPE_VIDEO &&
                   wccr.getAutoHandler(TYPE_MAYBE_VIDEO_FEED)) ||
                  (feed.type == Components.interfaces.nsIFeed.TYPE_AUDIO &&
                   wccr.getAutoHandler(TYPE_MAYBE_AUDIO_FEED))) {
                wccr.loadPreferredHandler(this._request);
                return;
              }
              break;

            default:
              LOG("unexpected handler: " + handler);
              // fall through -- let feed service handle error
            case "bookmarks":
            case "client":
            case "messenger":
              try {
                var title = feed.title ? feed.title.plainText() : "";
                var desc = feed.subtitle ? feed.subtitle.plainText() : "";
                feedService.addToClientReader(result.uri.spec, title, desc, feed.type);
                return;
              } catch(ex) {
                /* fallback to preview mode */
              }
          }
        }
      }

      var chromeChannel;

      // show the feed page if it wasn't sniffed and we have a document,
      // or we have a document, title, and link or id
      if (result.doc && (!this._sniffed ||
          (result.doc.title && (result.doc.link || result.doc.id)))) {

        // If there was no automatic handler, or this was a podcast,
        // photostream or some other kind of application, we must always
        // show the preview page.

        // Store the result in the result service so that the display
        // page can access it.

        feedService.addFeedResult(result);

        // Now load the actual XUL document.
        var chromeURI = this._ioSvc.newURI(FEEDHANDLER_URI, null, null);
        chromeChannel = this._ioSvc.newChannelFromURI(chromeURI, null);
        chromeChannel.originalURI = result.uri;
      }
      else
        chromeChannel = this._ioSvc.newChannelFromURI(result.uri, null);

      chromeChannel.loadGroup = this._request.loadGroup;
      chromeChannel.asyncOpen(this._listener, null);
    }
    finally {
      this._releaseHandles();
    }
  },

  /**
   * See nsIStreamListener.idl
   */
  onDataAvailable: function onDataAvailable(request, context, inputStream,
                                             sourceOffset, count) {
    if (this._processor)
      this._processor.onDataAvailable(request, context, inputStream,
                                      sourceOffset, count);
  },

  /**
   * See nsIRequestObserver.idl
   */
  onStartRequest: function onStartRequest(request, context) {
    var channel = request.QueryInterface(Components.interfaces.nsIChannel);

    // Check for a header that tells us there was no sniffing
    // The value doesn't matter.
    try {
      var httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
      var noSniff = httpChannel.getResponseHeader("X-Moz-Is-Feed");
    }
    catch (ex) {
      this._sniffed = true;
    }

    this._request = request;

    // Save and reset the forced state bit early, in case there's some kind of
    // error.
    var feedService = Components.classes["@mozilla.org/browser/feeds/result-service;1"]
                                .getService(Components.interfaces.nsIFeedResultService);
    this._forcePreviewPage = feedService.forcePreviewPage;
    feedService.forcePreviewPage = false;

    // Parse feed data as it comes in
    this._processor = Components.classes["@mozilla.org/feed-processor;1"]
                                .createInstance(Components.interfaces.nsIFeedProcessor);
    this._processor.listener = this;
    this._processor.parseAsync(null, channel.URI);

    this._processor.onStartRequest(request, context);
  },

  /**
   * See nsIRequestObserver.idl
   */
  onStopRequest: function onStopRequest(request, context, status) {
    if (this._processor)
      this._processor.onStopRequest(request, context, status);
  }

};

/**
 * Helper to register multiple components sharing the same prototype
 * using XPCOMUtils.
 */
function build_component(component, ctor, properties) {
  component.prototype = new ctor();
  for (let name in properties) {
    component.prototype[name] = properties[name];
  }
}

function FeedConverter_feed() {
}

build_component(FeedConverter_feed, FeedConverter,
                {contractID: "@mozilla.org/streamconv;1?from="
                             + TYPE_MAYBE_FEED + "&to="
                             + TYPE_ANY});

function FeedConverter_audio_feed() {
}

build_component(FeedConverter_audio_feed, FeedConverter,
                {contractID: "@mozilla.org/streamconv;1?from="
                             + TYPE_MAYBE_AUDIO_FEED + "&to="
                             + TYPE_ANY});

function FeedConverter_video_feed() {
}

build_component(FeedConverter_video_feed, FeedConverter,
                {contractID: "@mozilla.org/streamconv;1?from="
                             + TYPE_MAYBE_VIDEO_FEED + "&to="
                             + TYPE_ANY});

/**
 * Keeps parsed FeedResults around for use elsewhere in the UI after the stream
 * converter completes.
 */
function FeedResultService() {
  this._ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
}

FeedResultService.prototype = {
  /**
   * A URI spec -> [nsIFeedResult] hash. We have to keep a list as the
   * value in case the same URI is requested concurrently.
   */
  _results: { },

  /**
   * See nsIFeedResultService.idl
   */
  forcePreviewPage: false,

  /**
   * See nsIFeedResultService.idl
   */
  addToClientReader: function addToClientReader(spec, title, subtitle, feedType) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);

    var handler = safeGetCharPref(getPrefActionForType(feedType), "reader");
    if (handler == "ask" || handler == "reader")
      handler = safeGetCharPref(getPrefReaderForType(feedType), "messenger");

    switch (handler) {
    case "client":
      var clientApp = prefs.getComplexValue(getPrefAppForType(feedType),
                                            Components.interfaces.nsILocalFile);

      // For the benefit of applications that might know how to deal with more
      // URLs than just feeds, send feed: URLs in the following format:
      //
      // http urls: replace scheme with feed, e.g.
      // http://foo.com/index.rdf -> feed://foo.com/index.rdf
      // other urls: prepend feed: scheme, e.g.
      // https://foo.com/index.rdf -> feed:https://foo.com/index.rdf
      var feedURI = this._ioSvc.newURI(spec, null, null);
      if (feedURI.schemeIs("http")) {
        feedURI.scheme = "feed";
        spec = feedURI.spec;
      }
      else
        spec = "feed:" + spec;

      // Retrieving the shell service might fail on some systems, most
      // notably systems where GNOME is not installed.
      try {
        var ss = Components.classes["@mozilla.org/suite/shell-service;1"]
                           .getService(Components.interfaces.nsIShellService);
        ss.openApplicationWithURI(clientApp, spec);
      } catch(e) {
        // If we couldn't use the shell service, fallback to using a
        // nsIProcess instance
        var p = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
        p.init(clientApp);
        p.run(false, [spec], 1);
      }
      break;

    default:
      // "web" should have been handled elsewhere
      LOG("unexpected handler: " + handler);
      // fall through
    case "bookmarks":
    case "messenger":
      Components.classes["@mozilla.org/newsblog-feed-downloader;1"]
                .getService(Components.interfaces.nsINewsBlogFeedDownloader)
                .subscribeToFeed("feed:" + spec, null, null);
      break;

    }
  },

  /**
   * See nsIFeedResultService.idl
   */
  addFeedResult: function addFeedResult(feedResult) {
    NS_ASSERT(feedResult != null, "null feedResult!");
    NS_ASSERT(feedResult.uri != null, "null URI!");
    var spec = feedResult.uri.spec;
    if (!this._results[spec])
      this._results[spec] = [];
    this._results[spec].push(feedResult);
  },

  /**
   * See nsIFeedResultService.idl
   */
  getFeedResult: function getFeedResult(uri) {
    NS_ASSERT(uri != null, "null URI!");
    var resultList = this._results[uri.spec];
    for (let i = 0; i < resultList.length; ++i) {
      if (resultList[i].uri == uri)
        return resultList[i];
    }
    return null;
  },

  /**
   * See nsIFeedResultService.idl
   */
  removeFeedResult: function removeFeedResult(uri) {
    NS_ASSERT(uri != null, "null URI!");
    var resultList = this._results[uri.spec];
    if (!resultList)
      return;
    var deletions = 0;
    for (let i = 0; i < resultList.length; ++i) {
      if (resultList[i].uri == uri) {
        delete resultList[i];
        ++deletions;
      }
    }

    // send the holes to the end
    resultList.sort();
    // and trim the list
    resultList.splice(resultList.length - deletions, deletions);
    if (resultList.length == 0)
      delete this._results[uri.spec];
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIFeedResultService,
                                         Components.interfaces.nsISupports]),
  classID: Components.ID("{E5B05E9D-F037-48e4-B9A4-B99476582927}"),
  classDescription: "Feed Result Service",
  contractID: "@mozilla.org/browser/feeds/result-service;1",
  implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT
};

/**
 * A protocol handler that attempts to deal with the variant forms of feed:
 * URIs that are actually either http or https.
 */
function _FeedProtocolHandler() {
  this._ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
  this._http = this._ioSvc.getProtocolHandler("http");
}

_FeedProtocolHandler.prototype = {
  get protocolFlags() {
    return this._http.protocolFlags;
  },

  get defaultPort() {
    return this._http.defaultPort;
  },

  allowPort: function allowPort(port, scheme) {
    return this._http.allowPort(port, scheme);
  },

  newURI: function newURI(spec, originalCharset, baseURI) {
    // See bug 408599 - feed URIs can be either standard URLs of the form
    // feed://example.com, in which case the real protocol is http, or nested
    // URIs of the form feed:realscheme:. When realscheme is either http or
    // https, we deal with the way that creates a standard URL with the
    // realscheme as the host by unmangling in newChannel; for others, we fail
    // rather than let it wind up loading something like www.realscheme.com//foo

    const feedSlashes = "feed://";
    const feedHttpSlashes = "feed:http://";
    const feedHttpsSlashes = "feed:https://";

    if (spec.substr(0, feedSlashes.length) != feedSlashes &&
        spec.substr(0, feedHttpSlashes.length) != feedHttpSlashes &&
        spec.substr(0, feedHttpsSlashes.length) != feedHttpsSlashes)
      throw Components.results.NS_ERROR_MALFORMED_URI;

    var uri = Components.classes["@mozilla.org/network/standard-url;1"]
                        .createInstance(Components.interfaces.nsIStandardURL);
    uri.init(Components.interfaces.nsIStandardURL.URLTYPE_STANDARD, 80, spec,
             originalCharset, baseURI);
    return uri;
  },

  newChannel: function newChannel(aUri) {
    // feed: URIs either start feed://, in which case the real scheme is http:
    // or feed:http(s)://, (which by now we've changed to feed://realscheme//)
    var feedSpec = aUri.spec;
    const httpChunk = /^feed:\/\/(https?)/;
    if (httpChunk.test(feedSpec))
      feedSpec = feedSpec.replace(httpChunk, "$1:");
    else
      feedSpec = feedSpec.replace(/^feed/, "http");

    var uri = this._ioSvc.newURI(feedSpec, aUri.originCharset, null);
    var channel = this._ioSvc.newChannelFromURI(uri, null)
                       .QueryInterface(Components.interfaces.nsIHttpChannel);
    // Set this so we know this is supposed to be a feed
    channel.setRequestHeader("X-Moz-Is-Feed", "1", false);
    channel.originalURI = aUri;
    return channel;
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIProtocolHandler,
                                         Components.interfaces.nsISupports]),
  implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT
};

function FeedProtocolHandler() {
}

build_component(FeedProtocolHandler, _FeedProtocolHandler,
                {classID: Components.ID("{A95D7F48-11BE-4324-8872-D23BD79FE78B}"),
                 classDescription: "Feed Protocol Handler",
                 contractID: "@mozilla.org/network/protocol;1?name=feed",
                 scheme: "feed"
                });

function PodcastProtocolHandler() {
}

build_component(PodcastProtocolHandler, _FeedProtocolHandler,
                {classID: Components.ID("{F0FF0FE4-1713-4d34-9323-3F5DEB6A6A60}"),
                 classDescription: "Podcast Protocol Handler",
                 contractID: "@mozilla.org/network/protocol;1?name=pcast",
                 scheme: "pcast"
                });

var components = [FeedProtocolHandler, PodcastProtocolHandler, FeedResultService,
                  FeedConverter_feed, FeedConverter_audio_feed,
                  FeedConverter_video_feed];

function NSGetModule(cm, file) {
  return XPCOMUtils.generateModule(components);
}
