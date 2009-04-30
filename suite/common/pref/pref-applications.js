/* -*- Mode: Java; tab-width: 2; c-basic-offset: 2; -*-
 *
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
 * The Original Code is the Download Actions Manager.
 *
 * The Initial Developer of the Original Code is
 * Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <ben@mozilla.org>
 *   Jeff Walden <jwalden+code@mit.edu>
 *   Asaf Romano <mozilla.mano@sent.com>
 *   Myk Melez <myk@mozilla.org>
 *   Florian Queze <florian@queze.net>
 *   Will Guaraldi <will.guaraldi@pculture.org>
 *   Robert Kaiser <kairo@kairo.at>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

function Startup()
{
  gApplicationsPane.init();
}

//****************************************************************************//
// Constants & Enumeration Values

// constants for interfaces we need multiple times
const nsIHandlerApp = Components.interfaces.nsIHandlerApp;
const nsIHandlerInfo = Components.interfaces.nsIHandlerInfo;
const nsILocalHandlerApp = Components.interfaces.nsILocalHandlerApp;
const nsIWebHandlerApp = Components.interfaces.nsIWebHandlerApp;
const nsIWebContentHandlerInfo = Components.interfaces.nsIWebContentHandlerInfo;
const nsIFilePicker = Components.interfaces.nsIFilePicker;
const nsIMIMEInfo = Components.interfaces.nsIMIMEInfo;
const nsIPropertyBag = Components.interfaces.nsIPropertyBag;

// global services
var handlerSvc = Components.classes["@mozilla.org/uriloader/handler-service;1"]
                           .getService(Components.interfaces.nsIHandlerService);
var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch2);
var categoryMgr = Components.classes["@mozilla.org/categorymanager;1"]
                            .getService(Components.interfaces.nsICategoryManager);
var mimeSvc = Components.classes["@mozilla.org/mime;1"]
                        .getService(Components.interfaces.nsIMIMEService);
var ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService);
var converterSvc = Components.classes["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"]
                             .getService(Components.interfaces.nsIWebContentConverterService);
#ifdef HAVE_SHELL_SERVICE
var shellSvc = Components.classes["@mozilla.org/suite/shell-service;1"]
                         .getService(Components.interfaces.nsIShellService);
#else
var shellSvc = null;
#endif

const TYPE_MAYBE_FEED = "application/vnd.mozilla.maybe.feed";
const TYPE_MAYBE_VIDEO_FEED = "application/vnd.mozilla.maybe.video.feed";
const TYPE_MAYBE_AUDIO_FEED = "application/vnd.mozilla.maybe.audio.feed";

const PREF_DISABLED_PLUGIN_TYPES = "plugin.disable_full_page_plugin_for_types";

// Preferences that affect which entries to show in the list.
const PREF_SHOW_PLUGINS_IN_LIST = "browser.download.show_plugins_in_list";
const PREF_HIDE_PLUGINS_WITHOUT_EXTENSIONS =
  "browser.download.hide_plugins_without_extensions";

/*
 * Preferences where we store handling information about the feed type.
 *
 * browser.feeds.handler
 * - "messenger", "reader" (clarified further using the .default preference),
 *   or "ask" -- indicates the default handler being used to process feeds;
 *   "messenger" is obsolete, use "reader" instead; to specify that the
 *    handler is messenger, set browser.feeds.handler.default to "messenger";
 *
 * browser.feeds.handler.default
 * - "messenger", "client" or "web" -- indicates the chosen feed reader used
 *   to display feeds, either transiently (i.e., when the "use as default"
 *   checkbox is unchecked, corresponds to when browser.feeds.handler=="ask")
 *   or more permanently (i.e., the item displayed in the dropdown in Feeds
 *   preferences)
 *
 * browser.feeds.handler.webservice
 * - the URL of the currently selected web service used to read feeds
 *
 * browser.feeds.handlers.application
 * - nsILocalFile, stores the current client-side feed reading app if one has
 *   been chosen
 */
const PREF_FEED_SELECTED_APP    = "browser.feeds.handlers.application";
const PREF_FEED_SELECTED_WEB    = "browser.feeds.handlers.webservice";
const PREF_FEED_SELECTED_ACTION = "browser.feeds.handler";
const PREF_FEED_SELECTED_READER = "browser.feeds.handler.default";

const PREF_VIDEO_FEED_SELECTED_APP    = "browser.videoFeeds.handlers.application";
const PREF_VIDEO_FEED_SELECTED_WEB    = "browser.videoFeeds.handlers.webservice";
const PREF_VIDEO_FEED_SELECTED_ACTION = "browser.videoFeeds.handler";
const PREF_VIDEO_FEED_SELECTED_READER = "browser.videoFeeds.handler.default";

const PREF_AUDIO_FEED_SELECTED_APP    = "browser.audioFeeds.handlers.application";
const PREF_AUDIO_FEED_SELECTED_WEB    = "browser.audioFeeds.handlers.webservice";
const PREF_AUDIO_FEED_SELECTED_ACTION = "browser.audioFeeds.handler";
const PREF_AUDIO_FEED_SELECTED_READER = "browser.audioFeeds.handler.default";

// The nsHandlerInfoAction enumeration values in nsIHandlerInfo identify
// the actions the application can take with content of various types.
// But since nsIHandlerInfo doesn't support plugins, there's no value
// identifying the "use plugin" action, so we use this constant instead.
const kActionUsePlugin = -3;
const kActionChooseApp = -2;
const kActionManageApp = -1;

//****************************************************************************//
// Utilities

function getDisplayNameForFile(aFile) {
/*
#ifdef XP_WIN
*/
  if (aFile instanceof Components.interfaces.nsILocalFileWin) {
    try {
      return aFile.getVersionInfoField("FileDescription");
    }
    catch(ex) {
      // fall through to the file name
    }
  }
/*
#endif
#ifdef XP_MACOSX
*/
  if (aFile instanceof Components.interfaces.nsILocalFileMac) {
    try {
      return aFile.bundleDisplayName;
    }
    catch(ex) {
      // fall through to the file name
    }
  }
/*
#endif
*/

  return aFile.leafName;
}

function getLocalHandlerApp(aFile) {
  var localHandlerApp = Components.classes["@mozilla.org/uriloader/local-handler-app;1"]
                                  .createInstance(nsILocalHandlerApp);
  localHandlerApp.name = getDisplayNameForFile(aFile);
  localHandlerApp.executable = aFile;

  return localHandlerApp;
}

/**
 * An enumeration of items in a JS array.
 *
 * FIXME: use ArrayConverter once it lands (bug 380839).
 * 
 * @constructor
 */
function ArrayEnumerator(aItems) {
  this._index = 0;
  this._contents = aItems;
}

ArrayEnumerator.prototype = {
  _index: 0,

  hasMoreElements: function() {
    return this._index < this._contents.length;
  },

  getNext: function() {
    return this._contents[this._index++];
  }
};

function isFeedType(t) {
  return t == TYPE_MAYBE_FEED || t == TYPE_MAYBE_VIDEO_FEED || t == TYPE_MAYBE_AUDIO_FEED;
}

//****************************************************************************//
// HandlerInfoWrapper

/**
 * This object wraps nsIHandlerInfo with some additional functionality
 * the Applications prefpane needs to display and allow modification of
 * the list of handled types.
 *
 * We create an instance of this wrapper for each entry we might display
 * in the prefpane, and we compose the instances from various sources,
 * including navigator.plugins and the handler service.
 *
 * We don't implement all the original nsIHandlerInfo functionality,
 * just the stuff that the prefpane needs.
 *
 * In theory, all of the custom functionality in this wrapper should get
 * pushed down into nsIHandlerInfo eventually.
 */
function HandlerInfoWrapper(aType, aHandlerInfo) {
  this.type = aType;
  this.wrappedHandlerInfo = aHandlerInfo;
}

