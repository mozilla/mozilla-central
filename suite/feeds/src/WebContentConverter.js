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
 * The Original Code is the Web Content Converter System.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <beng@google.com>
 *   Asaf Romano <mano@mozilla.com>
 *   Dan Mosedale <dmose@mozilla.org>
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

const WCCR_CONTRACTID = "@mozilla.org/embeddor.implemented/web-content-handler-registrar;1";
const WCCR_CLASSID = Components.ID("{792a7e82-06a0-437c-af63-b2d12e808acc}");
const WCCR_CLASSNAME = "Web Content Handler Registrar";

const WCC_CLASSID = Components.ID("{db7ebf28-cc40-415f-8a51-1b111851df1e}");
const WCC_CLASSNAME = "Web Service Handler";

const TYPE_MAYBE_FEED = "application/vnd.mozilla.maybe.feed";
const TYPE_ANY = "*/*";

const PREF_CONTENTHANDLERS_AUTO = "browser.contentHandlers.auto.";
const PREF_CONTENTHANDLERS_BRANCH = "browser.contentHandlers.types.";
const PREF_SELECTED_WEB = "browser.feeds.handlers.webservice";
const PREF_SELECTED_ACTION = "browser.feeds.handler";
const PREF_SELECTED_READER = "browser.feeds.handler.default";
const PREF_HANDLER_EXTERNAL_PREFIX = "network.protocol-handler.external";
const PREF_ALLOW_DIFFERENT_HOST = "gecko.handlerService.allowRegisterFromDifferentHost";

const STRING_BUNDLE_URI = "chrome://communicator/locale/feeds/subscribe.properties";

const NS_ERROR_MODULE_DOM = 0x80530000;
const NS_ERROR_DOM_SYNTAX_ERR = NS_ERROR_MODULE_DOM + 12;

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

function getNotificationBox(aWindow)
{
  return aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIWebNavigation)
                .QueryInterface(Components.interfaces.nsIDocShell)
                .chromeEventHandler.parentNode.wrappedJSObject;
}

function WebContentConverter() {
}

WebContentConverter.prototype = {
  convert: function convert() { },
  asyncConvertData: function asyncConvertData() { },
  onDataAvailable: function onDataAvailable() { },
  onStopRequest: function onStopRequest() { },

  onStartRequest: function onStartRequest(request, context) {
    var wccr = Components.classes[WCCR_CONTRACTID]
                         .getService(Components.interfaces.nsIWebContentConverterService);
    wccr.loadPreferredHandler(request);
  },

  QueryInterface: XPCOMUtils.generateQI(
    [Components.interfaces.nsIStreamConverter,
     Components.interfaces.nsIStreamListener,
     Components.interfaces.nsISupports])
};

var WebContentConverterFactory = {
  createInstance: function createInstance(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return new WebContentConverter().QueryInterface(iid);
  },

  QueryInterface: XPCOMUtils.generateQI(
    [Components.interfaces.nsIFactory,
     Components.interfaces.nsISupports])
};

function ServiceInfo(contentType, uri, name) {
  this._contentType = contentType;
  this._uri = uri;
  this._name = name;
}

ServiceInfo.prototype = {
  /**
   * See nsIHandlerApp
   */
  get name() {
    return this._name;
  },

  /**
   * See nsIHandlerApp
   */
  equals: function equals(aHandlerApp) {
    if (!aHandlerApp)
      throw Components.results.NS_ERROR_NULL_POINTER;

    if (aHandlerApp instanceof Components.interfaces.nsIWebContentHandlerInfo &&
        aHandlerApp.contentType == this.contentType &&
        aHandlerApp.uri == this.uri)
      return true;

    return false;
  },

  /**
   * See nsIWebContentHandlerInfo
   */
  get contentType() {
    return this._contentType;
  },

  /**
   * See nsIWebContentHandlerInfo
   */
  get uri() {
    return this._uri;
  },

  /**
   * See nsIWebContentHandlerInfo
   */
  getHandlerURI: function getHandlerURI(uri) {
    return this._uri.replace(/%s/gi, encodeURIComponent(uri));
  },

  QueryInterface: XPCOMUtils.generateQI(
    [Components.interfaces.nsIWebContentHandlerInfo,
     Components.interfaces.nsISupports])
};

