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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   smorrison@gte.com
 *   Terry Hayes <thayes@netscape.com>
 *   Daniel Brooks <db48x@yahoo.com>
 *   Florian QUEZE <f.qu@queze.net>
 *   Erik Fabert <jerfa@yahoo.com>
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

//******** define a js object to implement nsITreeView
function pageInfoTreeView(columnids, copycol)
{
  // columnids is an array of strings indicating the names of the columns, in order
  this.columnids = columnids;
  this.colcount = columnids.length;

  // copycol is the index number for the column that we want to add to
  // the copy-n-paste buffer when the user hits accel-c
  this.copycol = copycol;
  this.rows = 0;
  this.tree = null;
  this.data = [ ];
  this.selection = null;
  this.sortcol = null;
  this.sortdir = 0;
}

pageInfoTreeView.prototype = {
  get rowCount() { return this.rows; },

  setTree: function(tree)
  {
    this.tree = tree;
  },

  getCellText: function(row, column)
  {
    // row can be null, but js arrays are 0-indexed.
    // colidx cannot be null, but can be larger than the number
    // of columns in the array (when column is a string not in
    // this.columnids.) In this case it's the fault of
    // whoever typoed while calling this function.
    return this.data[row][column.index] || "";
  },

  setCellValue: function(row, column, value)
  {
  },

  setCellText: function(row, column, value)
  {
    this.data[row][column.index] = value;
  },

  addRow: function(row)
  {
    this.rows = this.data.push(row);
    this.rowCountChanged(this.rows - 1, 1);
  },

  rowCountChanged: function(index, count)
  {
    this.tree.rowCountChanged(index, count);
  },

  invalidate: function()
  {
    this.tree.invalidate();
  },

  clear: function()
  {
    var oldrows = this.rows;
    this.rows = 0;
    this.data = [];

    if (this.tree)
      this.tree.rowCountChanged(0, -oldrows);
  },

  handleCopy: function(row)
  {
    return (row < 0 || this.copycol < 0) ? "" : (this.data[row][this.copycol] || "");
  },

  performActionOnRow: function(action, row)
  {
    if (action == "copy") {
      var data = this.handleCopy(row)
      this.tree.treeBody.parentNode.setAttribute("copybuffer", data);
    }
  },

  getRowProperties: function(row, prop) { },
  getCellProperties: function(row, column, prop) { },
  getColumnProperties: function(column, prop) { },
  isContainer: function(index) { return false; },
  isContainerOpen: function(index) { return false; },
  isSeparator: function(index) { return false; },
  isSorted: function() { },
  canDrop: function(index, orientation) { return false; },
  drop: function(row, orientation) { return false; },
  getParentIndex: function(index) { return -1; },
  hasNextSibling: function(index, after) { return false; },
  getLevel: function(index) { return 0; },
  getImageSrc: function(row, column) { },
  getProgressMode: function(row, column) { },
  getCellValue: function(row, column) { },
  toggleOpenState: function(index) { },
  cycleHeader: function(col) { },
  selectionChanged: function() { },
  cycleCell: function(row, column) { },
  isEditable: function(row, column) { return false; },
  isSelectable: function(row, column) { return false; },
  performAction: function(action) { },
  performActionOnCell: function(action, row, column) { }
};

// mmm, yummy. global variables.
var gWindow = null;
var gDocument = null;

// column number to help using the data array
const COL_IMAGE_ADDRESS = 0;
const COL_IMAGE_TYPE    = 1;
const COL_IMAGE_SIZE    = 2;
const COL_IMAGE_ALT     = 3;
const COL_IMAGE_COUNT   = 4;
const COL_IMAGE_NODE    = 5;
const COL_IMAGE_BG      = 6;

// column number to copy from, second argument to pageInfoTreeView's constructor
const COPYCOL_NONE = -1;
const COPYCOL_META_CONTENT = 1;
const COPYCOL_FORM_ACTION = 2;
const COPYCOL_FIELD_VALUE = 3;
const COPYCOL_LINK_ADDRESS = 1;
const COPYCOL_IMAGE = COL_IMAGE_ADDRESS;

// one nsITreeView for each tree in the window
var gMetaView = new pageInfoTreeView(["meta-name", "meta-content"], COPYCOL_META_CONTENT);
var gFormView = new pageInfoTreeView(["form-name", "form-method", "form-action"], COPYCOL_FORM_ACTION);
var gFieldView = new pageInfoTreeView(["field-label", "field-field", "field-type", "field-value"], COPYCOL_FIELD_VALUE);
var gLinkView = new pageInfoTreeView(["link-name", "link-address", "link-type", "link-target", "link-accesskey"], COPYCOL_LINK_ADDRESS);
var gImageView = new pageInfoTreeView(["image-address", "image-type", "image-size",
                                       "image-alt", "image-count", "image-node", "image-bg"],
                                      COPYCOL_IMAGE);

const ATOM_CONTRACTID = "@mozilla.org/atom-service;1";
var gBrokenAtom = Components.classes[ATOM_CONTRACTID]
                            .getService(Components.interfaces.nsIAtomService)
                            .getAtom("broken");

