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
 * The Original Code is the Feed Writer.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <beng@google.com>
 *   Jeff Walden <jwalden+code@mit.edu>
 *   Asaf Romano <mano@mozilla.com>
 *   Robert Sayre <sayrer@gmail.com>
 *   Michael Ventnor <m.ventnor@gmail.com>
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

const XML_NS = "http://www.w3.org/XML/1998/namespace";
const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const TYPE_MAYBE_FEED = "application/vnd.mozilla.maybe.feed";
const TYPE_MAYBE_AUDIO_FEED = "application/vnd.mozilla.maybe.audio.feed";
const TYPE_MAYBE_VIDEO_FEED = "application/vnd.mozilla.maybe.video.feed";
const STRING_BUNDLE_URI = "chrome://communicator/locale/feeds/subscribe.properties";
const SUBSCRIBE_PAGE_URI = "chrome://communicator/content/feeds/subscribe.xhtml";

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

const PREF_SHOW_FIRST_RUN_UI = "browser.feeds.showFirstRunUI";

const TITLE_ID = "feedTitleText";
const SUBTITLE_ID = "feedSubtitleText";

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

/**
 * Wrapper function for nsIIOService::newURI.
 * @param aURLSpec
 *        The URL string from which to create an nsIURI.
 * @returns an nsIURI object, or null if the creation of the URI failed.
 */
function makeURI(aURLSpec, aCharset) {
  try {
    var ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
    return ioSvc.newURI(aURLSpec, aCharset, null);
  } catch (ex) {
  }

  return null;
}

/**
 * Converts a number of bytes to the appropriate unit that results in a
 * number that needs fewer than 4 digits
 *
 * @return a pair: [new value with 3 sig. figs., its unit]
  */
function convertByteUnits(aBytes) {
  var units = ["bytes", "kilobytes", "megabytes", "gigabytes"];
  var unitIndex = 0;

  // convert to next unit if it needs 4 digits (after rounding), but only if
  // we know the name of the next unit
  while ((aBytes >= 999.5) && (unitIndex < units.length - 1)) {
    aBytes /= 1024;
    unitIndex++;
  }

  // Get rid of insignificant bits by truncating to 1 or 0 decimal points
  // 0 -> 0; 1.2 -> 1.2; 12.3 -> 12.3; 123.4 -> 123; 234.5 -> 235
  aBytes = aBytes.toFixed((aBytes > 0) && (aBytes < 100) ? 1 : 0);

  return [aBytes, units[unitIndex]];
}

function FeedWriter() {
  this._ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
  this._mimeSvc = Components.classes["@mozilla.org/mime;1"]
                            .getService(Components.interfaces.nsIMIMEService);
}

