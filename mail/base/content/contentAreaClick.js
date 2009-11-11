/** ***** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett         <alecf@netscape.com>
 *   Ben Goodger        <ben@netscape.com>
 *   Mike Pinkerton     <pinkerton@netscape.com>
 *   Blake Ross         <blakeross@telocity.com>
 *   Christopher Thomas <cst@yecc.com>
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

  /**
   * Extract the href from the link click event.
   * We look for HTMLAnchorElement, HTMLAreaElement, HTMLLinkElement,
   * HTMLInputElement.form.action, and nested anchor tags.
   *
   * @return href for the url being clicked
   */
  function hRefForClickEvent(aEvent, aDontCheckInputElement)
  {
    var href;
    var isKeyCommand = (aEvent.type == "command");
    var target =
      isKeyCommand ? document.commandDispatcher.focusedElement : aEvent.target;

    if (target instanceof HTMLAnchorElement ||
        target instanceof HTMLAreaElement   ||
        target instanceof HTMLLinkElement)
    {
      if (target.hasAttribute("href"))
        href = target.href;
    }
    else if (!aDontCheckInputElement && target instanceof HTMLInputElement)
    {
      if (target.form && target.form.action)
        href = target.form.action;
    }
    else
    {
      // we may be nested inside of a link node
      var linkNode = aEvent.originalTarget;
      while (linkNode && !(linkNode instanceof HTMLAnchorElement))
        linkNode = linkNode.parentNode;

      if (linkNode)
        href = linkNode.href;
    }

    return href;
  }

  function messagePaneOnResize(aEvent)
  {
    // scale any overflowing images
    var messagepane = document.getElementById("messagepane");
    var doc = messagepane.contentDocument;
    var imgs = doc.images;
    for each (var img in imgs)
    {
      if (img.className == "moz-attached-image")
      {
        if (img.naturalWidth <= doc.width)
        {
          img.removeAttribute("isshrunk");
          img.removeAttribute("overflowing");
        }
        else if (img.hasAttribute("shrinktofit"))
        {
          img.setAttribute("isshrunk", "true");
          img.removeAttribute("overflowing");
        }
        else
        {
          img.setAttribute("overflowing", "true");
          img.removeAttribute("isshrunk");
        }
      }
    }
  }

// Called whenever the user clicks in the content area,
// should always return true for click to go through
function contentAreaClick(aEvent)
{
  let href = hRefForClickEvent(aEvent);

  if (!href && !aEvent.button) {
    var target = aEvent.target;
    // is this an image that we might want to scale?
    const Ci = Components.interfaces;

    if (target instanceof Ci.nsIImageLoadingContent) {
      // make sure it loaded successfully
      var req = target.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
      if (!req || req.imageStatus & Ci.imgIRequest.STATUS_ERROR)
        return true;

      // is it an inline attachment?
      if (/^moz-attached-image/.test(target.className)) {
        if (target.hasAttribute("isshrunk")) {
          // currently shrunk to fit, so unshrink it
          target.removeAttribute("isshrunk");
          target.removeAttribute("shrinktofit");
          target.setAttribute("overflowing", "true");
        }
        else if (target.hasAttribute("overflowing")) {
          // user wants to shrink now
          target.setAttribute("isshrunk", "true");
          target.setAttribute("shrinktofit", "true");
          target.removeAttribute("overflowing");
        }
      }
    }
    return true;
  }

  if (!href || aEvent.button)
    return true;

  // We want all about, http and https links in the message pane to be loaded
  // externally in a browser, therefore we need to detect that here and redirect
  // as necessary.
  let uri = makeURI(href);
  if (Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                .getService(Components.interfaces.nsIExternalProtocolService)
                .isExposedProtocol(uri.scheme) &&
      !uri.schemeIs("http") && !uri.schemeIs("https"))
    return true;

  // Now we're here, we know this should be loaded in an external browser, so
  // prevent the default action so we don't try and load it here.
  aEvent.preventDefault();

  // let the phishing detector check the link
  if (!gPhishingDetector.warnOnSuspiciousLinkClick(href))
    return false;

  openLinkExternally(href);
  return true;
}

/**
 * Forces a url to open in an external application according to the protocol
 * service settings.
 *
 * @param url  A url string or an nsIURI containing the url to open.
 */
function openLinkExternally(url)
{
  let uri = url;
  if (!(uri instanceof Components.interfaces.nsIURI))
    uri = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService)
                    .newURI(url, null, null);

  Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
            .getService(Components.interfaces.nsIExternalProtocolService)
            .loadUrl(uri);
}
