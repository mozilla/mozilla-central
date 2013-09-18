/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function LOG(str) {
  dump("*** " + str + "\n");
}

__defineGetter__("PlacesUtils", function() {
  delete this.PlacesUtils
  var tmpScope = {};
  Components.utils.import("resource://gre/modules/PlacesUtils.jsm", tmpScope);
  return this.PlacesUtils = tmpScope.PlacesUtils;
});

const LOAD_IN_SIDEBAR_ANNO = "bookmarkProperties/loadInSidebar";
const DESCRIPTION_ANNO = "bookmarkProperties/description";
const LMANNO_FEEDURI = "livemark/feedURI";
const LMANNO_SITEURI = "livemark/siteURI";
const ORGANIZER_FOLDER_ANNO = "PlacesOrganizer/OrganizerFolder";
const ORGANIZER_QUERY_ANNO = "PlacesOrganizer/OrganizerQuery";
const ORGANIZER_LEFTPANE_VERSION = 4;

#ifdef XP_MACOSX
// On Mac OSX, the transferable system converts "\r\n" to "\n\n", where we
// really just want "\n".
const NEWLINE= "\n";
#else
// On other platforms, the transferable system converts "\r\n" to "\n".
const NEWLINE = "\r\n";
#endif

function QI_node(aNode, aIID) {
  return aNode.QueryInterface(aIID);
}
function asVisit(aNode)    {
  return QI_node(aNode, Components.interfaces.nsINavHistoryVisitResultNode);
}
function asFullVisit(aNode){
  return QI_node(aNode, Components.interfaces.nsINavHistoryFullVisitResultNode);
}
function asContainer(aNode){
  return QI_node(aNode, Components.interfaces.nsINavHistoryContainerResultNode);
}
function asQuery(aNode)    {
  return QI_node(aNode, Components.interfaces.nsINavHistoryQueryResultNode);
}

