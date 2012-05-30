/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** 
 * LinkToolbarHandler is a Singleton that displays LINK elements 
 * and nodeLists of LINK elements in the Link Toolbar.  It
 * associates the LINK with a corresponding LinkToolbarItem based 
 * on it's REL attribute and the toolbar item's ID attribute.
 * LinkToolbarHandler is also a Factory and will create 
 * LinkToolbarItems as necessary.
 */
function LinkToolbarHandler()
{
  this.items = new Array();
  this.hasItems = false;
}

LinkToolbarHandler.prototype.handle =
function(element)
{
  // XXX: if you're going to re-enable handling of anchor elements,
  //    you'll want to change this to AnchorElementDecorator
  var linkElement = new LinkElementDecorator(element);

  if (linkElement.isIgnored()) return;

  for (var i = 0; i < linkElement.relValues.length; i++) {
    if (linkElement.relValues.length > 1 && rel == "alternate")
      continue; // skip "alternate" when we have "alternate XXX"

    var linkType = LinkToolbarHandler.getLinkType(linkElement.relValues[i], element);
    if (linkType) {
      if (!this.hasItems) {
        this.hasItems = true;
        linkToolbarUI.activate();
      }
      this.getItemForLinkType(linkType).displayLink(linkElement);
    }
  }
}

LinkToolbarHandler.getLinkType =
function(relAttribute, element)
{
  var isFeed = false;
  switch (relAttribute.toLowerCase()) {
    case "top":
    case "origin":
      return "top";

    case "up":
    case "parent":
      return "up";

    case "start":
    case "begin":
    case "first":
      return "first";

    case "next":
    case "child":
      return "next";

    case "prev":
    case "previous":
      return "prev";

    case "end":
    case "last":
      return "last";

    case "author":
    case "made":
      return "author";

    case "contents":
    case "toc":
      return "toc";

    case "feed":
      isFeed = true;
      // fall through
    case "alternate":
      if (isValidFeed(element, element.nodePrincipal, isFeed)) {
        return "feed";
      }

      if (!isFeed) {
        return "alternate";
      }
      // fall through
    case "prefetch":
      return null;

    default:
      return relAttribute.toLowerCase();
  }
}

LinkToolbarHandler.prototype.getItemForLinkType =
function(linkType) {
  if (!(linkType in this.items && this.items[linkType]))
    this.items[linkType] = LinkToolbarHandler.createItemForLinkType(linkType);

  return this.items[linkType];
}

LinkToolbarHandler.createItemForLinkType =
function(linkType)
{
  if (!document.getElementById("link-" + linkType))
    return new LinkToolbarTransientMenu(linkType);

  // XXX: replace switch with polymorphism
  var element = document.getElementById("link-" + linkType);
  switch (element.getAttribute("type") || element.localName) {
    case "toolbarbutton":
      return new LinkToolbarButton(linkType);

    case "menuitem":
      return new LinkToolbarItem(linkType);

    case "menu":
      return new LinkToolbarMenu(linkType);

    default:
      return new LinkToolbarTransientMenu(linkType);
  }
}

LinkToolbarHandler.prototype.clearAllItems =
function()
{
  // Hide the 'miscellaneous' separator
  document.getElementById("misc-separator").setAttribute("collapsed", "true");

  // Disable the individual items
  for (var linkType in this.items)
    this.items[linkType].clear();

  // Store the fact that the toolbar is empty
  this.hasItems = false;
}

const linkToolbarHandler = new LinkToolbarHandler();
var gLanguageBundle;

function LinkElementDecorator(element) {
  /*
   * XXX: this is an incomplete decorator, because it doesn't implement
   *      the full Element interface.  If you need to use a method 
   *      or member in the Element interface, just add it here and
   *      have it delegate to this.element
   *
   * XXX: would rather add some methods to Element.prototype instead of
   *    using a decorator, but Element.prototype is no longer exposed 
   *      since the XPCDOM landing, see bug 83433
   */

  if (!element) return; // skip the rest on foo.prototype = new ThisClass calls
  
  this.element = element;
  
  this.rel = LinkElementDecorator.convertRevMade(element.rel, element.rev);
  if (this.rel)
    this.relValues = this.rel.split(" ");
  this.rev = element.rev;
  this.title = element.title;
  this.href = element.href;
  this.hreflang = element.hreflang;
  this.media = element.media;
  this.longTitle = null;
}

LinkElementDecorator.prototype.isIgnored =
function()
{
  if (!this.rel) return true;
  for (var i = 0; i < this.relValues.length; i++)
    if (/^stylesheet$|^icon$|^fontdef$|^p3pv|^schema./i.test(this.relValues[i]))
      return true;
  return false;
}

LinkElementDecorator.convertRevMade =
function(rel, rev) 
{
  if (!rel && rev && /\bmade\b/i.test(rev))
    return rev;
  else
    return rel;
}

LinkElementDecorator.prototype.getTooltip =
function() 
{
  return this.getLongTitle() || this.href;
}

LinkElementDecorator.prototype.getLabel =
function() 
{
  return this.getLongTitle() || this.rel;
}

LinkElementDecorator.prototype.getLongTitle =
function() 
{
  if (this.longTitle == null)
    this.longTitle = this.makeLongTitle();

  return this.longTitle;
}

LinkElementDecorator.prototype.makeLongTitle =
function()
{
  var prefix = "";

  // XXX: lookup more meaningful and localized version of media, 
  //   i.e. media="print" becomes "Printable" or some such
  // XXX: use localized version of ":" separator
  if (this.media && !/\ball\b|\bscreen\b/i.test(this.media))
    prefix += this.media + ": ";
  if (this.hreflang) {
    try {
      if (!gLanguageBundle)
        gLanguageBundle = document.getElementById("languageBundle");
      prefix += gLanguageBundle.getString(this.hreflang);
    }
    catch (e) {
      // XXX: handle non-standard language codes per
      //      hixie's spec (see bug 2800)
    }

    prefix += ": ";
  }

  return this.title ? prefix + this.title : prefix;
}

function AnchorElementDecorator(element) {
  this.constructor(element);
}
AnchorElementDecorator.prototype = new LinkElementDecorator;

AnchorElementDecorator.prototype.getLongTitle =
function() 
{
  return this.title ? this.__proto__.getLongTitle.apply(this) 
      : getText(this.element);
}

AnchorElementDecorator.prototype.getText =
function(element)
{
  return condenseWhitespace(getTextRecursive(element));
}

AnchorElementDecorator.prototype.getTextRecursive =
function(node) 
{
  var text = "";
  node.normalize();
  if (node.hasChildNodes()) {
    for (var i = 0; i < node.childNodes.length; i++) {
      if (node.childNodes.item(i).nodeType == Node.TEXT_NODE)
        text += node.childNodes.item(i).nodeValue;
      else if (node.childNodes.item(i).nodeType == Node.ELEMENT_NODE)
        text += getTextRecursive(node.childNodes.item(i));
    }
  }

  return text;
}

AnchorElementDecorator.prototype.condenseWhitespace =
function(text)
{
  return text.replace(/\W*$/, "").replace(/^\W*/, "").replace(/\W+/g, " ");
}