HandlerInfoWrapper.prototype = {
  // The wrapped nsIHandlerInfo object.  In general, this object is private,
  // but there are a couple cases where callers access it directly for things
  // we haven't (yet?) implemented, so we make it a public property.
  wrappedHandlerInfo: null,


  //**************************************************************************//
  // nsIHandlerInfo

  // The MIME type or protocol scheme.
  type: null,

  get description() {
    if (this.wrappedHandlerInfo.description)
      return this.wrappedHandlerInfo.description;

    if (this.primaryExtension) {
      var extension = this.primaryExtension.toUpperCase();
      return document.getElementById("bundlePrefApplications")
                     .getFormattedString("fileEnding", [extension]);
    }

    return this.type;
  },

  get preferredApplicationHandler() {
    return this.wrappedHandlerInfo.preferredApplicationHandler;
  },

  set preferredApplicationHandler(aNewValue) {
    this.wrappedHandlerInfo.preferredApplicationHandler = aNewValue;

    // Make sure the preferred handler is in the set of possible handlers.
    if (aNewValue)
      this.addPossibleApplicationHandler(aNewValue)
  },

  get possibleApplicationHandlers() {
    return this.wrappedHandlerInfo.possibleApplicationHandlers;
  },

  addPossibleApplicationHandler: function(aNewHandler) {
    try {
      if (this.possibleApplicationHandlers.indexOf(0, aNewHandler) != -1)
        return;
    } catch (e) {
    }
    this.possibleApplicationHandlers.appendElement(aNewHandler, false);
  },

  removePossibleApplicationHandler: function(aHandler) {
    var defaultApp = this.preferredApplicationHandler;
    if (defaultApp && aHandler.equals(defaultApp)) {
      // If the app we remove was the default app, we must make sure
      // it won't be used anymore
      this.alwaysAskBeforeHandling = true;
      this.preferredApplicationHandler = null;
    }

    try {
      var handlerIdx = this.possibleApplicationHandlers.indexOf(0, aHandler);
      this.possibleApplicationHandlers.removeElementAt(handlerIdx);
    } catch (e) {
    }
  },

  get hasDefaultHandler() {
    return this.wrappedHandlerInfo.hasDefaultHandler;
  },

  get defaultDescription() {
    return this.wrappedHandlerInfo.defaultDescription;
  },

  // What to do with content of this type.
  get preferredAction() {
    // If we have an enabled plugin, then the action is to use that plugin.
    if (this.plugin && !this.isDisabledPluginType)
      return kActionUsePlugin;

    // If the action is to use a helper app, but we don't have a preferred
    // handler app, then switch to using the system default, if any; otherwise
    // fall back to saving to disk, which is the default action in nsMIMEInfo.
    // Note: "save to disk" is an invalid value for protocol info objects,
    // but the alwaysAskBeforeHandling getter will detect that situation
    // and always return true in that case to override this invalid value.
    if (this.wrappedHandlerInfo.preferredAction == nsIHandlerInfo.useHelperApp &&
        !gApplicationsPane.isValidHandlerApp(this.preferredApplicationHandler)) {
      return this.wrappedHandlerInfo.hasDefaultHandler ?
             nsIHandlerInfo.useSystemDefault :
             nsIHandlerInfo.saveToDisk;
    }

    return this.wrappedHandlerInfo.preferredAction;
  },

  set preferredAction(aNewValue) {
    // We don't modify the preferred action if the new action is to use a plugin
    // because handler info objects don't understand our custom "use plugin"
    // value.  Also, leaving it untouched means that we can automatically revert
    // to the old setting if the user ever removes the plugin.

    if (aNewValue != kActionUsePlugin)
      this.wrappedHandlerInfo.preferredAction = aNewValue;
  },

  get alwaysAskBeforeHandling() {
    // If this type is handled only by a plugin, we can't trust the value
    // in the handler info object, since it'll be a default based on the absence
    // of any user configuration, and the default in that case is to always ask,
    // even though we never ask for content handled by a plugin, so special case
    // plugin-handled types by returning false here.
    if (this.plugin && this.handledOnlyByPlugin)
      return false;

    // If this is a protocol type and the preferred action is "save to disk",
    // which is invalid for such types, then return true here to override that
    // action.  This could happen when the preferred action is to use a helper
    // app, but the preferredApplicationHandler is invalid, and there isn't
    // a default handler, so the preferredAction getter returns save to disk
    // instead.
    if (!(this.wrappedHandlerInfo instanceof nsIMIMEInfo) &&
        this.preferredAction == nsIHandlerInfo.saveToDisk)
      return true;

    return this.wrappedHandlerInfo.alwaysAskBeforeHandling;
  },

  set alwaysAskBeforeHandling(aNewValue) {
    this.wrappedHandlerInfo.alwaysAskBeforeHandling = aNewValue;
  },


  //**************************************************************************//
  // nsIMIMEInfo

  // The primary file extension associated with this type, if any.
  //
  // XXX Plugin objects contain an array of MimeType objects with "suffixes"
  // properties; if this object has an associated plugin, shouldn't we check
  // those properties for an extension?
  get primaryExtension() {
    try {
      if (this.wrappedHandlerInfo instanceof nsIMIMEInfo &&
          this.wrappedHandlerInfo.primaryExtension)
        return this.wrappedHandlerInfo.primaryExtension;
    } catch(ex) {}

    return null;
  },


  //**************************************************************************//
  // Plugin Handling

  // A plugin that can handle this type, if any.
  //
  // Note: just because we have one doesn't mean it *will* handle the type.
  // That depends on whether or not the type is in the list of types for which
  // plugin handling is disabled.
  plugin: null,

  // Whether or not this type is only handled by a plugin or is also handled
  // by some user-configured action as specified in the handler info object.
  //
  // Note: we can't just check if there's a handler info object for this type,
  // because OS and user configuration is mixed up in the handler info object,
  // so we always need to retrieve it for the OS info and can't tell whether
  // it represents only OS-default information or user-configured information.
  //
  // FIXME: once handler info records are broken up into OS-provided records
  // and user-configured records, stop using this boolean flag and simply
  // check for the presence of a user-configured record to determine whether
  // or not this type is only handled by a plugin.  Filed as bug 395142.
  handledOnlyByPlugin: undefined,

  get isDisabledPluginType() {
    return this._getDisabledPluginTypes().indexOf(this.type) != -1;
  },

  _getDisabledPluginTypes: function() {
    var types = "";

    if (prefSvc.prefHasUserValue(PREF_DISABLED_PLUGIN_TYPES))
      types = prefSvc.getCharPref(PREF_DISABLED_PLUGIN_TYPES);

    // Only split if the string isn't empty so we don't end up with an array
    // containing a single empty string.
    return types ? types.split(",") : [];
  },

  disablePluginType: function() {
    var disabledPluginTypes = this._getDisabledPluginTypes();

    if (disabledPluginTypes.indexOf(this.type) == -1)
      disabledPluginTypes.push(this.type);

    prefSvc.setCharPref(PREF_DISABLED_PLUGIN_TYPES,
                              disabledPluginTypes.join(","));

    // Update the category manager so existing browser windows update.
    categoryMgr.deleteCategoryEntry("Gecko-Content-Viewers",
                                          this.type,
                                          false);
  },

  enablePluginType: function() {
    var disabledPluginTypes = this._getDisabledPluginTypes();

    var type = this.type;
    disabledPluginTypes = disabledPluginTypes.filter(function(v) v != type);

    prefSvc.setCharPref(PREF_DISABLED_PLUGIN_TYPES,
                              disabledPluginTypes.join(","));

    // Update the category manager so existing browser windows update.
    categoryMgr.
      addCategoryEntry("Gecko-Content-Viewers",
                       this.type,
                       "@mozilla.org/content/plugin/document-loader-factory;1",
                       false,
                       true);
  },


  //**************************************************************************//
  // Storage

  store: function() {
    handlerSvc.store(this.wrappedHandlerInfo);
  },


  //**************************************************************************//
  // Icons

  get smallIcon() {
    return this._getIcon(16);
  },

  get largeIcon() {
    return this._getIcon(32);
  },

  _getIcon: function(aSize) {
    if (this.primaryExtension)
      return "moz-icon://goat." + this.primaryExtension + "?size=" + aSize;

    if (this.wrappedHandlerInfo instanceof nsIMIMEInfo)
      return "moz-icon://goat?size=" + aSize + "&contentType=" + this.type;

    // We're falling back to a generic icon when we can't get a URL for one
    // (for example in the case of protocol schemes).
    return null;
  },

  // The type class is used for setting icons through CSS for types that don't
  // explicitly set their icons.
  typeClass: "unknown"

};