gImageView.getCellProperties = function(row, col, props) {
  if (gImageView.data[row][COL_IMAGE_SIZE] == gStrings.unknown &&
      !/^https:/.test(gImageView.data[row][COL_IMAGE_ADDRESS]))
    props.AppendElement(gBrokenAtom);
};

var gImageHash = { };

// localized strings (will be filled in when the document is loaded)
// this isn't all of them, these are just the ones that would otherwise have been loaded inside a loop
var gStrings = { };
var gBundle;

const DRAGSERVICE_CONTRACTID    = "@mozilla.org/widget/dragservice;1";
const TRANSFERABLE_CONTRACTID   = "@mozilla.org/widget/transferable;1";
const ARRAY_CONTRACTID          = "@mozilla.org/supports-array;1";
const STRING_CONTRACTID         = "@mozilla.org/supports-string;1";
const PERMISSION_CONTRACTID     = "@mozilla.org/permissionmanager;1";
const PREFERENCES_CONTRACTID    = "@mozilla.org/preferences-service;1";

// a number of services I'll need later
// the cache services
const nsICacheService = Components.interfaces.nsICacheService;
const ACCESS_READ     = Components.interfaces.nsICache.ACCESS_READ;
const cacheService = Components.classes["@mozilla.org/network/cache-service;1"].getService(nsICacheService);
var httpCacheSession = cacheService.createSession("HTTP", 0, true);
httpCacheSession.doomEntriesIfExpired = false;
var ftpCacheSession = cacheService.createSession("FTP", 0, true);
ftpCacheSession.doomEntriesIfExpired = false;

const nsICookiePermission  = Components.interfaces.nsICookiePermission;
const nsIPermissionManager = Components.interfaces.nsIPermissionManager;

const nsICertificateDialogs = Components.interfaces.nsICertificateDialogs;
const CERTIFICATEDIALOGS_CONTRACTID = "@mozilla.org/nsCertificateDialogs;1"

// clipboard helper
try {
  const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
}
catch(e) {
  // do nothing, later code will handle the error
}

// Interface for image loading content
const nsIImageLoadingContent = Components.interfaces.nsIImageLoadingContent;

// namespaces, don't need all of these yet...
const XLinkNS  = "http://www.w3.org/1999/xlink";
const XULNS    = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const XMLNS    = "http://www.w3.org/XML/1998/namespace";
const XHTMLNS  = "http://www.w3.org/1999/xhtml";
const XHTML2NS = "http://www.w3.org/2002/06/xhtml2"

const XHTMLNSre  = "^http\:\/\/www\.w3\.org\/1999\/xhtml$";
const XHTML2NSre = "^http\:\/\/www\.w3\.org\/2002\/06\/xhtml2$";
const XHTMLre = RegExp(XHTMLNSre + "|" + XHTML2NSre, "");

/* Overlays register functions here.
 * These arrays are used to hold callbacks that Page Info will call at
 * various stages. Use them by simply appending a function to them.
 * For example, add a function to onLoadRegistry by invoking
 *   "onLoadRegistry.push(XXXLoadFunc);"
 * The XXXLoadFunc should be unique to the overlay module, and will be
 * invoked as "XXXLoadFunc();"
 */

// These functions are called once when the Page Info window is opened.
var onLoadRegistry = [ ];

// These are called once for each subframe of the target document and
// the target document itself. The frame is passed as an argument.
var onProcessFrame = [ ];

// These functions are called once for each element (in all subframes, if any)
// in the target document. The element is passed as an argument.
var onProcessElement = [ ];

// These functions are called once when all the elements in all of the target
// document (and all of it's subframes, if any) have been processed
var onFinished = [ ];

// These functions are called once when the Page Info window is closed.
var onUnloadRegistry = [ ];


/* Called when PageInfo window is loaded.  Arguments are:
 *  window.arguments[0] - (optional) an object consisting of
 *                         - doc: (optional) document to use for source. if not provided,
 *                                the calling window's document will be used
 *                         - initialTab: (optional) id of the inital tab to display
 */
