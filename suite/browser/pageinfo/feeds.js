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
 * The Original Code is the feed tab for Page Info.
 *
 * The Initial Developer of the Original Code is
 *   Florian QUEZE <f.qu@queze.net>
 * Portions created by the Initial Developer are Copyright (C) 2006-2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ehsan Akhgari <ehsan.akhgari@gmail.com>
 *   Daniel Brooks <db48x@yahoo.com>
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

function initFeedTab()
{
  const feedTypes = {
    "application/rss+xml": gBundle.getString("feedRss"),
    "application/atom+xml": gBundle.getString("feedAtom"),
    "text/xml": gBundle.getString("feedXML"),
    "application/xml": gBundle.getString("feedXML"),
    "application/rdf+xml": gBundle.getString("feedXML")
  };

  // get the feeds
  var linkNodes = gDocument.getElementsByTagName("link");
  var length = linkNodes.length;
  for (var i = 0; i < length; i++) {
    var feed = recognizeFeedFromLink(linkNodes[i], gDocument.nodePrincipal);
    if (feed) {
      var type = feed.type;
      if (type in feedTypes)
        type = feedTypes[type];
      else
        type = feedTypes["application/rss+xml"];
      addRow(feed.title, type, feed.href);
    }
  }
}

/* uncomment this function when seamonkey supports some sort of subscription method for feeds
function onSubscribeFeed()
{
  var listbox = document.getElementById("feedListbox");
  openUILink(listbox.selectedItem.getAttribute("feedURL"),
             null, false, true, false, null);
}
*/

function addRow(name, type, url)
{
  var item = document.createElement("richlistitem");
  item.setAttribute("feed", "true");
  item.setAttribute("name", name);
  item.setAttribute("type", type);
  item.setAttribute("feedURL", url);
  document.getElementById("feedListbox").appendChild(item);
}

/**
 * recognizeFeedFromLink: recognizes RSS/ATOM feeds from DOM link elements.
 *
 * @param  aLink
 *         The DOM link element to check for representing a feed.
 * @param  aPrincipal
 *         The principal of the document, used for security check.
 * @return object
 *         The feed object containing href, type, and title properties,
 *          if successful, otherwise null.
 */ 
function recognizeFeedFromLink(aLink, aPrincipal)
{
  if (!aLink || !aPrincipal)
    return null;

  var erel = aLink.rel && aLink.rel.toLowerCase();
  var etype = aLink.type && aLink.type.toLowerCase();
  var etitle = aLink.title;
  const rssTitleRegex = /(^|\s)rss($|\s)/i;
  var rels = {};

  if (erel) {
    for each (var relValue in erel.split(/\s+/))
      rels[relValue] = true;
  }
  var isFeed = rels.feed;

  if (!isFeed && (!rels.alternate || rels.stylesheet || !etype))
    return null;

  if (!isFeed) {
    // Use type value
    etype = etype.replace(/^\s+/, "");
    etype = etype.replace(/\s+$/, "");
    etype = etype.replace(/\s*;.*/, "");
    isFeed = (etype == "application/rss+xml" ||
              etype == "application/atom+xml");
    if (!isFeed) {
      // really slimy: general XML types with magic letters in the title
      isFeed = ((etype == "text/xml" || etype == "application/xml" ||
                 etype == "application/rdf+xml") && rssTitleRegex.test(etitle));
    }
  }

  if (isFeed) {
    try { 
      urlSecurityCheck(aLink.href,
                       aPrincipal,
                       Components.interfaces.nsIScriptSecurityManager.DISALLOW_INHERIT_PRINCIPAL);
    }
    catch (ex) {
      dump(ex.message);
      return null; // doesn't pass security check
    }

    // successful!  return the feed
    return {
        href: aLink.href,
        type: etype,
        title: aLink.title
      };
  }

  return null;
}