var PlacesUIUtils = {
  get RDF() {
    delete this.RDF;
    return this.RDF = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                                .getService(Components.interfaces.nsIRDFService);
  },

  get localStore() {
    delete this.localStore;
    return this.localStore = this.RDF.GetDataSource("rdf:local-store");
  },

  get clipboard() {
    delete this.clipboard;
    return this.clipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
                                      .getService(Components.interfaces.nsIClipboard);
  },

  get URIFixup() {
    delete this.URIFixup;
    return this.URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                                     .getService(Components.interfaces.nsIURIFixup);
  },

  get ellipsis() {
    delete this.ellipsis;
    return this.ellipsis =
      Services.prefs.getComplexValue("intl.ellipsis", Components.interfaces.nsIPrefLocalizedString).data;
  },

  /**
   * Makes a URI from a spec, and do fixup
   * @param   aSpec
   *          The string spec of the URI
   * @returns A URI object for the spec.
   */
  createFixedURI: function PU_createFixedURI(aSpec) {
    return this.URIFixup.createFixupURI(aSpec, 0);
  },

  /**
   * Wraps a string in a nsISupportsString wrapper
   * @param   aString
   *          The string to wrap
   * @returns A nsISupportsString object containing a string.
   */
  _wrapString: function PU__wrapString(aString) {
    var s = Components.classes["@mozilla.org/supports-string;1"]
                      .createInstance(Components.interfaces.nsISupportsString);
    s.data = aString;
    return s;
  },

  /**
   * String bundle helpers
   */
  get _bundle() {
    const PLACES_STRING_BUNDLE_URI =
        "chrome://communicator/locale/history/places.properties";
    delete this._bundle;
    return this._bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                    .getService(Components.interfaces.nsIStringBundleService)
                                    .createBundle(PLACES_STRING_BUNDLE_URI);
  },

  getFormattedString: function PU_getFormattedString(key, params) {
    return this._bundle.formatStringFromName(key, params, params.length);
  },

  getString: function PU_getString(key) {
    return this._bundle.GetStringFromName(key);
  },

  /**
   * Returns the closet ancestor places view for the given DOM node
   * @param aNode
   *        a DOM node
   * @return the closet ancestor places view if exists, null otherwsie.
   */
  getViewForNode: function PU_getViewForNode(aNode) {
    var node = aNode;

    // the view for a <menu> of which its associated menupopup is a places view,
    // is the menupopup
    if (node.localName == "menu" && !node.node &&
        node.firstChild.getAttribute("type") == "places")
      return node.firstChild;

    while (node) {
      // XXXmano: Use QueryInterface(nsIPlacesView) once we implement it...
      if (node.getAttribute("type") == "places")
        return node;

      node = node.parentNode;
    }

    return null;
  },

  /**
   * By calling this before visiting an URL, the visit will be associated to a
   * TRANSITION_TYPED transition (if there is no a referrer).
   * This is used when visiting pages from the history menu, history sidebar,
   * url bar, url autocomplete results, and history searches from the places
   * organizer.  If this is not called visits will be marked as
   * TRANSITION_LINK.
   */
  markPageAsTyped: function PU_markPageAsTyped(aURL) {
    PlacesUtils.history.markPageAsTyped(this.createFixedURI(aURL));
  },

  /**
   * By calling this before visiting an URL, any visit in frames will be
   * associated to a TRANSITION_FRAMED_LINK transition.
   * This is actually used to distinguish user-initiated visits in frames
   * so automatic visits can be correctly ignored.
   */
  markPageAsFollowedLink: function PU_markPageAsUserClicked(aURL) {
    PlacesUtils.history.markPageAsFollowedLink(this.createFixedURI(aURL));
  },

  /**
   * Allows opening of javascript/data URI only if the given node is
   * bookmarked (see bug 224521).
   * @param aURINode
   *        a URI node
   * @return true if it's safe to open the node in the browser, false otherwise.
   *
   */
  checkURLSecurity: function PU_checkURLSecurity(aURINode) {
    var uri = PlacesUtils._uri(aURINode.uri);
    if (uri.schemeIs("javascript") || uri.schemeIs("data")) {
      const BRANDING_BUNDLE_URI = "chrome://branding/locale/brand.properties";
      var brandShortName = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                     .getService(Components.interfaces.nsIStringBundleService)
                                     .createBundle(BRANDING_BUNDLE_URI)
                                     .GetStringFromName("brandShortName");
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Components.interfaces.nsIPromptService);

      var errorStr = this.getString("load-js-data-url-error");
      promptService.alert(window, brandShortName, errorStr);
      return false;
    }
    return true;
  },

  /**
   * Gives the user a chance to cancel loading lots of tabs at once
   */
  _confirmOpenInTabs: function PU__confirmOpenInTabs(numTabsToOpen) {
    const kWarnOnOpenPref = "browser.tabs.warnOnOpen";
    var reallyOpen = true;
    if (Services.prefs.getBoolPref(kWarnOnOpenPref)) {
      if (numTabsToOpen >= Services.prefs.getIntPref("browser.tabs.maxOpenBeforeWarn")) {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                      .getService(Components.interfaces.nsIPromptService);

        // default to true: if it were false, we wouldn't get this far
        var warnOnOpen = { value: true };

        var messageKey = "tabs.openWarningMultipleBranded";
        var openKey = "tabs.openButtonMultiple";
        const BRANDING_BUNDLE_URI = "chrome://branding/locale/brand.properties";
        var brandShortName = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                       .getService(Components.interfaces.nsIStringBundleService)
                                       .createBundle(BRANDING_BUNDLE_URI)
                                       .GetStringFromName("brandShortName");

        var buttonPressed = promptService.confirmEx(window,
          this.getString("tabs.openWarningTitle"),
          this.getFormattedString(messageKey, [numTabsToOpen, brandShortName]),
          (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0)
           + (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
          this.getString(openKey), null, null,
          this.getFormattedString("tabs.openWarningPromptMeBranded",
                                  [brandShortName]), warnOnOpen);

        reallyOpen = (buttonPressed == 0);
        // don't set the pref unless they press OK and it's false
        if (reallyOpen && !warnOnOpen.value)
          Services.prefs.setBoolPref(kWarnOnOpenPref, false);
      }
    }
    return reallyOpen;
  },

  openContainerNodeInTabs: function PU_openContainerInTabs(aNode, aEvent) {
    var urlsToOpen = PlacesUtils.getURLsForContainerNode(aNode);
    if (!this._confirmOpenInTabs(urlsToOpen.length))
      return;

    urlsToOpen = urlsToOpen.map(function(item) { return item.uri; });
    openUILinkArrayIn(urlsToOpen, whereToOpenLink(aEvent, false, true));
  },

  openURINodesInTabs: function PU_openURINodesInTabs(aNodes, aEvent) {
    this.openSelectionIn(aNodes, whereToOpenLink(aEvent, false, true));
  },

  openSelectionIn: function PU_openSelectionIn(aNodes, aWhere) {
    var urlsToOpen = [];
    for (var i = 0; i < aNodes.length; i++) {
      if (PlacesUtils.nodeIsURI(aNodes[i]))
        urlsToOpen.push(aNodes[i].uri);
    }
    openUILinkArrayIn(urlsToOpen, aWhere);
  },

  /**
   * Loads the node's URL in the appropriate tab or window or as a web
   * panel given the user's preference specified by modifier keys tracked by a
   * DOM mouse/key event.
   * @param   aNode
   *          An uri result node.
   * @param   aEvent
   *          The DOM mouse/key event with modifier keys set that track the
   *          user's preferred destination window or tab.
   */
  openNodeWithEvent: function PU_openNodeWithEvent(aNode, aEvent) {
    this.openNodeIn(aNode, whereToOpenLink(aEvent, false, true));
  },

  /**
   * Loads the node's URL in the appropriate tab or window or as a
   * web panel.
   * see also openUILinkIn
   */
  openNodeIn: function PU_openNodeIn(aNode, aWhere) {
    if (aNode && aWhere) {
      if (PlacesUtils.nodeIsContainer(aNode)) {
        if (aWhere != "current")
          this.openContainerNodeInTabs(aNode, aWhere);
      } else if (this.checkURLSecurity(aNode)) {
        this.markPageAsTyped(aNode.uri);
        openUILinkIn(aNode.uri, aWhere);
      }
    }
  },

  getBestTitle: function PU_getBestTitle(aNode) {
    var title;
    if (!aNode.title && PlacesUtils.uriTypes.indexOf(aNode.type) != -1) {
      // if node title is empty, try to set the label using host and filename
      // PlacesUtils._uri() will throw if aNode.uri is not a valid URI
      try {
        var uri = PlacesUtils._uri(aNode.uri);
        var host = uri.host;
        var fileName = uri.QueryInterface(Components.interfaces.nsIURL).fileName;
        // if fileName is empty, use path to distinguish labels
        title = host + (fileName ?
                        (host ? "/" + this.ellipsis + "/" : "") + fileName :
                        uri.path);
      }
      catch (e) {
        // Use (no title) for non-standard URIs (data:, javascript:, ...)
        title = "";
      }
    }
    else
      title = aNode.title;

    return title || this.getString("noTitle");
  },
};