function onLoadPageInfo()
{
  gBundle = document.getElementById("pageinfobundle");
  var strNames = ["unknown", "notSet", "mediaImg", "mediaBGImg",
                  "mediaObject", "mediaEmbed", "mediaLink", "mediaInput",
                  "formTitle", "formUntitled", "formDefaultTarget",
                  "formChecked", "formUnchecked", "formPassword", "linkAnchor",
                  "linkArea", "linkSubmission", "linkSubmit", "linkRel",
                  "linkStylesheet", "linkRev", "linkX", "linkScript",
                  "linkScriptInline", "yes"];
  strNames.forEach(function(n) { gStrings[n] = gBundle.getString(n); });

  if ("arguments" in window && window.arguments.length >= 1 &&
       window.arguments[0] && window.arguments[0].doc) {
    gDocument = window.arguments[0].doc;
    gWindow = gDocument.defaultView;
  }
  else {
    if ("gBrowser" in window.opener)
      gWindow = window.opener.gBrowser.contentWindow;
    else
      gWindow = window.opener.frames[0];
    gDocument = gWindow.document;
  }

  var titleFormat = gWindow != gWindow.top ? "pageInfo.frame.title"
                                           : "pageInfo.page.title";
  document.title = gBundle.getFormattedString(titleFormat, [gDocument.location]);

  document.getElementById("main-window").setAttribute("relatedUrl", gDocument.location);

  // do the easy stuff first
  makeGeneralTab();

  // init views
  function initView(treeid, view)
  {
    document.getElementById(treeid).view = view;
  }

  initView("imagetree", gImageView);
  initView("formtree", gFormView);
  initView("formpreview", gFieldView);
  initView("linktree", gLinkView);

  // and then the hard stuff
  makeTabs(gDocument, gWindow);

  initFeedTab();
  onLoadPermission();

  /* Call registered overlay init functions */
  onLoadRegistry.map(function(func) { func(); });

  /* Select the requested tab, if the name is specified */
  var initialTab = "generalTab";
  if ("arguments" in window && window.arguments.length >= 1 &&
       window.arguments[0] && window.arguments[0].initialTab)
    initialTab = window.arguments[0].initialTab;
  var tabbox = document.getElementById("tabbox");
  initialTab = document.getElementById(initialTab) || document.getElementById("generalTab");
  tabbox.selectedTab = initialTab;
  tabbox.selectedTab.focus();
}

function onUnloadPageInfo()
{
  // Remove the observer, only if there is at least 1 image.
  if (gImageView.data.length != 0) {
    Components.classes["@mozilla.org/observer-service;1"]
              .getService(Components.interfaces.nsIObserverService)
              .removeObserver(imagePermissionObserver, "perm-changed");
  }

  /* Call registered overlay unload functions */
  onUnloadRegistry.map(function(func) { func(); });
}

function onClickMore()
{
  var tabbox = document.getElementById("tabbox");
  var tab = document.getElementById("securityTab");
  tabbox.selectedTab = tab;
}

function makeGeneralTab()
{
  var title = (gDocument.title) ? gBundle.getFormattedString("pageTitle", [gDocument.title]) : gBundle.getString("noPageTitle");
  document.getElementById("titletext").value = title;

  var url = gDocument.location.toString();
  setItemValue("urltext", url);

  var referrer = ("referrer" in gDocument && gDocument.referrer);
  setItemValue("refertext", referrer);

  var mode = ("compatMode" in gDocument && gDocument.compatMode == "BackCompat") ? "generalQuirksMode" : "generalStrictMode";
  document.getElementById("modetext").value = gBundle.getString(mode);

  // find out the mime type
  var mimeType = gDocument.contentType;
  setItemValue("typetext", mimeType);

  // get the document characterset
  var encoding = gDocument.characterSet;
  document.getElementById("encodingtext").value = encoding;

  // get the meta tags
  var metaNodes = gDocument.getElementsByTagName("meta");
  var length = metaNodes.length;

  var metaTagsCaption = document.getElementById("metaTagsCaption");
  if (length == 1)
    metaTagsCaption.label = gBundle.getString("generalMetaTag");
  else
    metaTagsCaption.label = gBundle.getFormattedString("generalMetaTags", [length]);
  var metaTree = document.getElementById("metatree");
  metaTree.treeBoxObject.view = gMetaView;

  for (var i = 0; i < length; i++)
    gMetaView.addRow([metaNodes[i].name || metaNodes[i].httpEquiv, metaNodes[i].content]);

  // get the date of last modification
  var modifiedText = formatDate(gDocument.lastModified, gStrings.notSet);
  document.getElementById("modifiedtext").value = modifiedText;

  // get cache info
  var cacheKey = url.replace(/#.*$/, "");
  try {
    var cacheEntryDescriptor = httpCacheSession.openCacheEntry(cacheKey, ACCESS_READ, false);
  }
  catch(ex) {
    try {
      cacheEntryDescriptor = ftpCacheSession.openCacheEntry(cacheKey, ACCESS_READ, false);
    }
    catch(ex2) { }
  }

  var sizeText;
  if (cacheEntryDescriptor) {
    var pageSize = cacheEntryDescriptor.dataSize;
    var kbSize = formatNumber(Math.round(pageSize / 1024 * 100) / 100);
    sizeText = gBundle.getFormattedString("generalSize", [kbSize, formatNumber(pageSize)]);
  }
  setItemValue("sizetext", sizeText);

  securityOnLoad();
}

//******** Generic Build-a-tab
// Assumes the views are empty. Only called once to build the tabs, and
// does so by farming the task off to another thread via setTimeout().
// The actual work is done with a TreeWalker that calls doGrab() once for
// each element node in the document.

var gFrameList = [ ];

function makeTabs(aDocument, aWindow)
{
  goThroughFrames(aDocument, aWindow);
  processFrames();
}

function goThroughFrames(aDocument, aWindow)
{
  gFrameList.push(aDocument);
  if (aWindow && aWindow.frames.length > 0) {
    var num = aWindow.frames.length;
    for (var i = 0; i < num; i++)
      goThroughFrames(aWindow.frames[i].document, aWindow.frames[i]);  // recurse through the frames
  }
}

function processFrames()
{
  if (gFrameList.length) {
    var doc = gFrameList[0];
    onProcessFrame.map(function(func) { func(doc); });
    var iterator = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT, grabAll, true);
    gFrameList.shift();
    setTimeout(doGrab, 16, iterator);
  }
  else
    onFinished.map(function(func) { func(); });
}