//****************************************************************************//
// Feed Handler Info

/**
 * This object implements nsIHandlerInfo for the feed types.  It's a separate
 * object because we currently store handling information for the feed type
 * in a set of preferences rather than the nsIHandlerService-managed datastore.
 *
 * This object inherits from HandlerInfoWrapper in order to get functionality
 * that isn't special to the feed type.
 *
 * XXX Should we inherit from HandlerInfoWrapper?  After all, we override
 * most of that wrapper's properties and methods, and we have to dance around
 * the fact that the wrapper expects to have a wrappedHandlerInfo, which we
 * don't provide.
 */

function FeedHandlerInfo(aMIMEType) {
  HandlerInfoWrapper.call(this, aMIMEType, null);
}

FeedHandlerInfo.prototype = {
  //**************************************************************************//
  // nsIHandlerInfo

  get description() {
    return document.getElementById("bundlePrefApplications")
                   .getString(this.typeClass);
  },

  get preferredApplicationHandler() {
    switch (document.getElementById(this._prefSelectedReader).value) {
      case "client":
        var file = document.getElementById(this._prefSelectedApp).value;
        if (file)
          return getLocalHandlerApp(file);

        return null;

      case "web":
        var uri = document.getElementById(this._prefSelectedWeb).value;
        if (!uri)
          return null;
        return converterSvc.getWebContentHandlerByURI(this.type, uri);

      case "messenger":
      default:
        // When the pref is set to messenger, we handle feeds internally,
        // we don't forward them to a local or web handler app, so there is
        // no preferred handler.
        return null;
    }
  },

  set preferredApplicationHandler(aNewValue) {
    if (aNewValue instanceof nsILocalHandlerApp) {
      document.getElementById(this._prefSelectedApp).value = aNewValue.executable;
      document.getElementById(this._prefSelectedReader).value = "client";
    }
    else if (aNewValue instanceof nsIWebContentHandlerInfo) {
      document.getElementById(this._prefSelectedWeb).value = aNewValue.uri;
      document.getElementById(this._prefSelectedReader).value = "web";
      // Make the web handler be the new "auto handler" for feeds.
      // Note: we don't have to unregister the auto handler when the user picks
      // a non-web handler (local app, RSS News & Blogs, etc.) because the service
      // only uses the "auto handler" when the selected reader is a web handler.
      // We also don't have to unregister it when the user turns on "always ask"
      // (i.e. preview in browser), since that also overrides the auto handler.
      converterSvc.setAutoHandler(this.type, aNewValue);
    }
  },

  _possibleApplicationHandlers: null,

  get possibleApplicationHandlers() {
    if (this._possibleApplicationHandlers)
      return this._possibleApplicationHandlers;

    // A minimal implementation of nsIMutableArray.  It only supports the two
    // methods its callers invoke, namely appendElement, nsIArray::enumerate
    // and nsIArray::indexOf.
    this._possibleApplicationHandlers = {
      _inner: [],
      _removed: [],

      QueryInterface: function(aIID) {
        if (aIID.equals(Components.interfaces.nsIMutableArray) ||
            aIID.equals(Components.interfaces.nsIArray) ||
            aIID.equals(Components.interfaces.nsISupports))
          return this;

        throw Components.results.NS_ERROR_NO_INTERFACE;
      },

      get length() {
        return this._inner.length;
      },

      enumerate: function() {
        return new ArrayEnumerator(this._inner);
      },

      indexOf: function indexOf(startIndex, element) {
        return this._inner.indexOf(element, startIndex);
      },

      appendElement: function(aHandlerApp, aWeak) {
        this._inner.push(aHandlerApp);
      },

      removeElementAt: function(aIndex) {
        this._removed.push(this._inner[aIndex]);
        this._inner.splice(aIndex, 1);
      },

      queryElementAt: function(aIndex, aInterface) {
        return this._inner[aIndex].QueryInterface(aInterface);
      }
    };

    // Add the selected local app if it's different from the OS default handler.
    // Unlike for other types, we can store only one local app at a time for the
    // feed type, since we store it in a preference that historically stores
    // only a single path.  But we display all the local apps the user chooses
    // while the prefpane is open, only dropping the list when the user closes
    // the prefpane, for maximum usability and consistency with other types.
    var preferredAppFile = document.getElementById(this._prefSelectedApp).value;
    if (preferredAppFile) {
      let preferredApp = getLocalHandlerApp(preferredAppFile);
      let defaultApp = this._defaultApplicationHandler;
      if (!defaultApp || !defaultApp.equals(preferredApp))
        this._possibleApplicationHandlers.appendElement(preferredApp, false);
    }

    if (converterSvc) {
      // Add the registered web handlers.  There can be any number of these.
      var webHandlers = converterSvc.getContentHandlers(this.type, {});
      for each (let webHandler in webHandlers)
        this._possibleApplicationHandlers.appendElement(webHandler, false);
    }

    return this._possibleApplicationHandlers;
  },

  __defaultApplicationHandler: undefined,
  get _defaultApplicationHandler() {
    if (this.__defaultApplicationHandler !== undefined)
      return this.__defaultApplicationHandler;

    var defaultFeedReader = null;
#ifdef HAVE_SHELL_SERVICE
    try {
      defaultFeedReader = shellSvc.defaultFeedReader;
    }
    catch(ex) {
      // no default reader
    }
#endif

    if (defaultFeedReader) {
      let handlerApp = Components.classes["@mozilla.org/uriloader/local-handler-app;1"]
                                 .createInstance(nsIHandlerApp);
      handlerApp.name = getDisplayNameForFile(defaultFeedReader);
      handlerApp.QueryInterface(nsILocalHandlerApp);
      handlerApp.executable = defaultFeedReader;

      this.__defaultApplicationHandler = handlerApp;
    }
    else {
      this.__defaultApplicationHandler = null;
    }

    return this.__defaultApplicationHandler;
  },

  get hasDefaultHandler() {
#ifdef HAVE_SHELL_SERVICE
    try {
      if (shellSvc.defaultFeedReader)
        return true;
    }
    catch(ex) {
      // no default reader
    }
#endif

    return false;
  },

  get defaultDescription() {
    if (this.hasDefaultHandler)
      return this._defaultApplicationHandler.name;

    // Should we instead return null?
    return "";
  },

  // What to do with content of this type.
  get preferredAction() {
    switch (document.getElementById(this._prefSelectedAction).value) {

      case "reader": {
        let preferredApp = this.preferredApplicationHandler;
        let defaultApp = this._defaultApplicationHandler;

        // If we have a valid preferred app, return useSystemDefault if it's
        // the default app; otherwise return useHelperApp.
        if (gApplicationsPane.isValidHandlerApp(preferredApp)) {
          if (defaultApp && defaultApp.equals(preferredApp))
            return nsIHandlerInfo.useSystemDefault;

          return nsIHandlerInfo.useHelperApp;
        }

        // The pref is set to "reader", but we don't have a valid preferred app.
        // What do we do now?  Not sure this is the best option (perhaps we
        // should direct the user to the default app, if any), but for now let's
        // direct the user to live bookmarks.
        return nsIHandlerInfo.handleInternally;
      }

      // If the action is "ask", then alwaysAskBeforeHandling will override
      // the action, so it doesn't matter what we say it is, it just has to be
      // something that doesn't cause the controller to hide the type.
      case "ask":
      case "messenger":
      default:
        return nsIHandlerInfo.handleInternally;
    }
  },

  set preferredAction(aNewValue) {
    switch (aNewValue) {

      case nsIHandlerInfo.handleInternally:
        document.getElementById(this._prefSelectedReader).value = "messenger";
        break;

      case nsIHandlerInfo.useHelperApp:
        document.getElementById(this._prefSelectedAction).value = "reader";
        // The controller has already set preferredApplicationHandler
        // to the new helper app.
        break;

      case nsIHandlerInfo.useSystemDefault:
        document.getElementById(this._prefSelectedAction).value = "reader";
        this.preferredApplicationHandler = this._defaultApplicationHandler;
        break;
    }
  },

  get alwaysAskBeforeHandling() {
    return document.getElementById(this._prefSelectedAction).value == "ask";
  },

  set alwaysAskBeforeHandling(aNewValue) {
    if (aNewValue == true)
      document.getElementById(this._prefSelectedAction).value = "ask";
    else
      document.getElementById(this._prefSelectedAction).value = "reader";
  },

  // Whether or not we are currently storing the action selected by the user.
  // We use this to suppress notification-triggered updates to the list when
  // we make changes that may spawn such updates, specifically when we change
  // the action for the feed type, which results in feed preference updates,
  // which spawn "pref changed" notifications that would otherwise cause us
  // to rebuild the view unnecessarily.
  _storingAction: false,


  //**************************************************************************//
  // nsIMIMEInfo

  primaryExtension: "xml",


  //**************************************************************************//
  // Storage

  // Changes to the preferred action and handler take effect immediately
  // (we write them out to the preferences right as they happen),
  // so we when the controller calls store() after modifying the handlers,
  // the only thing we need to store is the removal of possible handlers
  // XXX Should we hold off on making the changes until this method gets called?
  store: function() {
    for each (let app in this._possibleApplicationHandlers._removed) {
      if (app instanceof nsILocalHandlerApp) {
        let pref = document.getElementById(PREF_FEED_SELECTED_APP);
        var preferredAppFile = pref.value;
        if (preferredAppFile) {
          let preferredApp = getLocalHandlerApp(preferredAppFile);
          if (app.equals(preferredApp))
            pref.reset();
        }
      }
      else {
        app.QueryInterface(nsIWebContentHandlerInfo);
        converterSvc.removeContentHandler(app.contentType, app.uri);
      }
    }
    this._possibleApplicationHandlers._removed = [];
  },


  //**************************************************************************//
  // Icons

  smallIcon: null,

  largeIcon: null,

  // The type class is used for setting icons through CSS for types that don't
  // explicitly set their icons.
  typeClass: "webFeed",

  __proto__: HandlerInfoWrapper.prototype
};

