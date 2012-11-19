/** ***** BEGIN LICENSE BLOCK *****
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    let doc = document.getElementById("messagepane").contentDocument;
    let imgs = doc.images;
    for (let i = 0; i < imgs.length; i++)
    {
      let img = imgs[i];
      if (img.className == "moz-attached-image")
      {
        if (img.naturalWidth <= doc.body.clientWidth)
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

  if (!href || aEvent.button == 2)
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