function doGrab(iterator)
{
  for (var i = 0; i < 50; ++i)
    if (!iterator.nextNode()) {
      processFrames();
      return;
    }

  setTimeout(doGrab, 16, iterator);
}

function ensureSelection(view)
{
  // only select something if nothing is currently selected
  // and if there's anything to select
  if (view.selection && view.selection.count == 0 && view.rowCount)
    view.selection.select(0);
}

function addImage(url, type, alt, elem, isBg)
{
  if (!url)
    return;

  if (!gImageHash.hasOwnProperty(url))
    gImageHash[url] = { };
  if (!gImageHash[url].hasOwnProperty(type))
    gImageHash[url][type] = { };
  if (!gImageHash[url][type].hasOwnProperty(alt)) {
    gImageHash[url][type][alt] = gImageView.data.length;
    try {
      // open for READ, in non-blocking mode
      var cacheEntryDescriptor = httpCacheSession.openCacheEntry(url, ACCESS_READ, false);
    }
    catch(ex) {
      try {
        // open for READ, in non-blocking mode
        cacheEntryDescriptor = ftpCacheSession.openCacheEntry(url, ACCESS_READ, false);
      }
      catch(ex2) { }
    }

    var sizeText;
    if (cacheEntryDescriptor) {
      var pageSize = cacheEntryDescriptor.dataSize;
      var kbSize = formatNumber(Math.round(pageSize / 1024 * 100) / 100);
      sizeText = gBundle.getFormattedString("mediaFileSize", [kbSize]);
    }
    else
      sizeText = gStrings.unknown;
    gImageView.addRow([url, type, sizeText, alt, 1, elem, isBg]);

    // Add the observer, only once.
    if (gImageView.data.length == 1) {
      Components.classes["@mozilla.org/observer-service;1"]
                .getService(Components.interfaces.nsIObserverService)
                .addObserver(imagePermissionObserver, "perm-changed", false);
    }
  }
  else {
    var i = gImageHash[url][type][alt];
    gImageView.data[i][COL_IMAGE_COUNT]++;
  }
}

function grabAll(elem)
{
  // check for background images, any node may have one
  var ComputedStyle = elem.ownerDocument.defaultView.getComputedStyle(elem, "");
  var url = ComputedStyle && ComputedStyle.getPropertyCSSValue("background-image");
  if (url && url.primitiveType == CSSPrimitiveValue.CSS_URI)
    addImage(url.getStringValue(), gStrings.mediaBGImg, gStrings.notSet, elem, true);

  // one swi^H^H^Hif-else to rule them all
  if (elem instanceof HTMLAnchorElement)
    gLinkView.addRow([getValueText(elem), elem.href, gStrings.linkAnchor, elem.target, elem.accessKey]);
  else if (elem instanceof HTMLImageElement)
    addImage(elem.src, gStrings.mediaImg,
             (elem.hasAttribute("alt")) ? elem.alt : gStrings.notSet, elem, false);
  else if (elem instanceof HTMLAreaElement)
    gLinkView.addRow([elem.alt, elem.href, gStrings.linkArea, elem.target]);
  else if (elem instanceof HTMLLinkElement)
  {
    if (elem.rel)
    {
      var rel = elem.rel;
      if (/(?:^|\s)icon(?:\s|$)/i.test(rel))
        addImage(elem.href, gStrings.mediaLink, "", elem, false);
      else if (/(?:^|\s)stylesheet(?:\s|$)/i.test(rel))
        gLinkView.addRow([elem.rel, elem.href, gStrings.linkStylesheet, elem.target]);
      else
        gLinkView.addRow([elem.rel, elem.href, gStrings.linkRel, elem.target]);
    }
    else
      gLinkView.addRow([elem.rev, elem.href, gStrings.linkRev, elem.target]);
  }
  else if (elem instanceof HTMLInputElement || elem instanceof HTMLButtonElement)
  {
    switch (elem.type.toLowerCase())
    {
      case "image":
        addImage(elem.src, gStrings.mediaInput, (elem.hasAttribute("alt")) ? elem.alt : gStrings.notSet, elem, false);
        // Fall through, <input type="image"> submits, too
      case "submit":
        if ("form" in elem && elem.form)
        {
          gLinkView.addRow([elem.value || getValueText(elem) || gStrings.linkSubmit,
                            elem.form.action, gStrings.linkSubmission, elem.form.target]);
        }
        else
          gLinkView.addRow([elem.value || getValueText(elem) || gStrings.linkSubmit, '',
                            gStrings.linkSubmission, '']);
    }
  }
  else if (elem instanceof HTMLFormElement)
    gFormView.addRow([elem.name, elem.method, elem.action, elem]);
  else if (elem instanceof HTMLObjectElement)
    addImage(elem.data, gStrings.mediaObject, getValueText(elem), elem, false);
  else if (elem instanceof HTMLEmbedElement)
    addImage(elem.src, gStrings.mediaEmbed, "", elem, false);
  else if (elem.hasAttributeNS(XLinkNS, "href"))
  {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    url = elem.getAttributeNS(XLinkNS, "href");
    try {
      var baseURI = ioService.newURI(elem.baseURI, elem.ownerDocument.characterSet, null);
      url = ioService.newURI(url, elem.ownerDocument.characterSet, baseURI).spec;
    } catch (e) {}
    // SVG images without an xlink:href attribute are ignored
    if (elem instanceof SVGImageElement)
      addImage(url, gStrings.mediaImg, "", elem, false);
    else
      gLinkView.addRow([getValueText(elem), url, gStrings.linkX, ""]);
  }
  else if (elem instanceof HTMLScriptElement)
    gLinkView.addRow([elem.type || elem.language, elem.src || gStrings.linkScriptInline, gStrings.linkScript]);

  onProcessElement.map(function(func) { func(elem); });

  return NodeFilter.FILTER_ACCEPT;
}