function WebContentConverterRegistrar() {
  this._contentTypes = { };
  this._autoHandleContentTypes = { };
}

WebContentConverterRegistrar.prototype = {
  __bundle: null,
  get _bundle() {
    if (!this.__bundle) {
      this.__bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                        .getService(Components.interfaces.nsIStringBundleService)
                        .createBundle(STRING_BUNDLE_URI);
    }
    return this.__bundle;
  },

  _getFormattedString: function getFormattedString(key, params) {
    return this._bundle.formatStringFromName(key, params, params.length);
  },

  _getString: function getString(key) {
    try {
      return this._bundle.GetStringFromName(key);
    } catch(e) {
      LOG("Couldn't retrieve key from bundle");
    }

    return null;
  },

  /**
   * See nsIWebContentConverterService
   */
  getAutoHandler: function getAutoHandler(contentType) {
    contentType = this._resolveContentType(contentType);
    if (contentType in this._autoHandleContentTypes)
      return this._autoHandleContentTypes[contentType];
    return null;
  },

  /**
   * See nsIWebContentConverterService
   */
  setAutoHandler: function setAutoHandler(contentType, handler) {
    if (handler && !this._typeIsRegistered(contentType, handler.uri))
      throw Components.results.NS_ERROR_NOT_AVAILABLE;

    contentType = this._resolveContentType(contentType);
    this._setAutoHandler(contentType, handler);

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);
    var autoBranch = prefs.getBranch(PREF_CONTENTHANDLERS_AUTO);
    if (handler)
      autoBranch.setCharPref(contentType, handler.uri);
    else if (autoBranch.prefHasUserValue(contentType))
      autoBranch.clearUserPref(contentType);

    prefs.savePrefFile(null);
  },

  /**
   * Update the internal data structure (not persistent)
   */
  _setAutoHandler: function setAutoHandler(contentType, handler) {
    if (handler)
      this._autoHandleContentTypes[contentType] = handler;
    else if (contentType in this._autoHandleContentTypes)
      delete this._autoHandleContentTypes[contentType];
  },

  /**
   * See nsIWebContentConverterService
   */
  getWebContentHandlerByURI: function getWebContentHandlerByURI(contentType, uri) {
    var handlers = this.getContentHandlers(contentType, { });
    for (let i = 0; i < handlers.length; ++i) {
      if (handlers[i].uri == uri)
        return handlers[i];
    }
    return null;
  },

  /**
   * See nsIWebContentConverterService
   */
  loadPreferredHandler: function loadPreferredHandler(request) {
    var channel = request.QueryInterface(Components.interfaces.nsIChannel);
    var contentType = this._resolveContentType(channel.contentType);
    var handler = this.getAutoHandler(contentType);
    if (handler) {
      request.cancel(Components.results.NS_ERROR_FAILURE);

      var webNavigation = channel.notificationCallbacks
                                 .getInterface(Components.interfaces.nsIWebNavigation);
      webNavigation.loadURI(handler.getHandlerURI(channel.URI.spec),
                            Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE,
                            null, null, null);
    }
  },

  /**
   * See nsIWebContentConverterService
   */
  removeProtocolHandler: function removeProtocolHandler(aProtocol, aURITemplate) {
    var eps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                        .getService(Components.interfaces.nsIExternalProtocolService);
    var handlerInfo = eps.getProtocolHandlerInfo(aProtocol);
    var handlers =  handlerInfo.possibleApplicationHandlers;
    for (let i = 0; i < handlers.length; i++) {
      try { // We only want to test web handlers
        let handler = handlers.queryElementAt(i, Components.interfaces.nsIWebHandlerApp);
        if (handler.uriTemplate == aURITemplate) {
          handlers.removeElementAt(i);
          let hs = Components.classes["@mozilla.org/uriloader/handler-service;1"]
                             .getService(Components.interfaces.nsIHandlerService);
          hs.store(handlerInfo);
          return;
        }
      } catch (e) {
        /* it wasn't a web handler */
      }
    }
  },

  /**
   * See nsIWebContentConverterService
   */
  removeContentHandler: function removeContentHandler(contentType, uri) {
    function notURI(serviceInfo) {
      return serviceInfo.uri != uri;
    }

    if (contentType in this._contentTypes) {
      this._contentTypes[contentType] = this._contentTypes[contentType]
                                            .filter(notURI);
    }
  },

  /**
   *
   */
  _mappings: {
    "application/rss+xml": TYPE_MAYBE_FEED,
    "application/atom+xml": TYPE_MAYBE_FEED,
  },

  /**
   * These are types for which there is a separate content converter aside
   * from our built in generic one. We should not automatically register
   * a factory for creating a converter for these types.
   */
  _blockedTypes: {
    "application/vnd.mozilla.maybe.feed": true,
  },

  /**
   * Determines the "internal" content type based on the _mappings.
   * @param   contentType
   * @returns The resolved contentType value.
   */
  _resolveContentType: function resolveContentType(contentType) {
    if (contentType in this._mappings)
      return this._mappings[contentType];
    return contentType;
  },

  _makeURI: function(aURL, aOriginCharset, aBaseURI) {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    return ioService.newURI(aURL, aOriginCharset, aBaseURI);
  },

  _checkAndGetURI: function checkAndGetURI(aURIString, aContentWindow) {
    try {
      var uri = this._makeURI(aURIString);
    } catch (ex) {
      // not supposed to throw according to spec
      return;
    }

    // For security reasons we reject non-http(s) urls (see bug 354316),
    // we may need to revise this once we support more content types
    // XXX this should be a "security exception" according to spec, but that
    // isn't defined yet.
    if (uri.scheme != "http" && uri.scheme != "https")
      throw("Permission denied to add " + uri.spec + " as a content or protocol handler");

    // We also reject handlers registered from a different host (see bug 402287)
    // The pref allows us to test the feature
    var pb = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefBranch);
    if ((!pb.prefHasUserValue(PREF_ALLOW_DIFFERENT_HOST) ||
         !pb.getBoolPref(PREF_ALLOW_DIFFERENT_HOST)) &&
        aContentWindow.location.hostname != uri.host)
      throw("Permission denied to add " + uri.spec + " as a content or protocol handler");

    // If the uri doesn't contain '%s', it won't be a good handler
    if (uri.spec.indexOf("%s") < 0)
      throw NS_ERROR_DOM_SYNTAX_ERR;

    return uri;
  },

  /**
   * Determines if a web handler is already registered.
   *
   * @param aProtocol
   *        The scheme of the web handler we are checking for.
   * @param aURITemplate
   *        The URI template that the handler uses to handle the protocol.
   * @return true if it is already registered, false otherwise.
   */
  _protocolHandlerRegistered: function protocolHandlerRegistered(aProtocol, aURITemplate) {
    var eps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                        .getService(Components.interfaces.nsIExternalProtocolService);
    var handlerInfo = eps.getProtocolHandlerInfo(aProtocol);
    var handlers =  handlerInfo.possibleApplicationHandlers;
    for (let i = 0; i < handlers.length; i++) {
      try { // We only want to test web handlers
        let handler = handlers.queryElementAt(i, Components.interfaces.nsIWebHandlerApp);
        if (handler.uriTemplate == aURITemplate)
          return true;
      } catch (e) { /* it wasn't a web handler */ }
    }
    return false;
  },

  /**
   * See nsIWebContentHandlerRegistrar
   */
  registerProtocolHandler: function registerProtocolHandler(aProtocol, aURIString,
                                                             aTitle, aContentWindow) {
    LOG("registerProtocolHandler(" + aProtocol + "," + aURIString + "," + aTitle + ")");

    // First, check to make sure this isn't already handled internally (we don't
    // want to let them take over, say "chrome").
    var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    var handler = ios.getProtocolHandler(aProtocol);
    if (!(handler instanceof Components.interfaces.nsIExternalProtocolHandler)) {
      // This is handled internally, so we don't want them to register
      // XXX this should be a "security exception" according to spec, but that
      // isn't defined yet.
      throw("Permission denied to add " + aURIString + " as a protocol handler");
    }

    // check if it is in the black list
    var pb = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefBranch);
    var allowed;
    try {
      allowed = pb.getBoolPref(PREF_HANDLER_EXTERNAL_PREFIX + "." + aProtocol);
    }
    catch (e) {
      allowed = pb.getBoolPref(PREF_HANDLER_EXTERNAL_PREFIX + "-default");
    }
    if (!allowed) {
      // XXX this should be a "security exception" according to spec
      throw("Not allowed to register a protocol handler for " + aProtocol);
    }

    var uri = this._checkAndGetURI(aURIString, aContentWindow);

    var buttons, message;
    if (this._protocolHandlerRegistered(aProtocol, uri.spec))
      message = this._getFormattedString("protocolHandlerRegistered",
                                         [aTitle, aProtocol]);
    else {
      // Now Ask the user and provide the proper callback
      message = this._getFormattedString("addProtocolHandler",
                                         [aTitle, uri.host, aProtocol]);
      var fis = Components.classes["@mozilla.org/browser/favicon-service;1"]
                          .getService(Components.interfaces.nsIFaviconService);
      var notificationIcon = fis.getFaviconLinkForIcon(uri);
      var notificationValue = "Protocol Registration: " + aProtocol;
      var addButton = {
        label: this._getString("addProtocolHandlerAddButton"),
        accessKey: this._getString("addHandlerAddButtonAccesskey"),
        protocolInfo: { protocol: aProtocol, uri: uri.spec, name: aTitle },

        callback: function addProtocolHandlerButtonCallback(aNotification, aButtonInfo) {
          var protocol = aButtonInfo.protocolInfo.protocol;
          var uri      = aButtonInfo.protocolInfo.uri;
          var name     = aButtonInfo.protocolInfo.name;

          var handler = Components.classes["@mozilla.org/uriloader/web-handler-app;1"]
                                  .createInstance(Components.interfaces.nsIWebHandlerApp);
          handler.name = name;
          handler.uriTemplate = uri;

          var eps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Components.interfaces.nsIExternalProtocolService);
          var handlerInfo = eps.getProtocolHandlerInfo(protocol);
          handlerInfo.possibleApplicationHandlers.appendElement(handler, false);

          // Since the user has agreed to add a new handler, chances are good
          // that the next time they see a handler of this type, they're going
          // to want to use it.  Reset the handlerInfo to ask before the next
          // use.
          handlerInfo.alwaysAskBeforeHandling = true;

          var hs = Components.classes["@mozilla.org/uriloader/handler-service;1"]
                             .getService(Components.interfaces.nsIHandlerService);
          hs.store(handlerInfo);
        }
      };
      buttons = [addButton];
    }

    var notificationBox = getNotificationBox(browserElement);
    notificationBox.appendNotification(message,
                                       notificationValue,
                                       notificationIcon,
                                       notificationBox.PRIORITY_INFO_LOW,
                                       buttons);
  },

  /**
   * See nsIWebContentHandlerRegistrar
   * If a DOM window is provided, then the request came from content, so we
   * prompt the user to confirm the registration.
   */
  registerContentHandler: function registerContentHandler(aContentType, aURIString,
                                                           aTitle, aContentWindow) {
    LOG("registerContentHandler(" + aContentType + "," + aURIString + "," + aTitle + ")");

    // We only support feed types at present.
    // XXX this should be a "security exception" according to spec, but that
    // isn't defined yet.
    var contentType = this._resolveContentType(aContentType);
    if (contentType != TYPE_MAYBE_FEED)
      return;

    if (aContentWindow) {
      var uri = this._checkAndGetURI(aURIString, aContentWindow);

      this._appendFeedReaderNotification(uri, aTitle, getNotificationBox(browserElement));
    }
    else
      this._registerContentHandler(contentType, aURIString, aTitle);
  },

  /**
   * Appends a notifcation for the given feed reader details.
   *
   * The notification could be either a pseudo-dialog which lets
   * the user to add the feed reader:
   * [ [icon] Add %feed-reader-name% (%feed-reader-host%) as a Feed Reader?  (Add) [x] ]
   *
   * or a simple message for the case where the feed reader is already registered:
   * [ [icon] %feed-reader-name% is already registered as a Feed Reader             [x] ]
   *
   * A new notification isn't appended if the given notificationbox has a
   * notification for the same feed reader.
   *
   * @param aURI
   *        The url of the feed reader as a nsIURI object
   * @param aName
   *        The feed reader name as it was passed to registerContentHandler
   * @param aNotificationBox
   *        The notification box to which a notification might be appended
   * @return true if a notification has been appended, false otherwise.
   */
  _appendFeedReaderNotification: function appendFeedReaderNotification(aURI, aName, aNotificationBox) {
    var uriSpec = aURI.spec;
    var notificationValue = "feed reader notification: " + uriSpec;
    var notificationIcon = aURI.prePath + "/favicon.ico";

    // Don't append a new notification if the notificationbox
    // has a notification for the given feed reader already
    if (aNotificationBox.getNotificationWithValue(notificationValue))
      return false;

    var buttons, message;
    if (this.getWebContentHandlerByURI(TYPE_MAYBE_FEED, uriSpec))
      message = this._getFormattedString("handlerRegistered", [aName]);
    else {
      message = this._getFormattedString("addHandler", [aName, aURI.host]);
      var self = this;
      var addButton = {
        _outer: self,
        label: self._getString("addHandlerAddButton"),
        accessKey: self._getString("addHandlerAddButtonAccesskey"),
        feedReaderInfo: { uri: uriSpec, name: aName },

        /* static */
        callback: function addFeedReaderButtonCallback(aNotification, aButtonInfo) {
          var uri = aButtonInfo.feedReaderInfo.uri;
          var name = aButtonInfo.feedReaderInfo.name;
          var outer = aButtonInfo._outer;

          // The reader could have been added from another window mean while
          if (!outer.getWebContentHandlerByURI(TYPE_MAYBE_FEED, uri))
            outer._registerContentHandler(TYPE_MAYBE_FEED, uri, name);

          // avoid reference cycles
          aButtonInfo._outer = null;

          return false;
        }
      };
      buttons = [addButton];
    }

    aNotificationBox.appendNotification(message,
                                        notificationValue,
                                        notificationIcon,
                                        aNotificationBox.PRIORITY_INFO_LOW,
                                        buttons);
    return true;
  },

  /**
   * Save Web Content Handler metadata to persistent preferences.
   * @param   contentType
   *          The content Type being handled
   * @param   uri
   *          The uri of the web service
   * @param   title
   *          The human readable name of the web service
   *
   * This data is stored under:
   *
   *    browser.contentHandlers.type0 = content/type
   *    browser.contentHandlers.uri0 = http://www.foo.com/q=%s
   *    browser.contentHandlers.title0 = Foo 2.0alphr
   */
  _saveContentHandlerToPrefs: function saveContentHandlerToPrefs(contentType, uri, title) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);
    var i = 0;
    var typeBranch = null;
    while (true) {
      typeBranch = prefs.getBranch(PREF_CONTENTHANDLERS_BRANCH + i + ".");
      try {
        typeBranch.getCharPref("type");
        ++i;
      }
      catch (e) {
        // No more handlers
        break;
      }
    }
    if (typeBranch) {
      typeBranch.setCharPref("type", contentType);
      var pls = Components.classes["@mozilla.org/pref-localizedstring;1"]
                          .createInstance(Components.interfaces.nsIPrefLocalizedString);
      pls.data = uri;
      typeBranch.setComplexValue("uri",
                                 Components.interfaces.nsIPrefLocalizedString, pls);
      pls.data = title;
      typeBranch.setComplexValue("title",
                                 Components.interfaces.nsIPrefLocalizedString, pls);

      prefs.savePrefFile(null);
    }
  },

  /**
   * Determines if there is a type with a particular uri registered for the
   * specified content type already.
   * @param   contentType
   *          The content type that the uri handles
   * @param   uri
   *          The uri of the
   */
  _typeIsRegistered: function typeIsRegistered(contentType, uri) {
    if (!(contentType in this._contentTypes))
      return false;

    var services = this._contentTypes[contentType];
    for (let i = 0; i < services.length; ++i) {
      // This uri has already been registered
      if (services[i].uri == uri)
        return true;
    }
    return false;
  },

  /**
   * Gets a stream converter contract id for the specified content type.
   * @param   contentType
   *          The source content type for the conversion.
   * @returns A contract id to construct a converter to convert between the
   *          contentType and *\/*.
   */
  _getConverterContractID: function getConverterContractID(contentType) {
    const template = "@mozilla.org/streamconv;1?from=%s&to=*/*";
    return template.replace(/%s/, contentType);
  },

  /**
   * Register a web service handler for a content type.
   *
   * @param   contentType
   *          the content type being handled
   * @param   uri
   *          the URI of the web service
   * @param   title
   *          the human readable name of the web service
   */
  _registerContentHandler: function registerContentHandler(contentType, uri, title) {
    this._updateContentTypeHandlerMap(contentType, uri, title);
    this._saveContentHandlerToPrefs(contentType, uri, title);

    if (contentType == TYPE_MAYBE_FEED) {
      // Make the new handler the last-selected reader in the preview page
      // and make sure the preview page is shown the next time a feed is visited
      var pb = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefService).getBranch(null);
      pb.setCharPref(PREF_SELECTED_READER, "web");

      var supportsString = Components.classes["@mozilla.org/supports-string;1"]
                                     .createInstance(Components.interfaces.nsISupportsString);
      supportsString.data = uri;
      pb.setComplexValue(PREF_SELECTED_WEB, Components.interfaces.nsISupportsString,
                         supportsString);
      pb.setCharPref(PREF_SELECTED_ACTION, "ask");
      this._setAutoHandler(TYPE_MAYBE_FEED, null);
    }
  },

  /**
   * Update the content type -> handler map. This mapping is not persisted, use
   * registerContentHandler or _saveContentHandlerToPrefs for that purpose.
   * @param   contentType
   *          The content Type being handled
   * @param   uri
   *          The uri of the web service
   * @param   title
   *          The human readable name of the web service
   */
  _updateContentTypeHandlerMap: function updateContentTypeHandlerMap(contentType, uri, title) {
    if (!(contentType in this._contentTypes))
      this._contentTypes[contentType] = [];

    // Avoid adding duplicates
    if (this._typeIsRegistered(contentType, uri))
      return;

    this._contentTypes[contentType].push(new ServiceInfo(contentType, uri, title));

    if (!(contentType in this._blockedTypes)) {
      var converterContractID = this._getConverterContractID(contentType);
      var cr = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);
      cr.registerFactory(WCC_CLASSID, WCC_CLASSNAME, converterContractID,
                         WebContentConverterFactory);
    }
  },

  /**
   * See nsIWebContentConverterService
   */
  getContentHandlers: function getContentHandlers(contentType, countRef) {
    countRef.value = 0;
    if (!(contentType in this._contentTypes))
      return [];

    var handlers = this._contentTypes[contentType];
    countRef.value = handlers.length;
    return handlers;
  },

  /**
   * See nsIWebContentConverterService
   */
  resetHandlersForType: function resetHandlersForType(contentType) {
    // currently unused within the tree, so only useful for extensions; previous
    // impl. was buggy (and even infinite-looped!), so I argue that this is a
    // definite improvement
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  /**
   * Registers a handler from the settings on a preferences branch.
   *
   * @param branch
   *        an nsIPrefBranch containing "type", "uri", and "title" preferences
   *        corresponding to the content handler to be registered
   */
  _registerContentHandlerWithBranch: function(branch) {
    /**
     * Since we support up to six predefined readers, we need to handle gaps
     * better, since the first branch with user-added values will be .6
     *
     * How we deal with that is to check to see if there's no prefs in the
     * branch and stop cycling once that's true.  This doesn't fix the case
     * where a user manually removes a reader, but that's not supported yet!
     */
    var vals = branch.getChildList("", {});
    if (vals.length == 0)
      return;

    try {
      var type = branch.getCharPref("type");
      var uri = branch.getComplexValue("uri", Components.interfaces.nsIPrefLocalizedString).data;
      var title = branch.getComplexValue("title",
                                         Components.interfaces.nsIPrefLocalizedString).data;
      this._updateContentTypeHandlerMap(type, uri, title);
    }
    catch(ex) {
      // do nothing, the next branch might have values
    }
  },

  /**
   * Load the auto handler, content handler and protocol tables from
   * preferences.
   */
  _init: function init() {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);

    var kids = prefs.getBranch(PREF_CONTENTHANDLERS_BRANCH)
                    .getChildList("", {});
    // first get the numbers of the providers by getting all ###.uri prefs
    var nums = [];
    for (let i = 0; i < kids.length; i++) {
      let match = /^(\d+)\.uri$/.exec(kids[i]);
      if (match)
        nums.push(match[1]);
    }
    // sort them, to get them back in order
    nums.sort(function(a, b) {return a - b;});
    // now register them
    for (let i = 0; i < nums.length; i++) {
      let branch = prefs.getBranch(PREF_CONTENTHANDLERS_BRANCH + nums[i] + ".");
      this._registerContentHandlerWithBranch(branch);
    }

    // We need to do this _after_ registering all of the available handlers,
    // so that getWebContentHandlerByURI can return successfully.
    try {
      var autoBranch = prefs.getBranch(PREF_CONTENTHANDLERS_AUTO);
      var childPrefs = autoBranch.getChildList("", { });
      for (let i = 0; i < childPrefs.length; ++i) {
        let type = childPrefs[i];
        let uri = autoBranch.getCharPref(type);
        if (uri) {
          let handler = this.getWebContentHandlerByURI(type, uri);
          this._setAutoHandler(type, handler);
        }
      }
    }
    catch (e) {
    }
  },

  /**
   * See nsIObserver
   */
  observe: function observe(subject, topic, data) {
    var os = Components.classes["@mozilla.org/observer-service;1"]
                       .getService(Components.interfaces.nsIObserverService);
    switch (topic) {
    case "app-startup":
      os.addObserver(this, "final-ui-startup", false);
      break;
    case "final-ui-startup":
      os.removeObserver(this, "final-ui-startup");
      this._init();
      break;
    }
  },

  /**
   * See nsIFactory
   */
  createInstance: function createInstance(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return this.QueryInterface(iid);
  },

  /**
   * See nsIClassInfo
   */
  getInterfaces: function getInterfaces(countRef) {
    var interfaces = [Components.interfaces.nsIWebContentConverterService,
                      Components.interfaces.nsIWebContentHandlerRegistrar,
                      Components.interfaces.nsIObserver,
                      Components.interfaces.nsIClassInfo,
                      Components.interfaces.nsIFactory,
                      Components.interfaces.nsISupports];
    countRef.value = interfaces.length;
    return interfaces;
  },

 getHelperForLanguage: function getHelperForLanguage(language) {
    return null;
  },

  contractID: WCCR_CONTRACTID,
  classDescription: WCCR_CLASSNAME,
  classID: WCCR_CLASSID,
  implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Components.interfaces.nsIClassInfo.DOM_OBJECT,

  /**
   * See nsISupports
   */
  QueryInterface: XPCOMUtils.generateQI(
    [Components.interfaces.nsIWebContentConverterService,
     Components.interfaces.nsIWebContentHandlerRegistrar,
     Components.interfaces.nsIObserver,
     Components.interfaces.nsIClassInfo,
     Components.interfaces.nsIFactory,
     Components.interfaces.nsISupports]),

  _xpcom_categories: [{
    category: "app-startup",
    service: true
  }]
};

function NSGetModule(cm, file) {
  return XPCOMUtils.generateModule([WebContentConverterRegistrar]);
}