FeedWriter.prototype = {
  _getPropertyAsBag: function getPropertyAsBag(container, property) {
    return container.fields.getProperty(property)
                    .QueryInterface(Components.interfaces.nsIPropertyBag2);
  },

  _getPropertyAsString: function getPropertyAsString(container, property) {
    try {
      return container.fields.getPropertyAsAString(property);
    }
    catch (e) {
    }
    return "";
  },

  _setContentText: function setContentText(id, text) {
    this._contentSandbox.element = this._document.getElementById(id);
    this._contentSandbox.textNode = this._document.createTextNode(text);
    var codeStr = "while (element.hasChildNodes()) " +
                  "  element.removeChild(element.firstChild);" +
                  "element.appendChild(textNode);";
    Components.utils.evalInSandbox(codeStr, this._contentSandbox);
    this._contentSandbox.element = null;
    this._contentSandbox.textNode = null;
  },

  /**
   * Safely sets the href attribute on an anchor tag, providing the URI
   * specified can be loaded according to rules.
   * @param   element
   *          The element to set a URI attribute on
   * @param   attribute
   *          The attribute of the element to set the URI to, e.g. href or src
   * @param   uri
   *          The URI spec to set as the href
   */
  _safeSetURIAttribute: function safeSetURIAttribute(element, attribute, uri) {
    var secman = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
                           .getService(Components.interfaces.nsIScriptSecurityManager);
    const flags = Components.interfaces.nsIScriptSecurityManager.DISALLOW_INHERIT_PRINCIPAL;
    try {
      secman.checkLoadURIStrWithPrincipal(this._feedPrincipal, uri, flags);
      // checkLoadURIStrWithPrincipal will throw if the link URI should not be
      // loaded, either because our feedURI isn't allowed to load it or per
      // the rules specified in |flags|, so we'll never "linkify" the link...
      this._contentSandbox.element = element;
      this._contentSandbox.uri = uri;
      var codeStr = "element.setAttribute('" + attribute + "', uri);";
      Components.utils.evalInSandbox(codeStr, this._contentSandbox);
    }
    catch (e) {
      // Not allowed to load this link because secman.checkLoadURIStr threw
    }
  },

  /**
   * Use this sandbox to run any dom manipulation code on nodes which
   * are already inserted into the content document.
   */
  __contentSandbox: null,
  get _contentSandbox() {
    if (!this.__contentSandbox)
      this.__contentSandbox = new Components.utils.Sandbox(this._window);

    return this.__contentSandbox;
  },

  /**
   * Calls doCommand for a the given XUL element within the context of the
   * content document.
   *
   * @param aElement
   *        the XUL element to call doCommand() on.
   */
  _safeDoCommand: function safeDoCommand(aElement) {
    this._contentSandbox.element = aElement;
    Components.utils.evalInSandbox("element.doCommand();", this._contentSandbox);
    this._contentSandbox.element = null;
  },

  __faviconService: null,
  get _faviconService() {
    if (!this.__faviconService)
      this.__faviconService = Components.classes["@mozilla.org/browser/favicon-service;1"]
                                        .getService(Components.interfaces.nsIFaviconService);

    return this.__faviconService;
  },

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

  /* Magic helper methods to be used instead of xbl properties */
  _getSelectedItemFromMenulist: function getSelectedItemFromList(aList) {
    return aList.getElementsByAttribute("selected", "true").item(0);
  },

  _setCheckboxCheckedState: function setCheckboxCheckedState(aCheckbox, aValue) {
    // see checkbox.xml, xbl bindings are not applied within the sandbox!
    this._contentSandbox.checkbox = aCheckbox;
    var codeStr;
    var change = (aValue != (aCheckbox.getAttribute('checked') == 'true'));
    if (aValue)
      codeStr = "checkbox.setAttribute('checked', 'true'); ";
    else
      codeStr = "checkbox.removeAttribute('checked'); ";

    if (change) {
      this._contentSandbox.document = this._document;
      codeStr += "var event = document.createEvent('Events'); " +
                 "event.initEvent('CheckboxStateChange', true, true);" +
                 "checkbox.dispatchEvent(event);";
    }

    Components.utils.evalInSandbox(codeStr, this._contentSandbox);
  },

   /**
   * Returns a date suitable for displaying in the feed preview.
   * If the date cannot be parsed, the return value is "null".
   * @param   dateString
   *          A date as extracted from a feed entry. (entry.updated)
   */
  _parseDate: function parseDate(dateString) {
    // Make sure the date we're given is valid.
    if (isNaN(Date.parse(dateString)))
      return null;

    // Convert the date into the user's local time zone.
    var dateObj = new Date(dateString);
    var dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                                .getService(Components.interfaces.nsIScriptableDateFormat);
    return dateService.FormatDateTime("", dateService.dateFormatLong, dateService.timeFormatNoSeconds,
                                      dateObj.getFullYear(), dateObj.getMonth()+1, dateObj.getDate(),
                                      dateObj.getHours(), dateObj.getMinutes(), dateObj.getSeconds());
  },

  /**
   * Returns the feed type.
   */
  __feedType: null,
  _getFeedType: function getFeedType() {
    if (this.__feedType != null)
      return this.__feedType;

    try {
      // grab the feed because it's got the feed.type in it.
      var container = this._getContainer();
      var feed = container.QueryInterface(Components.interfaces.nsIFeed);
      this.__feedType = feed.type;
      return feed.type;
    } catch (ex) {
    }

    return Components.interfaces.nsIFeed.TYPE_FEED;
  },

  /**
   * Maps a feed type to a maybe-feed mimetype.
   */
  _getMimeTypeForFeedType: function getMimeTypeForFeedType() {
    switch (this._getFeedType()) {
      case Components.interfaces.nsIFeed.TYPE_VIDEO:
        return TYPE_MAYBE_VIDEO_FEED;

      case Components.interfaces.nsIFeed.TYPE_AUDIO:
        return TYPE_MAYBE_AUDIO_FEED;

      default:
        return TYPE_MAYBE_FEED;
    }
  },

  /**
   * Writes the feed title into the preview document.
   * @param   container
   *          The feed container
   */
  _setTitleText: function setTitleText(container) {
    if (container.title) {
      var title = container.title.plainText();
      this._setContentText(TITLE_ID, title);
      this._contentSandbox.document = this._document;
      this._contentSandbox.title = title;
      var codeStr = "document.title = title;"
      Components.utils.evalInSandbox(codeStr, this._contentSandbox);
    }

    var feed = container.QueryInterface(Components.interfaces.nsIFeed);
    if (feed && feed.subtitle)
      this._setContentText(SUBTITLE_ID, container.subtitle.plainText());
  },

  /**
   * Writes the title image into the preview document if one is present.
   * @param   container
   *          The feed container
   */
  _setTitleImage: function setTitleImage(container) {
    try {
      var parts = container.image;

      // Set up the title image (supplied by the feed)
      var feedTitleImage = this._document.getElementById("feedTitleImage");
      this._safeSetURIAttribute(feedTitleImage, "src",
                                parts.getPropertyAsAString("url"));

      // Set up the title image link
      var feedTitleLink = this._document.getElementById("feedTitleLink");

      var titleText = this._getFormattedString("linkTitleTextFormat",
                                               [parts.getPropertyAsAString("title")]);
      this._contentSandbox.feedTitleLink = feedTitleLink;
      this._contentSandbox.titleText = titleText;
      this._contentSandbox.feedTitleText = this._document.getElementById("feedTitleText");
      this._contentSandbox.titleImageWidth = parseInt(parts.getPropertyAsAString("width")) + 15;

      // Fix the margin on the main title, so that the image doesn't run over
      // the underline
      var codeStr = "feedTitleLink.setAttribute('title', titleText); " +
                    "feedTitleText.style.MozMarginEnd = titleImageWidth + 'px';";
      Components.utils.evalInSandbox(codeStr, this._contentSandbox);
      this._contentSandbox.feedTitleLink = null;
      this._contentSandbox.titleText = null;
      this._contentSandbox.feedTitleText = null;
      this._contentSandbox.titleImageWidth = null;

      this._safeSetURIAttribute(feedTitleLink, "href",
                                parts.getPropertyAsAString("link"));
    }
    catch (e) {
      LOG("Failed to set Title Image (this is benign): " + e);
    }
  },

  /**
   * Writes all entries contained in the feed.
   * @param   container
   *          The container of entries in the feed
   */
  _writeFeedContent: function writeFeedContent(container) {
    // Build the actual feed content
    var feed = container.QueryInterface(Components.interfaces.nsIFeed);
    if (feed.items.length == 0)
      return;

    this._contentSandbox.feedContent =
      this._document.getElementById("feedContent");

    for (let i = 0; i < feed.items.length; ++i) {
      let entry = feed.items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
      entry.QueryInterface(Components.interfaces.nsIFeedContainer);

      let entryContainer = this._document.createElementNS(HTML_NS, "div");
      entryContainer.className = "entry";

      // If the entry has a title, make it a link
      if (entry.title) {
        let a = this._document.createElementNS(HTML_NS, "a");
        a.appendChild(this._document.createTextNode(entry.title.plainText()));

        // Entries are not required to have links, so entry.link can be null.
        if (entry.link)
          this._safeSetURIAttribute(a, "href", entry.link.spec);

        let title = this._document.createElementNS(HTML_NS, "h3");
        title.appendChild(a);

        let lastUpdated = this._parseDate(entry.updated);
        if (lastUpdated) {
          let dateDiv = this._document.createElementNS(HTML_NS, "div");
          dateDiv.className = "lastUpdated";
          dateDiv.textContent = lastUpdated;
          title.appendChild(dateDiv);
        }

        entryContainer.appendChild(title);
      }

      var body = this._document.createElementNS(HTML_NS, "div");
      var summary = entry.summary || entry.content;
      var docFragment = null;
      if (summary) {
        if (summary.base)
          body.setAttributeNS(XML_NS, "base", summary.base.spec);
        else
          LOG("no base?");
        docFragment = summary.createDocumentFragment(body);
        if (docFragment)
          body.appendChild(docFragment);

        // If the entry doesn't have a title, append a # permalink
        // See http://scripting.com/rss.xml for an example
        if (!entry.title && entry.link) {
          var a = this._document.createElementNS(HTML_NS, "a");
          a.appendChild(this._document.createTextNode("#"));
          this._safeSetURIAttribute(a, "href", entry.link.spec);
          body.appendChild(this._document.createTextNode(" "));
          body.appendChild(a);
        }

      }
      body.className = "feedEntryContent";
      entryContainer.appendChild(body);

      if (entry.enclosures && entry.enclosures.length > 0) {
        var enclosuresDiv = this._buildEnclosureDiv(entry);
        entryContainer.appendChild(enclosuresDiv);
      }

      this._contentSandbox.entryContainer = entryContainer;
      this._contentSandbox.clearDiv = this._document
                                          .createElementNS(HTML_NS, "div");
      this._contentSandbox.clearDiv.style.clear = "both";

      var codeStr = "feedContent.appendChild(entryContainer); " +
                    "feedContent.appendChild(clearDiv);";
      Components.utils.evalInSandbox(codeStr, this._contentSandbox);
    }

    this._contentSandbox.feedContent = null;
    this._contentSandbox.entryContainer = null;
    this._contentSandbox.clearDiv = null;
  },

  /**
   * Takes a url to a media item and returns the best name it can come up with.
   * Frequently this is the filename portion (e.g. passing in
   * http://example.com/foo.mpeg would return "foo.mpeg"), but in more complex
   * cases, this will return the entire url (e.g. passing in
   * http://example.com/somedirectory/ would return
   * http://example.com/somedirectory/).
   * @param aURL
   *        The URL string from which to create a display name
   * @returns a string
   */
  _getURLDisplayName: function getURLDisplayName(aURL) {
    var url = makeURI(aURL);

    if ((url instanceof Components.interfaces.nsIURL) && url.fileName)
      return decodeURI(url.fileName);
    return aURL;
  },

  /**
   * Takes a FeedEntry with enclosures, generates the HTML code to represent
   * them, and returns that.
   * @param   entry
   *          FeedEntry with enclosures
   * @returns element
   */
  _buildEnclosureDiv: function buildEnclosureDiv(entry) {
    var enclosuresDiv = this._document.createElementNS(HTML_NS, "div");
    enclosuresDiv.className = "enclosures";

    enclosuresDiv.appendChild(this._document.createTextNode(this._getString("mediaLabel")));

    for (let i_enc = 0; i_enc < entry.enclosures.length; ++i_enc) {
      let enc = entry.enclosures.queryElementAt(i_enc, Components.interfaces.nsIWritablePropertyBag2);

      if (!(enc.hasKey("url")))
        continue;

      let enclosureDiv = this._document.createElementNS(HTML_NS, "div");
      enclosureDiv.setAttribute("class", "enclosure");

      let mozicon = "moz-icon://.txt?size=16";
      let type_text = null;
      let size_text = null;

      if (enc.hasKey("type")) {
        type_text = enc.get("type");
        try {
          let handlerInfoWrapper = this._mimeSvc.getFromTypeAndExtension(enc.get("type"), null);

          if (handlerInfoWrapper)
            type_text = handlerInfoWrapper.description;

          if  (type_text && type_text.length > 0)
            mozicon = "moz-icon://goat?size=16&contentType=" + enc.get("type");

        } catch (ex) {
        }

      }

      if (enc.hasKey("length") && /^[0-9]+$/.test(enc.get("length"))) {
        let enc_size = convertByteUnits(parseInt(enc.get("length")));

        let size_text = this._getFormattedString("enclosureSizeText",
                             [enc_size[0], this._getString(enc_size[1])]);
      }

      let iconimg = this._document.createElementNS(HTML_NS, "img");
      iconimg.setAttribute("src", mozicon);
      iconimg.setAttribute("class", "type-icon");
      enclosureDiv.appendChild(iconimg);

      enclosureDiv.appendChild(this._document.createTextNode( " " ));

      let enc_href = this._document.createElementNS(HTML_NS, "a");
      enc_href.appendChild(this._document.createTextNode(this._getURLDisplayName(enc.get("url"))));
      this._safeSetURIAttribute(enc_href, "href", enc.get("url"));
      enclosureDiv.appendChild(enc_href);

      if (type_text && size_text)
        enclosureDiv.appendChild(this._document.createTextNode( " (" + type_text + ", " + size_text + ")"));

      else if (type_text)
        enclosureDiv.appendChild(this._document.createTextNode( " (" + type_text + ")"))

      else if (size_text)
        enclosureDiv.appendChild(this._document.createTextNode( " (" + size_text + ")"))

      enclosuresDiv.appendChild(enclosureDiv);
    }

    return enclosuresDiv;
  },

  /**
   * Gets a valid nsIFeedContainer object from the parsed nsIFeedResult.
   * Displays error information if there was one.
   * @param   result
   *          The parsed feed result
   * @returns A valid nsIFeedContainer object containing the contents of
   *          the feed.
   */
  _getContainer: function getContainer(result) {
    var feedService = Components.classes["@mozilla.org/browser/feeds/result-service;1"]
                                .getService(Components.interfaces.nsIFeedResultService);

    try {
      var result = feedService.getFeedResult(this._getOriginalURI(this._window));

      if (result.bozo) {
        LOG("Subscribe Preview: feed result is bozo?!");
      }
    }
    catch (e) {
      LOG("Subscribe Preview: feed not available?!");
    }

    try {
      var container = result.doc;
    }
    catch (e) {
      LOG("Subscribe Preview: no result.doc? Why didn't the original reload?");
      return null;
    }
    return container;
  },

  /**
   * Get the human-readable display name of a file. This could be the
   * application name.
   * @param   file
   *          A nsIFile to look up the name of
   * @returns The display name of the application represented by the file.
   */
  _getFileDisplayName: function getFileDisplayName(file) {
#ifdef XP_WIN
    if (file instanceof Components.interfaces.nsILocalFileWin) {
      try {
        return file.getVersionInfoField("FileDescription");
      }
      catch (e) {
      }
    }
#endif
#ifdef XP_MACOSX
    var lfm = file.QueryInterface(Components.interfaces.nsILocalFileMac);
    try {
      return lfm.bundleDisplayName;
    }
    catch (e) {
      // fall through to the file name
    }
#endif
    var url = this._ioSvc.newFileURI(file).QueryInterface(Components.interfaces.nsIURL);
    return url.fileName;
  },

  /**
   * Get moz-icon url for a file
   * @param   file
   *          A nsIFile object for which the moz-icon:// is returned
   * @returns moz-icon url of the given file as a string
   */
  _getFileIconURL: function getFileIconURL(file) {
    var fph = this._ioSvc.getProtocolHandler("file")
                  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    var urlSpec = fph.getURLSpecFromFile(file);
    return "moz-icon://" + urlSpec + "?size=16";
  },

  /**
   * Helper method to set the selected application and system default
   * reader menuitems details from a file object
   *   @param aMenuItem
   *          The menuitem on which the attributes should be set
   *   @param aFile
   *          The menuitem's associated file
   */
  _initMenuItemWithFile: function(aMenuItem, aFile) {
    this._contentSandbox.menuitem = aMenuItem;
    this._contentSandbox.label = this._getFileDisplayName(aFile);
    this._contentSandbox.image = this._getFileIconURL(aFile);
    var codeStr = "menuitem.setAttribute('label', label); " +
                  "menuitem.setAttribute('image', image);";
    Components.utils.evalInSandbox(codeStr, this._contentSandbox);
  },

  /**
   * Displays a prompt from which the user may choose a (client) feed reader.
   * @return - true if a feed reader was selected, false otherwise.
   */
  _chooseClientApp: function chooseClientApp() {
    try {
      var fp = Components.classes["@mozilla.org/filepicker;1"]
                         .createInstance(Components.interfaces.nsIFilePicker);
      fp.init(this._window,
              this._getString("chooseApplicationDialogTitle"),
              Components.interfaces.nsIFilePicker.modeOpen);
      fp.appendFilters(Components.interfaces.nsIFilePicker.filterApps);

      if (fp.show() == Components.interfaces.nsIFilePicker.returnOK) {
        this._selectedApp = fp.file;
        if (this._selectedApp) {
          // XXXben - we need to compare this with the running instance executable
          //          just don't know how to do that via script...
          // XXXmano TBD: can probably add this to nsIShellService
#ifdef XP_WIN
#expand           if (fp.file.leafName != "__MOZ_APP_NAME__.exe") {
#else
#ifdef XP_MACOSX
#expand           if (fp.file.leafName != "__MOZ_APP_DISPLAYNAME__.app") {
#else
#expand           if (fp.file.leafName != "__MOZ_APP_NAME__-bin") {
#endif
#endif
            this._initMenuItemWithFile(this._contentSandbox.selectedAppMenuItem,
                                       this._selectedApp);

            // Show and select the selected application menuitem
            var codeStr = "selectedAppMenuItem.hidden = false;" +
                          "selectedAppMenuItem.doCommand();";
            Components.utils.evalInSandbox(codeStr, this._contentSandbox);
            return true;
          }
        }
      }
    }
    catch(ex) {
    }

    return false;
  },

  _setAlwaysUseCheckedState: function setAlwaysUseCheckedState(feedType) {
    var checkbox = this._document.getElementById("alwaysUse");
    if (checkbox) {
      var alwaysUse = (safeGetCharPref(getPrefActionForType(feedType), "ask") != "ask");
      this._setCheckboxCheckedState(checkbox, alwaysUse);
    }
  },

  _setSubscribeUsingLabel: function setSubscribeUsingLabel() {
    var stringLabel = "subscribeFeedUsing";
    switch (this._getFeedType()) {
      case Components.interfaces.nsIFeed.TYPE_VIDEO:
        stringLabel = "subscribeVideoPodcastUsing";
        break;

      case Components.interfaces.nsIFeed.TYPE_AUDIO:
        stringLabel = "subscribeAudioPodcastUsing";
        break;
    }

    this._contentSandbox.subscribeUsing =
      this._document.getElementById("subscribeUsingDescription");
    this._contentSandbox.label = this._getString(stringLabel);
    var codeStr = "subscribeUsing.setAttribute('value', label);"
    Components.utils.evalInSandbox(codeStr, this._contentSandbox);
  },

  _setAlwaysUseLabel: function setAlwaysUseLabel() {
    var checkbox = this._document.getElementById("alwaysUse");
    if (checkbox) {
      var handlersMenuList = this._document.getElementById("handlersMenuList");
      if (handlersMenuList) {
        var handlerName = this._getSelectedItemFromMenulist(handlersMenuList)
                              .getAttribute("label");
        var stringLabel = "alwaysUseForFeeds";
        switch (this._getFeedType()) {
          case Components.interfaces.nsIFeed.TYPE_VIDEO:
            stringLabel = "alwaysUseForVideoPodcasts";
            break;

          case Components.interfaces.nsIFeed.TYPE_AUDIO:
            stringLabel = "alwaysUseForAudioPodcasts";
            break;
        }

        this._contentSandbox.checkbox = checkbox;
        this._contentSandbox.label = this._getFormattedString(stringLabel, [handlerName]);

        var codeStr = "checkbox.setAttribute('label', label);";
        Components.utils.evalInSandbox(codeStr, this._contentSandbox);
      }
    }
  },

  // nsIDomEventListener
  handleEvent: function(event) {
    // see comments in init()
    event = new XPCNativeWrapper(event);
    if (event.target.ownerDocument != this._document) {
      LOG("FeedWriter.handleEvent: Someone passed the feed writer as a listener to the events of another document!");
      return;
    }

    if (event.type == "command") {
      switch (event.target.id) {
        case "subscribeButton":
          this.subscribe();
          break;
        case "chooseApplicationMenuItem":
          /* Bug 351263: Make sure to not steal focus if the "Choose
           * Application" item is being selected with the keyboard. We do this
           * by ignoring command events while the dropdown is closed (user
           * arrowing through the combobox), but handling them while the
           * combobox dropdown is open (user pressed enter when an item was
           * selected). If we don't show the filepicker here, it will be shown
           * when clicking "Subscribe Now".
           */
          var popupbox = this._document.getElementById("handlersMenuList")
                             .firstChild.boxObject;
          popupbox.QueryInterface(Components.interfaces.nsIPopupBoxObject);
          if (popupbox.popupState == "hiding" && !this._chooseClientApp()) {
            // Select the (per-prefs) selected handler if no application was
            // selected
            this._setSelectedHandler(this._getFeedType());
          }
          break;
        default:
          this._setAlwaysUseLabel();
      }
    }
  },

  _setSelectedHandler: function setSelectedHandler(feedType) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    var handler = safeGetCharPref(getPrefReaderForType(feedType), "messenger");

    switch (handler) {
      case "web":
        var handlersMenuList = this._document.getElementById("handlersMenuList");
        if (handlersMenuList) {
          var url = prefs.getComplexValue(getPrefWebForType(feedType),
                                          Components.interfaces.nsISupportsString).data;
          var handlers = handlersMenuList.getElementsByAttribute("webhandlerurl", url);
          if (handlers.length == 0) {
            LOG("FeedWriter._setSelectedHandler: selected web handler isn't in the menulist");
            return;
          }

          this._safeDoCommand(handlers[0]);
        }
        break;
      case "client":
        try {
          this._selectedApp =
            prefs.getComplexValue(getPrefAppForType(feedType),
                                  Components.interfaces.nsILocalFile);
        }
        catch(ex) {
          this._selectedApp = null;
        }

        if (this._selectedApp) {
          this._initMenuItemWithFile(this._contentSandbox.selectedAppMenuItem,
                                     this._selectedApp);
          var codeStr = "selectedAppMenuItem.hidden = false; " +
                        "selectedAppMenuItem.doCommand(); ";

          // Only show the default reader menuitem if the default reader
          // isn't the selected application
          if (this._defaultSystemReader) {
            var shouldHide = this._defaultSystemReader.path == this._selectedApp.path;
            codeStr += "defaultHandlerMenuItem.hidden = " + shouldHide + ";";
          }
          Components.utils.evalInSandbox(codeStr, this._contentSandbox);
          break;
        }
      // fall through if this._selectedApp is null
      default:
        var messengerFeedsMenuItem = this._document.getElementById("messengerFeedsMenuItem");
        if (messengerFeedsMenuItem)
          this._safeDoCommand(messengerFeedsMenuItem);
        break;
    }
  },

  _initSubscriptionUI: function initSubscriptionUI() {
    var handlersMenuPopup = this._document.getElementById("handlersMenuPopup");
    if (!handlersMenuPopup)
      return;

    var feedType = this._getFeedType();
    var codeStr;

    // change the background
    var header = this._document.getElementById("feedHeader");
    this._contentSandbox.header = header;
    switch (feedType) {
      case Components.interfaces.nsIFeed.TYPE_VIDEO:
        codeStr = "header.className = 'videoPodcastBackground'; ";
        break;

      case Components.interfaces.nsIFeed.TYPE_AUDIO:
        codeStr = "header.className = 'audioPodcastBackground'; ";
        break;

      default:
        codeStr = "header.className = 'feedBackground'; ";
    }


    // Last-selected application
    var menuItem = this._document.createElementNS(XUL_NS, "menuitem");
    menuItem.id = "selectedAppMenuItem";
    menuItem.className = "menuitem-iconic";
    menuItem.setAttribute("handlerType", "client");
    try {
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);
      this._selectedApp = prefs.getComplexValue(getPrefAppForType(feedType),
                                                Components.interfaces.nsILocalFile);

      if (this._selectedApp.exists())
        this._initMenuItemWithFile(menuItem, this._selectedApp);
      else {
        // Hide the menuitem if the last selected application doesn't exist
        menuItem.hidden = true;
      }
    }
    catch(ex) {
      // Hide the menuitem until an application is selected
      menuItem.hidden = true;
    }
    this._contentSandbox.handlersMenuPopup = handlersMenuPopup;
    this._contentSandbox.selectedAppMenuItem = menuItem;

    codeStr += "handlersMenuPopup.appendChild(selectedAppMenuItem); ";

    menuItem = null;