//******** Form Stuff
function onFormSelect()
{
  var formTree = document.getElementById("formtree");

  if (gFormView.selection.count == 1)
  {
    var formPreview = document.getElementById("formpreview");
    gFieldView.clear();
    formPreview.treeBoxObject.view = gFieldView;

    var clickedRow = gFormView.selection.currentIndex;
    // form-node;
    var form = gFormView.data[clickedRow][3];

    var ft = null;
    if (form.name)
      ft = gBundle.getFormattedString("formTitle", [form.name]);

    setItemValue("formenctype", form.encoding, gBundle.getString("default"));
    setItemValue("formtarget", form.target, gBundle.getString("formDefaultTarget"));
    document.getElementById("formname").value = ft || gBundle.getString("formUntitled");

    var formfields = form.elements;

    var length = formfields.length;

    var checked = gBundle.getString("formChecked");
    var unchecked = gBundle.getString("formUnchecked");    

    for (var i = 0; i < length; i++)
    {
      var elem = formfields[i], val;

      if (elem instanceof HTMLButtonElement)
        val = getValueText(elem);
      else
        val = (/^password$/i.test(elem.type)) ? gBundle.getString("formPassword") : elem.value;

      gFieldView.addRow(["", elem.name, elem.type, val]);
    }

    var labels = form.getElementsByTagName("label");
    var llength = labels.length;
    var label;

    for (i = 0; i < llength; i++)
    {
      label = labels[i];
      var whatfor = label.hasAttribute("for") ?
        gDocument.getElementById(label.getAttribute("for")) :
        findFirstControl(label);

      if (whatfor && (whatfor.form == form)) 
      {
        var labeltext = getValueText(label);
        for (var j = 0; j < length; j++)
          if (formfields[j] == whatfor) {
            var col = formPreview.columns["field-label"];
            gFieldView.setCellText(j, col, labeltext);
          }
      }
    }
  }
}

function FormControlFilter(node) 
{
  if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement ||
      node instanceof HTMLButtonElement || node instanceof HTMLTextAreaElement ||
      node instanceof HTMLObjectElement)
      return NodeFilter.FILTER_ACCEPT;
    return NodeFilter.FILTER_SKIP;
}

function findFirstControl(node)
{
  var iterator = gDocument.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, FormControlFilter, true);

  return iterator.nextNode();
}

//******** Link Stuff
function openURL(target)
{
  var url = target.parentNode.childNodes[2].value;
  openNewTabWith(url, gDocument);
}

function onBeginLinkDrag(event,urlField,descField)
{
  if (event.originalTarget.localName != "treechildren")
    return;

  var tree = event.target;
  if (!("treeBoxObject" in tree))
    tree = tree.parentNode;

  var row = tree.treeBoxObject.getRowAt(event.clientX, event.clientY);
  if (row == -1)
    return;

  // Adding URL flavor
  var col = tree.columns[urlField];
  var url = tree.view.getCellText(row, col);
  col = tree.columns[descField];
  var desc = tree.view.getCellText(row, col);

  var dataTransfer = event.dataTransfer;
  dataTransfer.setData("text/x-moz-url", url + "\n" + desc);
  dataTransfer.setData("text/url-list", url);
  dataTransfer.setData("text/plain", url);
}

//******** Image Stuff
function getSelectedImage(tree)
{
  if (!gImageView.rowCount)
    return null;

  // Only works if only one item is selected
  var clickedRow = tree.currentIndex;
  // image-node
  return gImageView.data[clickedRow][COL_IMAGE_NODE];
}

function selectSaveFolder()
{
  const nsILocalFile = Components.interfaces.nsILocalFile;
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  var titleText = gBundle.getString("mediaSelectFolder");
  fp.init(window, titleText, nsIFilePicker.modeGetFolder);
  try {
    var prefs = Components.classes[PREFERENCES_CONTRACTID]
                          .getService(Components.interfaces.nsIPrefBranch2);

    var initialDir = prefs.getComplexValue("browser.download.dir", nsILocalFile);
    if (initialDir)
      fp.displayDirectory = initialDir;
  }
  catch (ex) { }

  fp.appendFilters(nsIFilePicker.filterAll);
  var ret = fp.show();

  if (ret == nsIFilePicker.returnOK)
    return fp.file.QueryInterface(nsILocalFile);
  return null;
}