var feedHandlerInfo = {
  __proto__: new FeedHandlerInfo(TYPE_MAYBE_FEED),
  _prefSelectedApp: PREF_FEED_SELECTED_APP,
  _prefSelectedWeb: PREF_FEED_SELECTED_WEB,
  _prefSelectedAction: PREF_FEED_SELECTED_ACTION,
  _prefSelectedReader: PREF_FEED_SELECTED_READER,
  typeClass: "webFeed"
}

var videoFeedHandlerInfo = {
  __proto__: new FeedHandlerInfo(TYPE_MAYBE_VIDEO_FEED),
  _prefSelectedApp: PREF_VIDEO_FEED_SELECTED_APP,
  _prefSelectedWeb: PREF_VIDEO_FEED_SELECTED_WEB,
  _prefSelectedAction: PREF_VIDEO_FEED_SELECTED_ACTION,
  _prefSelectedReader: PREF_VIDEO_FEED_SELECTED_READER,
  typeClass: "videoPodcastFeed"
}

var audioFeedHandlerInfo = {
  __proto__: new FeedHandlerInfo(TYPE_MAYBE_AUDIO_FEED),
  _prefSelectedApp: PREF_AUDIO_FEED_SELECTED_APP,
  _prefSelectedWeb: PREF_AUDIO_FEED_SELECTED_WEB,
  _prefSelectedAction: PREF_AUDIO_FEED_SELECTED_ACTION,
  _prefSelectedReader: PREF_AUDIO_FEED_SELECTED_READER,
  typeClass: "audioPodcastFeed"
}


//****************************************************************************//
// Prefpane Controller