#ifdef HAVE_SHELL_SERVICE
    // List the default feed reader
    try {
      this._defaultSystemReader = Components.classes["@mozilla.org/suite/shell-service;1"]
                                            .getService(Components.interfaces.nsIShellService)
                                            .defaultFeedReader;
      menuItem = this._document.createElementNS(XUL_NS, "menuitem");
      menuItem.id = "defaultHandlerMenuItem";
      menuItem.className = "menuitem-iconic";
      menuItem.setAttribute("handlerType", "client");

      this._initMenuItemWithFile(menuItem, this._defaultSystemReader);

      // Hide the default reader item if it points to the same application
      // as the last-selected application
      if (this._selectedApp &&
          this._selectedApp.path == this._defaultSystemReader.path)
        menuItem.hidden = true;
    }
    catch(ex) {
    }
#endif

    if (menuItem) {
      this._contentSandbox.defaultHandlerMenuItem = menuItem;
      codeStr += "handlersMenuPopup.appendChild(defaultHandlerMenuItem); ";
    }

    // "Choose Application..." menuitem
    menuItem = this._document.createElementNS(XUL_NS, "menuitem");
    menuItem.id = "chooseApplicationMenuItem";
    menuItem.setAttribute("label", this._getString("chooseApplicationMenuItem"));

    this._contentSandbox.chooseAppMenuItem = menuItem;
    codeStr += "handlersMenuPopup.appendChild(chooseAppMenuItem); ";

    // separator
    this._contentSandbox.chooseAppSep = this._document
                                            .createElementNS(XUL_NS, "menuseparator");
    codeStr += "handlersMenuPopup.appendChild(chooseAppSep); ";

    Components.utils.evalInSandbox(codeStr, this._contentSandbox);

    var historySvc = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                               .getService(Components.interfaces.nsINavHistoryService);
    historySvc.addObserver(this, false);

    // List of web handlers
    var wccr = Components.classes["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"]
                         .getService(Components.interfaces.nsIWebContentConverterService);
    var handlers = wccr.getContentHandlers(this._getMimeTypeForFeedType(feedType), {});
    if (handlers.length != 0) {
      for (let i = 0; i < handlers.length; ++i) {
        menuItem = this._document.createElementNS(XUL_NS, "menuitem");
        menuItem.className = "menuitem-iconic";
        menuItem.setAttribute("label", handlers[i].name);
        menuItem.setAttribute("handlerType", "web");
        menuItem.setAttribute("webhandlerurl", handlers[i].uri);
        this._contentSandbox.menuItem = menuItem;
        codeStr = "handlersMenuPopup.appendChild(menuItem);";
        Components.utils.evalInSandbox(codeStr, this._contentSandbox);

        let uri = makeURI(handlers[i].uri);
        if (!this._setFaviconForWebReader(uri, menuItem)) {
          if (uri && /^https?/.test(uri.scheme)) {
            let iconURL = makeURI(uri.resolve("/favicon.ico"));
            this._faviconService.setAndLoadFaviconForPage(uri, iconURL, true);
          }
        }
      }
      this._contentSandbox.menuItem = null;
    }

    this._setSelectedHandler(feedType);

    // "Subscribe using..."
    this._setSubscribeUsingLabel();

    // "Always use..." checkbox initial state
    this._setAlwaysUseCheckedState(feedType);
    this._setAlwaysUseLabel();

    // We update the "Always use.." checkbox label whenever the selected item
    // in the list is changed
    handlersMenuPopup.addEventListener("command", this, false);

    // Set up the "Subscribe Now" button
    this._document
        .getElementById("subscribeButton")
        .addEventListener("command", this, false);

    // first-run ui
    var showFirstRunUI = true;
    try {
      showFirstRunUI = prefs.getBoolPref(PREF_SHOW_FIRST_RUN_UI);
    }
    catch (ex) {
    }
    if (showFirstRunUI) {
      var textfeedinfo1, textfeedinfo2;
      switch (feedType) {
        case Components.interfaces.nsIFeed.TYPE_VIDEO:
          textfeedinfo1 = "feedSubscriptionVideoPodcast1";
          textfeedinfo2 = "feedSubscriptionVideoPodcast2";
          break;
        case Components.interfaces.nsIFeed.TYPE_AUDIO:
          textfeedinfo1 = "feedSubscriptionAudioPodcast1";
          textfeedinfo2 = "feedSubscriptionAudioPodcast2";
          break;
        default:
          textfeedinfo1 = "feedSubscriptionFeed1";
          textfeedinfo2 = "feedSubscriptionFeed2";
      }

      this._contentSandbox.feedinfo1 =
        this._document.getElementById("feedSubscriptionInfo1");
      this._contentSandbox.feedinfo1Str = this._getString(textfeedinfo1);
      this._contentSandbox.feedinfo2 =
        this._document.getElementById("feedSubscriptionInfo2");
      this._contentSandbox.feedinfo2Str = this._getString(textfeedinfo2);
      this._contentSandbox.header = header;
      codeStr = "feedinfo1.textContent = feedinfo1Str; " +
                "feedinfo2.textContent = feedinfo2Str; " +
                "header.setAttribute('firstrun', 'true');";
      Components.utils.evalInSandbox(codeStr, this._contentSandbox);
      prefs.setBoolPref(PREF_SHOW_FIRST_RUN_UI, false);
    }
  },

  /**
   * Returns the original URI object of the feed and ensures that this
   * component is only ever invoked from the preview document.
   * @param aWindow
   *        The window of the document invoking the BrowserFeedWriter
   */
  _getOriginalURI: function getOriginalURI(aWindow) {
    var chan = aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                      .getInterface(Components.interfaces.nsIWebNavigation)
                      .QueryInterface(Components.interfaces.nsIDocShell)
                      .currentDocumentChannel;

    var uri = makeURI(SUBSCRIBE_PAGE_URI);
    var resolvedURI = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                                .getService(Components.interfaces.nsIChromeRegistry)
                                .convertChromeURL(uri);

    if (resolvedURI.equals(chan.URI))
      return chan.originalURI;

    return null;
  },

  _window: null,
  _document: null,
  _feedURI: null,
  _feedPrincipal: null,

  // nsIFeedWriter
  init: function init(aWindow) {
    // Explicitly wrap |window| in an XPCNativeWrapper to make sure
    // it's a real native object! This will throw an exception if we
    // get a non-native object.
    var window = new XPCNativeWrapper(aWindow);
    this._feedURI = this._getOriginalURI(window);
    if (!this._feedURI)
      return;

    this._window = window;
    this._document = window.document;

    var secman = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
                           .getService(Components.interfaces.nsIScriptSecurityManager);
    this._feedPrincipal = secman.getCodebasePrincipal(this._feedURI);

    LOG("Subscribe Preview: feed uri = " + this._window.location.href);

    // Set up the subscription UI
    this._initSubscriptionUI();
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch2);
    prefs.addObserver(PREF_SELECTED_ACTION, this, false);
    prefs.addObserver(PREF_SELECTED_READER, this, false);
    prefs.addObserver(PREF_SELECTED_WEB, this, false);
    prefs.addObserver(PREF_SELECTED_APP, this, false);
    prefs.addObserver(PREF_VIDEO_SELECTED_ACTION, this, false);
    prefs.addObserver(PREF_VIDEO_SELECTED_READER, this, false);
    prefs.addObserver(PREF_VIDEO_SELECTED_WEB, this, false);
    prefs.addObserver(PREF_VIDEO_SELECTED_APP, this, false);

    prefs.addObserver(PREF_AUDIO_SELECTED_ACTION, this, false);
    prefs.addObserver(PREF_AUDIO_SELECTED_READER, this, false);
    prefs.addObserver(PREF_AUDIO_SELECTED_WEB, this, false);
    prefs.addObserver(PREF_AUDIO_SELECTED_APP, this, false);
  },

  writeContent: function writeContent() {
    if (!this._window)
      return;

    try {
      // Set up the feed content
      var container = this._getContainer();
      if (!container)
        return;

      this._setTitleText(container);
      this._setTitleImage(container);
      this._writeFeedContent(container);
    }
    finally {
      this._removeFeedFromCache();
    }
  },

  close: function close() {
    this._document
        .getElementById("handlersMenuPopup")
        .removeEventListener("command", this, false);
    this._document
        .getElementById("subscribeButton")
        .removeEventListener("command", this, false);
    this._document = null;
    this._window = null;
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch2);
    prefs.removeObserver(PREF_SELECTED_ACTION, this);
    prefs.removeObserver(PREF_SELECTED_READER, this);
    prefs.removeObserver(PREF_SELECTED_WEB, this);
    prefs.removeObserver(PREF_SELECTED_APP, this);
    prefs.removeObserver(PREF_VIDEO_SELECTED_ACTION, this);
    prefs.removeObserver(PREF_VIDEO_SELECTED_READER, this);
    prefs.removeObserver(PREF_VIDEO_SELECTED_WEB, this);
    prefs.removeObserver(PREF_VIDEO_SELECTED_APP, this);

    prefs.removeObserver(PREF_AUDIO_SELECTED_ACTION, this);
    prefs.removeObserver(PREF_AUDIO_SELECTED_READER, this);
    prefs.removeObserver(PREF_AUDIO_SELECTED_WEB, this);
    prefs.removeObserver(PREF_AUDIO_SELECTED_APP, this);

    this._removeFeedFromCache();
    this.__faviconService = null;
    this.__bundle = null;
    this._feedURI = null;
    this.__contentSandbox = null;

    var historySvc = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                               .getService(Components.interfaces.nsINavHistoryService);
    historySvc.removeObserver(this);
  },

  _removeFeedFromCache: function removeFeedFromCache() {
    if (this._feedURI) {
      var feedService = Components.classes["@mozilla.org/browser/feeds/result-service;1"]
                                  .getService(Components.interfaces.nsIFeedResultService);
      feedService.removeFeedResult(this._feedURI);
      this._feedURI = null;
    }
  },

  subscribe: function subscribe() {
    var feedType = this._getFeedType();

    // Subscribe to the feed using the selected handler and save prefs
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    var defaultHandler = "reader";
    var useAsDefault = this._document.getElementById("alwaysUse")
                                     .getAttribute("checked");

    var handlersMenuList = this._document.getElementById("handlersMenuList");
    var selectedItem = this._getSelectedItemFromMenulist(handlersMenuList);

    // Show the file picker before subscribing if the
    // choose application menuitem was chosen using the keyboard
    if (selectedItem.id == "chooseApplicationMenuItem") {
      if (!this._chooseClientApp())
        return;

      selectedItem = this._getSelectedItemFromMenulist(handlersMenuList);
    }

    if (selectedItem.hasAttribute("webhandlerurl")) {
      var webURI = selectedItem.getAttribute("webhandlerurl");
      prefs.setCharPref(getPrefReaderForType(feedType), "web");

      var supportsString = Components.classes["@mozilla.org/supports-string;1"]
                                     .createInstance(Components.interfaces.nsISupportsString);
      supportsString.data = webURI;
      prefs.setComplexValue(getPrefWebForType(feedType), Components.interfaces.nsISupportsString,
                            supportsString);

      var wccr = Components.classes["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"]
                           .getService(Components.interfaces.nsIWebContentConverterService);
      var handler = wccr.getWebContentHandlerByURI(this._getMimeTypeForFeedType(feedType), webURI);
      if (handler) {
        if (useAsDefault)
          wccr.setAutoHandler(this._getMimeTypeForFeedType(feedType), handler);

        this._window.location.href = handler.getHandlerURI(this._window.location.href);
        return;
      }
    }
    else {
      switch (selectedItem.id) {
        case "selectedAppMenuItem":
          prefs.setComplexValue(getPrefAppForType(feedType), Components.interfaces.nsILocalFile,
                                this._selectedApp);
          prefs.setCharPref(getPrefReaderForType(feedType), "client");
          break;
        case "defaultHandlerMenuItem":
          prefs.setComplexValue(getPrefAppForType(feedType), Components.interfaces.nsILocalFile,
                                this._defaultSystemReader);
          prefs.setCharPref(getPrefReaderForType(feedType), "client");
          break;
        case "messengerFeedsMenuItem":
          defaultHandler = "messenger";
          prefs.setCharPref(getPrefReaderForType(feedType), "messenger");
          break;
      }
      var feedService = Components.classes["@mozilla.org/browser/feeds/result-service;1"]
                                  .getService(Components.interfaces.nsIFeedResultService);

      // Pull the title and subtitle out of the document
      var feedTitle = this._document.getElementById(TITLE_ID).textContent;
      var feedSubtitle = this._document.getElementById(SUBTITLE_ID).textContent;
      feedService.addToClientReader(this._window.location.href, feedTitle, feedSubtitle, feedType);
    }

    // If "Always use..." is checked, we should set PREF_*SELECTED_ACTION
    // to either "reader" (If a web reader or if an application is selected),
    // or to "messenger" (if the messenger feeds option is selected).
    // Otherwise, we should set it to "ask"
    if (useAsDefault)
      prefs.setCharPref(getPrefActionForType(feedType), defaultHandler);
    else
      prefs.setCharPref(getPrefActionForType(feedType), "ask");
  },

  // nsIObserver
  observe: function observe(subject, topic, data) {
    // see init()
    subject = new XPCNativeWrapper(subject);

    if (!this._window) {
      // this._window is null unless this.init was called with a trusted
      // window object.
      return;
    }

    var feedType = this._getFeedType();

    if (topic == "nsPref:changed") {
      switch (data) {
        case PREF_SELECTED_READER:
        case PREF_SELECTED_WEB:
        case PREF_SELECTED_APP:
        case PREF_VIDEO_SELECTED_READER:
        case PREF_VIDEO_SELECTED_WEB:
        case PREF_VIDEO_SELECTED_APP:
        case PREF_AUDIO_SELECTED_READER:
        case PREF_AUDIO_SELECTED_WEB:
        case PREF_AUDIO_SELECTED_APP:
          this._setSelectedHandler(feedType);
          break;
        case PREF_SELECTED_ACTION:
        case PREF_VIDEO_SELECTED_ACTION:
        case PREF_AUDIO_SELECTED_ACTION:
          this._setAlwaysUseCheckedState(feedType);
      }
    }
  },

  /**
   * Sets the icon for the given web-reader item in the readers menu
   * if the favicon-service has the necessary icon stored.
   * @param aURI
   *        the reader URI.
   * @param aMenuItem
   *        the reader item in the readers menulist.
   * @return true if the icon was set, false otherwise.
   */
  _setFaviconForWebReader: function setFaviconForWebReader(aURI, aMenuItem) {
    var faviconsSvc = this._faviconService;
    var faviconURI = null;
    try {
      faviconURI = faviconsSvc.getFaviconForPage(aURI);
    }
    catch(ex) {
    }

    if (faviconURI) {
      var dataURL = faviconsSvc.getFaviconDataAsDataURL(faviconURI);
      if (dataURL) {
        this._contentSandbox.menuItem = aMenuItem;
        this._contentSandbox.dataURL = dataURL;
        var codeStr = "menuItem.setAttribute('image', dataURL);";
        Components.utils.evalInSandbox(codeStr, this._contentSandbox);
        this._contentSandbox.menuItem = null;
        this._contentSandbox.dataURL = null;

        return true;
      }
    }

    return false;
  },

   // nsINavHistoryService
   onPageChanged: function onPageChanged(aURI, aWhat, aValue) {
     // see init()
     aURI = new XPCNativeWrapper(aURI);

     if (aWhat == Components.interfaces.nsINavHistoryObserver.ATTRIBUTE_FAVICON) {
       // Go through the readers menu and look for the corresponding
       // reader menu-item for the page if any.
       var spec = aURI.spec;
       var handlersMenulist = this._document.getElementById("handlersMenuList");
       var possibleHandlers = handlersMenulist.firstChild.childNodes;
       for (let i=0; i < possibleHandlers.length ; i++) {
         if (possibleHandlers[i].getAttribute("webhandlerurl") == spec) {
           this._setFaviconForWebReader(aURI, possibleHandlers[i]);
           return;
         }
       }
     }
   },

   onBeginUpdateBatch: function() { },
   onEndUpdateBatch: function() { },
   onVisit: function() { },
   onTitleChanged: function() { },
   onDeleteURI: function() { },
   onClearHistory: function() { },
   onPageExpired: function() { },

  // nsIClassInfo
  getInterfaces: function getInterfaces(countRef) {
    var interfaces = [Components.interfaces.nsIFeedWriter,
                       Components.interfaces.nsIClassInfo,
                       Components.interfaces.nsISupports];
    countRef.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(language) null,
  contractID: "@mozilla.org/browser/feeds/result-writer;1",
  classDescription: "Feed Writer",
  classID: Components.ID("{49bb6593-3aff-4eb3-a068-2712c28bd58e}"),
  implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Components.interfaces.nsIClassInfo.DOM_OBJECT,
  _xpcom_categories: [{ category: "JavaScript global constructor",
                        entry: "BrowserFeedWriter"}],
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIFeedWriter,
                                          Components.interfaces.nsIClassInfo,
                                          Components.interfaces.nsIDOMEventListener,
                                          Components.interfaces.nsINavHistoryObserver,
                                          Components.interfaces.nsIObserver])

};

function NSGetModule(cm, file) {
  return XPCOMUtils.generateModule([FeedWriter]);
}