function saveMedia()
{
  var tree = document.getElementById("imagetree");
  var count = tree.view.selection.count;
  if (count == 1) {
    var item = getSelectedImage(tree);
    var url = gImageView.data[tree.currentIndex][COL_IMAGE_ADDRESS];

    if (url)
      saveURL(url, null, "SaveImageTitle", false, makeURI(item.baseURI));
  }
  else {
    var odir  = selectSaveFolder();
    var start = { };
    var end   = { };
    var numRanges = tree.view.selection.getRangeCount();

    var rowArray = [ ];
    for (var t = 0; t < numRanges; t++) {
      tree.view.selection.getRangeAt(t, start, end);
      for (var v = start.value; v <= end.value; v++)
        rowArray.push(v);
    }

    var saveAnImage = function(aURIString, aChosenData, aBaseURI) {
      internalSave(aURIString, null, null, null, null, false, "SaveImageTitle",
                   aChosenData, aBaseURI);
    }

    for (var i = 0; i < rowArray.length; i++) {
      var v = rowArray[i];
      var dir = odir.clone();
      var item = gImageView.data[v][COL_IMAGE_NODE];
      var uriString = gImageView.data[v][COL_IMAGE_ADDRESS];
      var uri = makeURI(uriString);
 
      try {
        uri.QueryInterface(Components.interfaces.nsIURL);
        dir.append(decodeURIComponent(uri.fileName));
      }
      catch(ex) { /* data: uris */ }

      if (i == 0)
        saveAnImage(uriString, new AutoChosen(dir, uri), makeURI(item.baseURI));
      else {
        // This delay is a hack which prevents the download manager
        // from opening many times. See bug 377339.
        setTimeout(saveAnImage, 200, uriString, new AutoChosen(dir, uri),
                   makeURI(item.baseURI));
      }
    }
  }
}

function onBlockImage()
{
  var permissionManager = Components.classes[PERMISSION_CONTRACTID]
                                    .getService(nsIPermissionManager);

  var checkbox = document.getElementById("blockImage");
  var uri = makeURI(document.getElementById("imageurltext").value);
  if (checkbox.checked)
    permissionManager.add(uri, "image", nsIPermissionManager.DENY_ACTION);
  else
    permissionManager.remove(uri.host, "image");
}

function onImageSelect()
{
  var previewBox      = document.getElementById("mediaPreviewBox");
  var mediaSaveBox    = document.getElementById("mediaSaveBox");
  var mediaSaveButton = document.getElementById("imagesaveasbutton");
  var splitter        = document.getElementById("mediaSplitter");
  var tree            = document.getElementById("imagetree");
  var count           = tree.view.selection.count;

  if (count == 0)
  {
    previewBox.collapsed     = true;
    mediaSaveBox.collapsed   = true;
    mediaSaveButton.disabled = true;
    splitter.collapsed       = true;
    tree.flex = 1;
  }
  else if (count > 1)
  {
    previewBox.collapsed     = true;
    mediaSaveBox.collapsed   = false;
    mediaSaveButton.disabled = false;
    splitter.collapsed       = true;
    tree.flex = 1;
  }
  else
  {
    previewBox.collapsed     = false;
    mediaSaveBox.collapsed   = true;
    mediaSaveButton.disabled = false;
    splitter.collapsed       = false;
    tree.flex = 0;
    makePreview(tree.view.selection.currentIndex);
  }
}