var gApplicationsPane = {
  // The set of types the app knows how to handle.  A hash of HandlerInfoWrapper
  // objects, indexed by type.
  _handledTypes: {},

  // The list of types we can show, sorted by the sort column/direction.
  // An array of HandlerInfoWrapper objects.  We build this list when we first
  // load the data and then rebuild it when users change a pref that affects
  // what types we can show or change the sort column/direction.
  // Note: this isn't necessarily the list of types we *will* show; if the user
  // provides a filter string, we'll only show the subset of types in this list
  // that match that string.
  _visibleTypes: [],

  // A count of the number of times each visible type description appears.
  // We use these counts to determine whether or not to annotate descriptions
  // with their types to distinguish duplicate descriptions from each other.
  // A hash of integer counts, indexed by string description.
  _visibleTypeDescriptionCount: {},


  //**************************************************************************//
  // Convenience & Performance Shortcuts

  // These get defined by init().
  _brandShortName : null,
  _prefsBundle    : null,
  _list           : null,
  _filter         : null,


  //**************************************************************************//
  // Initialization & Destruction

  init: function() {
    // Initialize shortcuts to some commonly accessed elements & values.
    this._brandShortName =
      document.getElementById("bundleBrand").getString("brandShortName");
    this._prefsBundle = document.getElementById("bundlePrefApplications");
    this._list = document.getElementById("handlersView");
    this._filter = document.getElementById("filter");

    // Observe preferences that influence what we display so we can rebuild
    // the view when they change.
    prefSvc.addObserver(PREF_SHOW_PLUGINS_IN_LIST, this, false);
    prefSvc.addObserver(PREF_HIDE_PLUGINS_WITHOUT_EXTENSIONS, this, false);
    prefSvc.addObserver(PREF_FEED_SELECTED_APP, this, false);
    prefSvc.addObserver(PREF_FEED_SELECTED_WEB, this, false);
    prefSvc.addObserver(PREF_FEED_SELECTED_ACTION, this, false);

    prefSvc.addObserver(PREF_VIDEO_FEED_SELECTED_APP, this, false);
    prefSvc.addObserver(PREF_VIDEO_FEED_SELECTED_WEB, this, false);
    prefSvc.addObserver(PREF_VIDEO_FEED_SELECTED_ACTION, this, false);

    prefSvc.addObserver(PREF_AUDIO_FEED_SELECTED_APP, this, false);
    prefSvc.addObserver(PREF_AUDIO_FEED_SELECTED_WEB, this, false);
    prefSvc.addObserver(PREF_AUDIO_FEED_SELECTED_ACTION, this, false);

    // Listen for window unload so we can remove our preference observers.
    window.addEventListener("unload", this, false);

    // Listen for user events on the listbox and its children
    this._list.addEventListener("select", this, false);
    this._list.addEventListener("command", this, false);

    // Figure out how we should be sorting the list.  We persist sort settings
    // across sessions, so we can't assume the default sort column/direction.
    this._sortColumn = document.getElementById("typeColumn");
    if (document.getElementById("actionColumn").hasAttribute("sortDirection")) {
      this._sortColumn = document.getElementById("actionColumn");
      // The typeColumn element always has a sortDirection attribute,
      // either because it was persisted or because the default value
      // from the xul file was used.  If we are sorting on the other
      // column, we should remove it.
      document.getElementById("typeColumn").removeAttribute("sortDirection");
    }

    // Load the data and build the list of handlers.
    this._loadData();
    this._rebuildVisibleTypes();
    this._sortVisibleTypes();
    this._rebuildView();
  },

  destroy: function() {
    this._list.removeEventListener("command", this, false);
    this._list.removeEventListener("select", this, false);
    window.removeEventListener("unload", this, false);
    prefSvc.removeObserver(PREF_SHOW_PLUGINS_IN_LIST, this);
    prefSvc.removeObserver(PREF_HIDE_PLUGINS_WITHOUT_EXTENSIONS, this);
    prefSvc.removeObserver(PREF_FEED_SELECTED_APP, this);
    prefSvc.removeObserver(PREF_FEED_SELECTED_WEB, this);
    prefSvc.removeObserver(PREF_FEED_SELECTED_ACTION, this);

    prefSvc.removeObserver(PREF_VIDEO_FEED_SELECTED_APP, this);
    prefSvc.removeObserver(PREF_VIDEO_FEED_SELECTED_WEB, this);
    prefSvc.removeObserver(PREF_VIDEO_FEED_SELECTED_ACTION, this);

    prefSvc.removeObserver(PREF_AUDIO_FEED_SELECTED_APP, this);
    prefSvc.removeObserver(PREF_AUDIO_FEED_SELECTED_WEB, this);
    prefSvc.removeObserver(PREF_AUDIO_FEED_SELECTED_ACTION, this);
  },


  //**************************************************************************//
  // nsISupports

  QueryInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsIObserver) ||
        aIID.equals(Components.interfaces.nsIDOMEventListener ||
        aIID.equals(Components.interfaces.nsISupports)))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },


  //**************************************************************************//
  // nsIObserver

  observe: function (aSubject, aTopic, aData) {
    // Rebuild the list when there are changes to preferences that influence
    // whether or not to show certain entries in the list.
    if (aTopic == "nsPref:changed" && !this._storingAction) {
      // These two prefs alter the list of visible types, so we have to rebuild
      // that list when they change.
      if (aData == PREF_SHOW_PLUGINS_IN_LIST ||
          aData == PREF_HIDE_PLUGINS_WITHOUT_EXTENSIONS) {
        this._rebuildVisibleTypes();
        this._sortVisibleTypes();
      }

      // All the prefs we observe can affect what we display, so we rebuild
      // the view when any of them changes.
      this._rebuildView();
    }
  },


  //**************************************************************************//
  // nsIDOMEventListener

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "unload":
        this.destroy();
        break;
      case "select":
        if (this._list.selectedItem)
          this._list.setAttribute("lastSelectedType",
                                  this._list.selectedItem.type);
        break;
      case "command":
        var target = aEvent.originalTarget;
        switch (target.localName) {
          case "listitem":
            if (!this._list.disabled &&
                target.type == this._list.getAttribute("lastSelectedType"))
              this._list.selectedItem = target;
            break;
          case "listcell":
            this.rebuildActionsMenu();
            break;
          case "menuitem":
            switch (parseInt(target.value)) {
              case kActionChooseApp:
                this.chooseApp();
                break;
              case kActionManageApp:
                this.manageApp();
                break;
              default:
                this.onSelectAction(target);
                break;
            }
            break;
        }
    }
  },


  //**************************************************************************//
  // Composed Model Construction

  _loadData: function() {
    this._loadFeedHandler();
    this._loadPluginHandlers();
    this._loadApplicationHandlers();
  },

  _loadFeedHandler: function() {
    this._handledTypes[TYPE_MAYBE_FEED] = feedHandlerInfo;
    feedHandlerInfo.handledOnlyByPlugin = false;

    this._handledTypes[TYPE_MAYBE_VIDEO_FEED] = videoFeedHandlerInfo;
    videoFeedHandlerInfo.handledOnlyByPlugin = false;

    this._handledTypes[TYPE_MAYBE_AUDIO_FEED] = audioFeedHandlerInfo;
    audioFeedHandlerInfo.handledOnlyByPlugin = false;
  },

  /**
   * Load the set of handlers defined by plugins.
   *
   * Note: if there's more than one plugin for a given MIME type, we assume
   * the last one is the one that the application will use.  That may not be
   * correct, but it's how we've been doing it for years.
   *
   * Perhaps we should instead query navigator.mimeTypes for the set of types
   * supported by the application and then get the plugin from each MIME type's
   * enabledPlugin property.  But if there's a plugin for a type, we need
   * to know about it even if it isn't enabled, since we're going to give
   * the user an option to enable it.
   * 
   * I'll also note that my reading of nsPluginTag::RegisterWithCategoryManager
   * suggests that enabledPlugin is only determined during registration
   * and does not get updated when plugin.disable_full_page_plugin_for_types
   * changes (unless modification of that preference spawns reregistration).
   * So even if we could use enabledPlugin to get the plugin that would be used,
   * we'd still need to check the pref ourselves to find out if it's enabled.
   */
  _loadPluginHandlers: function() {
    for (let i = 0; i < navigator.plugins.length; ++i) {
      let plugin = navigator.plugins[i];
      for (let j = 0; j < plugin.length; ++j) {
        let type = plugin[j].type;

        let handlerInfoWrapper;
        if (type in this._handledTypes)
          handlerInfoWrapper = this._handledTypes[type];
        else {
          let wrappedHandlerInfo =
            mimeSvc.getFromTypeAndExtension(type, null);
          handlerInfoWrapper = new HandlerInfoWrapper(type, wrappedHandlerInfo);
          handlerInfoWrapper.handledOnlyByPlugin = true;
          this._handledTypes[type] = handlerInfoWrapper;
        }

        handlerInfoWrapper.plugin = plugin;
      }
    }
  },

  /**
   * Load the set of handlers defined by the application datastore.
   */
  _loadApplicationHandlers: function() {
    var wrappedHandlerInfos = handlerSvc.enumerate();
    while (wrappedHandlerInfos.hasMoreElements()) {
      let wrappedHandlerInfo =
        wrappedHandlerInfos.getNext().QueryInterface(nsIHandlerInfo);
      let type = wrappedHandlerInfo.type;

      let handlerInfoWrapper;
      if (type in this._handledTypes)
        handlerInfoWrapper = this._handledTypes[type];
      else {
        handlerInfoWrapper = new HandlerInfoWrapper(type, wrappedHandlerInfo);
        this._handledTypes[type] = handlerInfoWrapper;
      }

      handlerInfoWrapper.handledOnlyByPlugin = false;
    }
  },


  //**************************************************************************//
  // View Construction

  _rebuildVisibleTypes: function() {
    // Reset the list of visible types and the visible type description counts.
    this._visibleTypes = [];
    this._visibleTypeDescriptionCount = {};

    // Get the preferences that help determine what types to show.
    var showPlugins = prefSvc.getBoolPref(PREF_SHOW_PLUGINS_IN_LIST);
    var hidePluginsWithoutExtensions =
        prefSvc.getBoolPref(PREF_HIDE_PLUGINS_WITHOUT_EXTENSIONS);

    for (let type in this._handledTypes) {
      let handlerInfo = this._handledTypes[type];

      // Hide plugins without associated extensions if so prefed so we don't
      // show a whole bunch of obscure types handled by plugins on Mac.
      // Note: though protocol types don't have extensions, we still show them;
      // the pref is only meant to be applied to MIME types, since plugins are
      // only associated with MIME types.
      // FIXME: should we also check the "suffixes" property of the plugin?
      // Filed as bug 395135.
      if (hidePluginsWithoutExtensions && handlerInfo.handledOnlyByPlugin &&
          handlerInfo.wrappedHandlerInfo instanceof nsIMIMEInfo &&
          !handlerInfo.primaryExtension)
        continue;

      // Hide types handled only by plugins if so prefed.
      if (handlerInfo.handledOnlyByPlugin && !showPlugins)
        continue;

      // We couldn't find any reason to exclude the type, so include it.
      this._visibleTypes.push(handlerInfo);

      if (handlerInfo.description in this._visibleTypeDescriptionCount)
        this._visibleTypeDescriptionCount[handlerInfo.description]++;
      else
        this._visibleTypeDescriptionCount[handlerInfo.description] = 1;
    }
  },

  _rebuildView: function() {
    // Clear the list of entries (the first 2 elements are <listcols> and
    // <listhead>, they should never get removed).
    while (this._list.childNodes.length > 2)
      this._list.removeChild(this._list.lastChild);

    var visibleTypes = this._visibleTypes;

    // If the user is filtering the list, then only show matching types.
    if (this._filter.value)
      visibleTypes = visibleTypes.filter(this._matchesFilter, this);

    for each (let visibleType in visibleTypes) {
      let item = document.createElement("listitem");
      item.setAttribute("allowevents", "true");
      item.setAttribute("type", visibleType.type);
      item.setAttribute("typeDescription", this._describeType(visibleType));
      if (visibleType.smallIcon)
        item.setAttribute("typeIcon", visibleType.smallIcon);
      else
        item.setAttribute("typeClass", visibleType.typeClass);
      item.setAttribute("actionDescription",
                        this._describePreferredAction(visibleType));

      if (!this._setIconClassForPreferredAction(visibleType, item)) {
        var sysIcon = this._getIconURLForPreferredAction(visibleType);
        if (sysIcon)
          item.setAttribute("actionIcon", sysIcon);
        else
          item.setAttribute("appHandlerIcon", "app");
      }

      this._list.appendChild(item);
    }
  },

  _matchesFilter: function(aType) {
    var filterValue = this._filter.value.toLowerCase();
    return this._describeType(aType).toLowerCase().indexOf(filterValue) != -1 ||
           this._describePreferredAction(aType).toLowerCase().indexOf(filterValue) != -1;
  },

  /**
   * Describe, in a human-readable fashion, the type represented by the given
   * handler info object.  Normally this is just the description provided by
   * the info object, but if more than one object presents the same description,
   * then we annotate the duplicate descriptions with the type itself to help
   * users distinguish between those types.
   *
   * @param aHandlerInfo {nsIHandlerInfo} the type being described
   * @returns {string} a description of the type
   */
  _describeType: function(aHandlerInfo) {
    if (this._visibleTypeDescriptionCount[aHandlerInfo.description] > 1)
      return this._prefsBundle.getFormattedString("typeDescriptionWithType",
                                                  [aHandlerInfo.description,
                                                   aHandlerInfo.type]);

    return aHandlerInfo.description;
  },

  /**
   * Describe, in a human-readable fashion, the preferred action to take on
   * the type represented by the given handler info object.
   *
   * XXX Should this be part of the HandlerInfoWrapper interface?  It would
   * violate the separation of model and view, but it might make more sense
   * nonetheless (f.e. it would make sortTypes easier).
   *
   * @param aHandlerInfo {nsIHandlerInfo} the type whose preferred action
   *                                      is being described
   * @returns {string} a description of the action
   */
  _describePreferredAction: function(aHandlerInfo) {
    // alwaysAskBeforeHandling overrides the preferred action, so if that flag
    // is set, then describe that behavior instead.  For most types, this is
    // the "alwaysAsk" string, but for the feed type we show something special.
    if (aHandlerInfo.alwaysAskBeforeHandling) {
      if (isFeedType(aHandlerInfo.type))
        return this._prefsBundle.getFormattedString("previewInApp",
                                                    [this._brandShortName]);
      else
        return this._prefsBundle.getString("alwaysAsk");
    }

    switch (aHandlerInfo.preferredAction) {
      case nsIHandlerInfo.saveToDisk:
        return this._prefsBundle.getString("saveFile");

      case nsIHandlerInfo.useHelperApp:
        var preferredApp = aHandlerInfo.preferredApplicationHandler;
        var name = (preferredApp instanceof nsILocalHandlerApp) ?
                   getDisplayNameForFile(preferredApp.executable) :
                   preferredApp.name;
        return this._prefsBundle.getFormattedString("useApp", [name]);

      case nsIHandlerInfo.handleInternally:
        // For the feed type, handleInternally means News & Blogs.
        if (isFeedType(aHandlerInfo.type))
          return this._prefsBundle.getFormattedString("addNewsBlogsInApp",
                                                      [this._brandShortName]);

        // For other types, handleInternally looks like either useHelperApp
        // or useSystemDefault depending on whether or not there's a preferred
        // handler app.
        return (this.isValidHandlerApp(aHandlerInfo.preferredApplicationHandler)) ?
               aHandlerInfo.preferredApplicationHandler.name :
               aHandlerInfo.defaultDescription;

        // XXX Why don't we say the app will handle the type internally?
        // Is it because the app can't actually do that?  But if that's true,
        // then why would a preferredAction ever get set to this value
        // in the first place?

      case nsIHandlerInfo.useSystemDefault:
        return this._prefsBundle.getFormattedString("useDefault",
                                                    [aHandlerInfo.defaultDescription]);

      case kActionUsePlugin:
        return this._prefsBundle.getFormattedString("usePluginIn",
                                                    [aHandlerInfo.plugin.name,
                                                     this._brandShortName]);
    }
    // we should never end up here but do a return to end up with a value
    return null;
  },

  /**
   * Whether or not the given handler app is valid.
   *
   * @param aHandlerApp {nsIHandlerApp} the handler app in question
   *
   * @returns {boolean} whether or not it's valid
   */
  isValidHandlerApp: function(aHandlerApp) {
    if (!aHandlerApp)
      return false;

    if (aHandlerApp instanceof nsILocalHandlerApp)
      return this._isValidHandlerExecutable(aHandlerApp.executable);

    if (aHandlerApp instanceof nsIWebHandlerApp)
      return aHandlerApp.uriTemplate;

    if (aHandlerApp instanceof nsIWebContentHandlerInfo)
      return aHandlerApp.uri;

    return false;
  },

  _isValidHandlerExecutable: function(aExecutable) {
    return aExecutable &&
           aExecutable.exists() &&
           aExecutable.isExecutable() &&
// XXXben - we need to compare this with the running instance executable
//          just don't know how to do that via script...
// XXXmano TBD: can probably add this to nsIShellService
#ifdef XP_WIN
#expand    aExecutable.leafName != "__MOZ_APP_NAME__.exe";
#else
#ifdef XP_MACOSX
#expand    aExecutable.leafName != "__MOZ_APP_DISPLAYNAME__.app";
#else
#expand    aExecutable.leafName != "__MOZ_APP_NAME__-bin";
#endif
#endif
  },

  /**
   * Rebuild the actions menu for the selected entry. Gets called by
   * the listcell constructor when an entry in the list gets selected.
   * Note that this would not work from onselect on the listbox because
   * the XBL needs to be applied _before_ calling this function!
   */
  rebuildActionsMenu: function() {
    var typeItem = this._list.selectedItem;
    var handlerInfo = this._handledTypes[typeItem.type];
    var cell =
      document.getAnonymousElementByAttribute(typeItem, "anonid", "action-cell");
    var menu =
      document.getAnonymousElementByAttribute(cell, "anonid", "action-menu");
    var menuPopup = menu.menupopup;

    // Clear out existing items.
    while (menuPopup.hasChildNodes())
      menuPopup.removeChild(menuPopup.lastChild);

    {
      let askMenuItem = document.createElement("menuitem");
      askMenuItem.setAttribute("class", "handler-action");
      askMenuItem.setAttribute("value", nsIHandlerInfo.alwaysAsk);
      let label;
      if (isFeedType(handlerInfo.type))
        label = this._prefsBundle.getFormattedString("previewInApp",
                                                     [this._brandShortName]);
      else
        label = this._prefsBundle.getString("alwaysAsk");
      askMenuItem.setAttribute("label", label);
      askMenuItem.setAttribute("tooltiptext", label);
      askMenuItem.setAttribute("appHandlerIcon", "ask");
      menuPopup.appendChild(askMenuItem);
    }

    // Create a menu item for saving to disk.
    // Note: this option isn't available to protocol types, since we don't know
    // what it means to save a URL having a certain scheme to disk, nor is it
    // available to feeds, since the feed code doesn't implement the capability.
    if ((handlerInfo.wrappedHandlerInfo instanceof nsIMIMEInfo) &&
        !isFeedType(handlerInfo.type)) {
      let saveMenuItem = document.createElement("menuitem");
      saveMenuItem.setAttribute("class", "handler-action");
      saveMenuItem.setAttribute("value", nsIHandlerInfo.saveToDisk);
      let label = this._prefsBundle.getString("saveFile");
      saveMenuItem.setAttribute("label", label);
      saveMenuItem.setAttribute("tooltiptext", label);
      saveMenuItem.setAttribute("appHandlerIcon", "save");
      menuPopup.appendChild(saveMenuItem);
    }

    // If this is the feed type, add a News & Blogs item.
    if (isFeedType(handlerInfo.type)) {
      let internalMenuItem = document.createElement("menuitem");
      internalMenuItem.setAttribute("class", "handler-action");
      internalMenuItem.setAttribute("value", nsIHandlerInfo.handleInternally);
      let label = this._prefsBundle.getFormattedString("addNewsBlogsInApp",
                                                       [this._brandShortName]);
      internalMenuItem.setAttribute("label", label);
      internalMenuItem.setAttribute("tooltiptext", label);
      internalMenuItem.setAttribute("appHandlerIcon", "feed");
      menuPopup.appendChild(internalMenuItem);
    }

    // Add a separator to distinguish these items from the helper app items
    // that follow them.
    let menuSeparator = document.createElement("menuseparator");
    menuPopup.appendChild(menuSeparator);

    // Create a menu item for the OS default application, if any.
    if (handlerInfo.hasDefaultHandler) {
      let defaultMenuItem = document.createElement("menuitem");
      defaultMenuItem.setAttribute("class", "handler-action");
      defaultMenuItem.setAttribute("value", nsIHandlerInfo.useSystemDefault);
      let label = this._prefsBundle.getFormattedString("useDefault",
                                                       [handlerInfo.defaultDescription]);
      defaultMenuItem.setAttribute("label", label);
      defaultMenuItem.setAttribute("tooltiptext", handlerInfo.defaultDescription);
      let sysIcon = this._getIconURLForSystemDefault(handlerInfo);
      if (sysIcon)
        defaultMenuItem.setAttribute("image", sysIcon);
      else
        defaultMenuItem.setAttribute("appHandlerIcon", "app");

      menuPopup.appendChild(defaultMenuItem);
    }

    // Create menu items for possible handlers.
    let preferredApp = handlerInfo.preferredApplicationHandler;
    let possibleApps = handlerInfo.possibleApplicationHandlers.enumerate();
    var possibleAppMenuItems = [];
    while (possibleApps.hasMoreElements()) {
      let possibleApp = possibleApps.getNext();
      if (!this.isValidHandlerApp(possibleApp))
        continue;

      let menuItem = document.createElement("menuitem");
      menuItem.setAttribute("class", "handler-action");
      menuItem.setAttribute("value", nsIHandlerInfo.useHelperApp);
      let label;
      if (possibleApp instanceof nsILocalHandlerApp)
        label = getDisplayNameForFile(possibleApp.executable);
      else
        label = possibleApp.name;
      label = this._prefsBundle.getFormattedString("useApp", [label]);
      menuItem.setAttribute("label", label);
      menuItem.setAttribute("tooltiptext", label);
      let sysIcon = this._getIconURLForHandlerApp(possibleApp);
      if (sysIcon)
        menuItem.setAttribute("image", sysIcon);
      else
        menuItem.setAttribute("appHandlerIcon", "app");

      // Attach the handler app object to the menu item so we can use it
      // to make changes to the datastore when the user selects the item.
      menuItem.handlerApp = possibleApp;

      menuPopup.appendChild(menuItem);
      possibleAppMenuItems.push(menuItem);
    }

    // Create a menu item for the plugin.
    if (handlerInfo.plugin) {
      let pluginMenuItem = document.createElement("menuitem");
      pluginMenuItem.setAttribute("class", "handler-action");
      pluginMenuItem.setAttribute("value", kActionUsePlugin);
      let label = this._prefsBundle.getFormattedString("usePluginIn",
                                                       [handlerInfo.plugin.name,
                                                        this._brandShortName]);
      pluginMenuItem.setAttribute("label", label);
      pluginMenuItem.setAttribute("tooltiptext", label);
      pluginMenuItem.setAttribute("appHandlerIcon", "plugin");
      menuPopup.appendChild(pluginMenuItem);
    }

    // Create a menu item for selecting a local application.
#ifdef XP_WIN
    // On Windows, selecting an application to open another application
    // would be meaningless so we special case executables.
    var executableType = mimeSvc.getTypeFromExtension("exe");
    if (handlerInfo.type != executableType)
#endif
    {
      let menuItem = document.createElement("menuitem");
      menuItem.setAttribute("class", "handler-action");
      menuItem.setAttribute("value", kActionChooseApp);
      let label = this._prefsBundle.getString("useOtherApp");
      menuItem.setAttribute("label", label);
      menuItem.setAttribute("tooltiptext", label);
      menuPopup.appendChild(menuItem);
    }

    // Create a menu item for managing applications.
    if (possibleAppMenuItems.length) {
      let menuItem = document.createElement("menuseparator");
      menuPopup.appendChild(menuItem);
      menuItem = document.createElement("menuitem");
      menuItem.setAttribute("class", "handler-action");
      menuItem.setAttribute("value", kActionManageApp);
      menuItem.setAttribute("label", this._prefsBundle.getString("manageApp"));
      menuPopup.appendChild(menuItem);
    }

    // Select the item corresponding to the preferred action.  If the always
    // ask flag is set, it overrides the preferred action.  Otherwise we pick
    // the item identified by the preferred action (when the preferred action
    // is to use a helper app, we have to pick the specific helper app item).
    if (handlerInfo.alwaysAskBeforeHandling)
      menu.value = nsIHandlerInfo.alwaysAsk;
    else if (handlerInfo.preferredAction == nsIHandlerInfo.useHelperApp &&
             preferredApp)
      menu.selectedItem = 
        possibleAppMenuItems.filter(function(v) v.handlerApp.equals(preferredApp))[0];
    else
      menu.value = handlerInfo.preferredAction;
  },


  //**************************************************************************//
  // Sorting & Filtering

  _sortColumn: null,

  /**
   * Sort the list when the user clicks on a column header.
   */
  sort: function (event) {
    var column = event.target;

    // If the user clicked on a new sort column, remove the direction indicator
    // from the old column.
    if (this._sortColumn && this._sortColumn != column)
      this._sortColumn.removeAttribute("sortDirection");

    this._sortColumn = column;

    // Set (or switch) the sort direction indicator.
    if (column.getAttribute("sortDirection") == "ascending")
      column.setAttribute("sortDirection", "descending");
    else
      column.setAttribute("sortDirection", "ascending");

    this._sortVisibleTypes();
    this._rebuildView();
  },

  /**
   * Sort the list of visible types by the current sort column/direction.
   */
  _sortVisibleTypes: function() {
    var t = this;

    function sortByType(a, b) {
      return t._describeType(a).toLowerCase()
              .localeCompare(t._describeType(b).toLowerCase());
    }

    function sortByAction(a, b) {
      return t._describePreferredAction(a).toLowerCase()
              .localeCompare(t._describePreferredAction(b).toLowerCase());
    }

    switch (this._sortColumn.getAttribute("value")) {
      case "type":
        this._visibleTypes.sort(sortByType);
        break;
      case "action":
        this._visibleTypes.sort(sortByAction);
        break;
    }

    if (this._sortColumn.getAttribute("sortDirection") == "descending")
      this._visibleTypes.reverse();
  },


  //**************************************************************************//
  // Changes

  onSelectAction: function(aActionItem) {
    this._storingAction = true;

    try {
      this._storeAction(aActionItem);
    }
    finally {
      this._storingAction = false;
    }
  },

  _storeAction: function(aActionItem) {
    var typeItem = this._list.selectedItem;
    var handlerInfo = this._handledTypes[typeItem.type];

    let action = parseInt(aActionItem.getAttribute("value"));

    // Set the plugin state if we're enabling or disabling a plugin.
    if (action == kActionUsePlugin)
      handlerInfo.enablePluginType();
    else if (handlerInfo.plugin && !handlerInfo.isDisabledPluginType)
      handlerInfo.disablePluginType();

    // Set the preferred application handler.
    // We leave the existing preferred app in the list when we set
    // the preferred action to something other than useHelperApp so that
    // legacy datastores that don't have the preferred app in the list
    // of possible apps still include the preferred app in the list of apps
    // the user can choose to handle the type.
    if (action == nsIHandlerInfo.useHelperApp)
      handlerInfo.preferredApplicationHandler = aActionItem.handlerApp;

    // Set the preferred action.
    handlerInfo.preferredAction = action;

    // Set the "always ask" flag.
    handlerInfo.alwaysAskBeforeHandling = action == nsIHandlerInfo.alwaysAsk;

    handlerInfo.store();

    // Make sure the handler info object is flagged to indicate that there is
    // now some user configuration for the type.
    handlerInfo.handledOnlyByPlugin = false;

    // Update the action label and image to reflect the new preferred action.
    typeItem.setAttribute("actionDescription",
                          this._describePreferredAction(handlerInfo));
    if (!this._setIconClassForPreferredAction(handlerInfo, typeItem)) {
      var sysIcon = this._getIconURLForPreferredAction(handlerInfo);
      if (sysIcon)
        typeItem.setAttribute("actionIcon", sysIcon);
      else
        typeItem.setAttribute("appHandlerIcon", "app");
    }
  },

  manageApp: function() {
    var typeItem = this._list.selectedItem;
    var handlerInfo = this._handledTypes[typeItem.type];

    document.documentElement.openSubDialog("chrome://communicator/content/pref/pref-applicationManager.xul",
                                           "", handlerInfo);

    // Rebuild the actions menu so that we revert to the previous selection,
    // or "Always ask" if the previous default application has been removed
    this.rebuildActionsMenu();

    // update the listitem too. Will be visible when selecting another row
    typeItem.setAttribute("actionDescription",
                          this._describePreferredAction(handlerInfo));
    if (!this._setIconClassForPreferredAction(handlerInfo, typeItem)) {
      var sysIcon = this._getIconURLForPreferredAction(handlerInfo);
      if (sysIcon)
        typeItem.setAttribute("actionIcon", sysIcon);
      else
        typeItem.setAttribute("appHandlerIcon", "app");
    }
  },

  chooseApp: function() {
    var handlerApp;

#ifdef XP_WIN
    var params = {};
    var handlerInfo = this._handledTypes[this._list.selectedItem.type];

    if (isFeedType(handlerInfo.type)) {
      // MIME info will be null, create a temp object.
      params.mimeInfo = mimeSvc.getFromTypeAndExtension(handlerInfo.type, 
                                                 handlerInfo.primaryExtension);
    } else {
      params.mimeInfo = handlerInfo.wrappedHandlerInfo;
    }

    params.title         = this._prefsBundle.getString("fpTitleChooseApp");
    params.description   = handlerInfo.description;
    params.filename      = null;
    params.handlerApp    = null;

    window.openDialog("chrome://global/content/appPicker.xul", null,
                      "chrome,modal,centerscreen,titlebar,dialog=yes",
                      params);

    if (params.handlerApp && 
        params.handlerApp.executable && 
        params.handlerApp.executable.isFile()) {
      handlerApp = params.handlerApp;

      // Add the app to the type's list of possible handlers.
      handlerInfo.addPossibleApplicationHandler(handlerApp);
    }
#else
    var fp = Components.classes["@mozilla.org/filepicker;1"]
                       .createInstance(nsIFilePicker);
    var winTitle = this._prefsBundle.getString("fpTitleChooseApp");
    fp.init(window, winTitle, nsIFilePicker.modeOpen);
    fp.appendFilters(nsIFilePicker.filterApps);

    // Prompt the user to pick an app.  If they pick one, and it's a valid
    // selection, then add it to the list of possible handlers.
    if (fp.show() == nsIFilePicker.returnOK && fp.file &&
        this._isValidHandlerExecutable(fp.file)) {
      handlerApp = Components.classes["@mozilla.org/uriloader/local-handler-app;1"]
                             .createInstance(nsILocalHandlerApp);
      handlerApp.name = getDisplayNameForFile(fp.file);
      handlerApp.executable = fp.file;

      // Add the app to the type's list of possible handlers.
      let handlerInfo = this._handledTypes[this._list.selectedItem.type];
      handlerInfo.addPossibleApplicationHandler(handlerApp);
    }
#endif

    // Rebuild the actions menu whether the user picked an app or canceled.
    // If they picked an app, we want to add the app to the menu and select it.
    // If they canceled, we want to go back to their previous selection.
    this.rebuildActionsMenu();

    // If the user picked a new app from the menu, select it.
    if (handlerApp) {
      let typeItem = this._list.selectedItem;
      var actionsCell =
        document.getAnonymousElementByAttribute(typeItem, "anonid", "action-cell");
      var actionsMenu =
        document.getAnonymousElementByAttribute(actionsCell, "anonid", "action-menu");
      let menuItems = actionsMenu.menupopup.childNodes;
      for (let i = 0; i < menuItems.length; i++) {
        let menuItem = menuItems[i];
        if (menuItem.handlerApp && menuItem.handlerApp.equals(handlerApp)) {
          actionsMenu.selectedIndex = i;
          this.onSelectAction(menuItem);
          break;
        }
      }
    }
  },

  _setIconClassForPreferredAction: function(aHandlerInfo, aElement) {
    // If this returns true, the attribute that CSS sniffs for was set to something
    // so you shouldn't manually set an icon URI.
    // This removes the existing actionIcon attribute if any, even if returning false.
    aElement.removeAttribute("actionIcon");

    if (aHandlerInfo.alwaysAskBeforeHandling) {
      aElement.setAttribute("appHandlerIcon", "ask");
      return true;
    }

    switch (aHandlerInfo.preferredAction) {
      case nsIHandlerInfo.saveToDisk:
        aElement.setAttribute("appHandlerIcon", "save");
        return true;

      case nsIHandlerInfo.handleInternally:
        if (isFeedType(aHandlerInfo.type)) {
          aElement.setAttribute("appHandlerIcon", "feed");
          return true;
        }
        break;

      case kActionUsePlugin:
        aElement.setAttribute("appHandlerIcon", "plugin");
        return true;
    }
    aElement.removeAttribute("appHandlerIcon");
    return false;
  },

  _getIconURLForPreferredAction: function(aHandlerInfo) {
    switch (aHandlerInfo.preferredAction) {
      case nsIHandlerInfo.useSystemDefault:
        return this._getIconURLForSystemDefault(aHandlerInfo);

      case nsIHandlerInfo.useHelperApp:
        let (preferredApp = aHandlerInfo.preferredApplicationHandler) {
          if (this.isValidHandlerApp(preferredApp))
            return this._getIconURLForHandlerApp(preferredApp);
        }
        break;
    }
    // This should never happen, but if preferredAction is set to some weird
    // value, then fall back to the generic application icon.
    return null;
  },

  _getIconURLForHandlerApp: function(aHandlerApp) {
    if (aHandlerApp instanceof nsILocalHandlerApp)
      return this._getIconURLForFile(aHandlerApp.executable);

    if (aHandlerApp instanceof nsIWebHandlerApp)
      return this._getIconURLForWebApp(aHandlerApp.uriTemplate);

    if (aHandlerApp instanceof nsIWebContentHandlerInfo)
      return this._getIconURLForWebApp(aHandlerApp.uri)

    // We know nothing about other kinds of handler apps.
    return "";
  },

  _getIconURLForFile: function(aFile) {
    var fph = ioSvc.getProtocolHandler("file")
                   .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    var urlSpec = fph.getURLSpecFromFile(aFile);

    return "moz-icon://" + urlSpec + "?size=16";
  },

  _getIconURLForWebApp: function(aWebAppURITemplate) {
    var uri = ioSvc.newURI(aWebAppURITemplate, null, null);

    // Unfortunately we need to use favicon.ico here, but we don't know
    // about any other possibility to retrieve an icon for the web app/site
    // without loading a specific full URL and parsing it for a possible
    // shortcut icon.

    return /^https?/.test(uri.scheme) ? uri.resolve("/favicon.ico") : "";
  },

  _getIconURLForSystemDefault: function(aHandlerInfo) {
    // Handler info objects for MIME types on some OSes implement a property bag
    // interface from which we can get an icon for the default app, so if we're
    // dealing with a MIME type on one of those OSes, then try to get the icon.
    if ("wrappedHandlerInfo" in aHandlerInfo) {
      let wrappedHandlerInfo = aHandlerInfo.wrappedHandlerInfo;

      if (wrappedHandlerInfo instanceof nsIMIMEInfo &&
          wrappedHandlerInfo instanceof nsIPropertyBag) {
        try {
          let url = wrappedHandlerInfo.getProperty("defaultApplicationIconURL");
          if (url)
            return url + "?size=16";
        }
        catch(ex) {}
      }
    }

    // If this isn't a MIME type object on an OS that supports retrieving
    // the icon, or if we couldn't retrieve the icon for some other reason,
    // then use a generic icon.
    return null;
  }

};