function makePreview(row)
{
  var imageTree = document.getElementById("imagetree");
  var item = getSelectedImage(imageTree);
  var col = imageTree.columns["image-address"];
  var url = gImageView.getCellText(row, col);
  // image-bg
  var isBG = gImageView.data[row][COL_IMAGE_BG];

  setItemValue("imageurltext", url);

  if (item.hasAttribute("title") &&
      !(item instanceof SVGImageElement))
    setItemValue("imagetitletext", item.title);
  else
    setItemValue("imagetitletext", null);

  if (item.hasAttribute("longDesc") &&
      !(item instanceof SVGImageElement))
    setItemValue("imagelongdesctext", item.longDesc);
  else
    setItemValue("imagelongdesctext", null);

  if (item instanceof SVGImageElement)
    setItemValue("imagealttext", null);
  else if (item.hasAttribute("alt"))
    setItemValue("imagealttext", item.alt);
  else if (item instanceof HTMLImageElement || isBG)
    setItemValue("imagealttext", null);
  else
    setItemValue("imagealttext", getValueText(item));

  // get cache info
  var sourceText = gBundle.getString("generalNotCached");
  var cacheKey = url.replace(/#.*$/, "");
  try {
    // open for READ, in non-blocking mode
    var cacheEntryDescriptor = httpCacheSession.openCacheEntry(cacheKey, ACCESS_READ, false);
    if (cacheEntryDescriptor)
      switch (cacheEntryDescriptor.deviceID) {
        case "disk":
          sourceText = gBundle.getString("generalDiskCache");
          break;
        case "memory":
          sourceText = gBundle.getString("generalMemoryCache");
          break;
        default:
          sourceText = cacheEntryDescriptor.deviceID;
          break;
      }
  }
  catch(ex) {
    try {
      // open for READ, in non-blocking mode
      cacheEntryDescriptor = ftpCacheSession.openCacheEntry(cacheKey, ACCESS_READ, false);
      if (cacheEntryDescriptor)
        switch (cacheEntryDescriptor.deviceID) {
          case "disk":
            sourceText = gBundle.getString("generalDiskCache");
            break;
          case "memory":
            sourceText = gBundle.getString("generalMemoryCache");
            break;
          default:
            sourceText = cacheEntryDescriptor.deviceID;
            break;
        }
    }
    catch(ex2) { }
  }
  setItemValue("imagesourcetext", sourceText);

  // find out the file size
  var sizeText;
  if (cacheEntryDescriptor) {
    var pageSize = cacheEntryDescriptor.dataSize;
    var kbSize = Math.round(pageSize / 1024 * 100) / 100;
    sizeText = gBundle.getFormattedString("generalSize",
                                          [formatNumber(kbSize), formatNumber(pageSize)]);
  }
  setItemValue("imagesizetext", sizeText);

  var mimeType;
  if (item instanceof HTMLObjectElement ||
      item instanceof HTMLEmbedElement ||
      item instanceof HTMLLinkElement)
    mimeType = item.type;
  if (!mimeType)
    mimeType = getContentTypeFromImgRequest(item) ||
               getContentTypeFromHeaders(cacheEntryDescriptor);

  setItemValue("imagetypetext", mimeType);

  var imageContainer = document.getElementById("theimagecontainer");
  var oldImage = document.getElementById("thepreviewimage");

  const regex = /^(https?|ftp|file|gopher|about|chrome|resource):/;
  var isProtocolAllowed = regex.test(url);
  if (/^data:/.test(url) && /^image\//.test(mimeType))
    isProtocolAllowed = true;

  var newImage = new Image();
  newImage.setAttribute("id", "thepreviewimage");
  var physWidth = 0, physHeight = 0;
  var width = 0, height = 0;

  if ((item instanceof HTMLLinkElement ||
       item instanceof HTMLInputElement ||
       item instanceof HTMLImageElement ||
       item instanceof SVGImageElement ||
      (item instanceof HTMLObjectElement && /^image\//.test(mimeType)) || isBG) && isProtocolAllowed) {
    newImage.setAttribute("src", url);
    physWidth = newImage.width || 0;
    physHeight = newImage.height || 0;

    if (item instanceof SVGImageElement) {
      newImage.width = item.width.baseVal.value;
      newImage.height = item.height.baseVal.value;
    }
    else if (!isBG) {
      // "width" and "height" attributes must be set to newImage,
      // even if there is no "width" or "height attribute in item;
      // otherwise, the preview image cannot be displayed correctly.
      newImage.width = ("width" in item && item.width) || newImage.naturalWidth;
      newImage.height = ("height" in item && item.height) || newImage.naturalHeight;
    }
    else {
      // the Width and Height of an HTML tag should not be used for its background image
      // (for example, "table" can have "width" or "height" attributes)
      newImage.width = newImage.naturalWidth;
      newImage.height = newImage.naturalHeight;
    }

    width = newImage.width;
    height = newImage.height;

    document.getElementById("theimagecontainer").collapsed = false
    document.getElementById("brokenimagecontainer").collapsed = true;
  }
  else {
    // fallback image for protocols not allowed (e.g., data: or javascript:)
    // or elements not [yet] handled (e.g., object, embed).
    document.getElementById("brokenimagecontainer").collapsed = false;
    document.getElementById("theimagecontainer").collapsed = true;
  }

  var imageSize = "";
  if (url)
    imageSize = gBundle.getFormattedString("mediaSize",
                                           [formatNumber(width),
                                           formatNumber(height)]);
  setItemValue("imageSize", imageSize);

  var physSize = "";
  if (width != physWidth || height != physHeight)
    physSize = gBundle.getFormattedString("mediaSize",
                                          [formatNumber(physWidth),
                                           formatNumber(physHeight)]);
  setItemValue("physSize", physSize);

  makeBlockImage(url);

  imageContainer.removeChild(oldImage);
  imageContainer.appendChild(newImage);
}

function makeBlockImage(url)
{
  var permissionManager = Components.classes[PERMISSION_CONTRACTID]
                                    .getService(nsIPermissionManager);
  var prefs = Components.classes[PREFERENCES_CONTRACTID]
                        .getService(Components.interfaces.nsIPrefBranch2);

  var checkbox = document.getElementById("blockImage");
  var imagePref = prefs.getIntPref("permissions.default.image");
  if (!(/^https?:/.test(url)) || imagePref == 2)
    // We can't block the images from this host because either is is not
    // for http(s) or we don't load images at all
    checkbox.hidden = true;
  else {
    var uri = makeURI(url);
    if (uri.host) {
      checkbox.hidden = false;
      checkbox.label = gBundle.getFormattedString("mediaBlockImage", [uri.host]);
      var perm = permissionManager.testPermission(uri, "image");
      checkbox.checked = perm == nsIPermissionManager.DENY_ACTION;
    }
    else
      checkbox.hidden = true;
  }
}

var imagePermissionObserver = {
  observe: function (aSubject, aTopic, aData)
  {
    if (document.getElementById("mediaPreviewBox").collapsed)
      return;

    if (aTopic == "perm-changed") {
      var permission = aSubject.QueryInterface(Components.interfaces.nsIPermission);
      if (permission.type == "image") {
        var imageTree = document.getElementById("imagetree");
        var row = imageTree.currentIndex;
        var item = gImageView.data[row][COL_IMAGE_NODE];
        var url = gImageView.data[row][COL_IMAGE_ADDRESS];
        if (makeURI(url).host == permission.host)
          makeBlockImage(url);
      }
    }
  }
}

function getContentTypeFromHeaders(cacheEntryDescriptor)
{
  if (!cacheEntryDescriptor)
    return null;

  return (/^Content-Type:\s*(.*?)\s*(?:\;|$)/mi
          .exec(cacheEntryDescriptor.getMetaDataElement("response-head")))[1];
}

function getContentTypeFromImgRequest(item)
{
  var httpRequest;

  try {
    var imageItem = item.QueryInterface(nsIImageLoadingContent);
    var imageRequest = imageItem.getRequest(nsIImageLoadingContent.CURRENT_REQUEST);
    if (imageRequest)
      httpRequest = imageRequest.mimeType;
  }
  catch (ex) { } // This never happened.  ;)

  return httpRequest;
}

//******** Other Misc Stuff
// Modified from the Links Panel v2.3, http://segment7.net/mozilla/links/links.html
// parse a node to extract the contents of the node
function getValueText(node)
{
  var valueText = "";

  // form input elements don't generally contain information that is useful to our callers, so return nothing
  if (node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement ||
      node instanceof HTMLTextAreaElement)
    return valueText;

  // otherwise recurse for each child
  var length = node.childNodes.length;
  for (var i = 0; i < length; i++) {
    var childNode = node.childNodes[i];
    var nodeType = childNode.nodeType;

    // text nodes are where the goods are
    if (nodeType == Node.TEXT_NODE)
      valueText += " " + childNode.nodeValue;
    // and elements can have more text inside them
    else if (nodeType == Node.ELEMENT_NODE) {
      // images are special, we want to capture the alt text as if the image weren't there
      if (childNode instanceof HTMLImageElement)
        valueText += " " + getAltText(childNode);
      else
        valueText += " " + getValueText(childNode);
    }
  }

  return stripWS(valueText);
}

// Copied from the Links Panel v2.3, http://segment7.net/mozilla/links/links.html
// traverse the tree in search of an img or area element and grab its alt tag
function getAltText(node)
{
  var altText = "";

  if (node.alt)
    return node.alt;
  var length = node.childNodes.length;
  for (var i = 0; i < length; i++)
    if ((altText = getAltText(node.childNodes[i]) != undefined))  // stupid js warning...
      return altText;
  return "";
}

// strip leading and trailing whitespace, and replace multiple consecutive whitespace characters with a single space
function stripWS(text)
{
  return text.trim().replace(/\s+/g, " ");
}

function setItemValue(id, value)
{
  var item = document.getElementById(id);
  if (value) {
    item.disabled = false;
    item.value = value;
  }
  else
  {
    item.value = gStrings.notSet;
    item.disabled = true;
  }
}

function formatNumber(number)
{
  return (+number).toLocaleString();  // coerce number to a numeric value before calling toLocaleString()
}

function formatDate(datestr, unknown)
{
  // scriptable date formatter, for pretty printing dates
  var dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                              .getService(Components.interfaces.nsIScriptableDateFormat);

  var date = new Date(datestr);
  if (!date.valueOf())
    return unknown;

  return dateService.FormatDateTime("", dateService.dateFormatLong,
                                    dateService.timeFormatSeconds,
                                    date.getFullYear(), date.getMonth()+1, date.getDate(),
                                    date.getHours(), date.getMinutes(), date.getSeconds());
}

function doCopy()
{
  if (!gClipboardHelper)
    return;

  var elem = document.commandDispatcher.focusedElement;

  if (elem && "treeBoxObject" in elem) {
    var view = elem.view;
    var selection = view.selection;
    var text = [], tmp = '';
    var min = {}, max = {};

    var count = selection.getRangeCount();

    for (var i = 0; i < count; i++) {
      selection.getRangeAt(i, min, max);

      for (var row = min.value; row <= max.value; row++) {
        view.performActionOnRow("copy", row);

        tmp = elem.getAttribute("copybuffer");
        if (tmp)
          text.push(tmp);
        elem.removeAttribute("copybuffer");
      }
    }
    gClipboardHelper.copyString(text.join("\n"));
  }
}

function doSelectAll()
{
  var elem = document.commandDispatcher.focusedElement;

  if (elem && "treeBoxObject" in elem)
    elem.view.selection.selectAll();
}
