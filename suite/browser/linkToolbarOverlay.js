/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var LinkToolbarUI = function()
{
}

LinkToolbarUI.prototype.linkAdded =
function(event)
{
  var element = event.originalTarget;

  if (element.ownerDocument != getBrowser().contentDocument ||
      !linkToolbarUI.isLinkToolbarEnabled() ||
      !(element instanceof Components.interfaces.nsIDOMHTMLLinkElement) ||
      !element.href || (!element.rel && !element.rev))
    return;

  linkToolbarHandler.handle(element);
}

LinkToolbarUI.prototype.isLinkToolbarEnabled =
function()
{
  if (document.getElementById("linktoolbar").getAttribute("hidden") == "true")
    return false;
  else
    return true;
}

LinkToolbarUI.prototype.clear =
function(event)
{
  if (event.originalTarget != getBrowser().contentDocument ||
      !linkToolbarUI.isLinkToolbarEnabled() ||
      !linkToolbarHandler.hasItems)
    return;

  linkToolbarHandler.clearAllItems();
}

LinkToolbarUI.prototype.tabSelected =
function(event)
{
  if (event.originalTarget.localName != "tabs" ||
      !linkToolbarUI.isLinkToolbarEnabled())
    return;

  linkToolbarHandler.clearAllItems();
  linkToolbarUI.deactivate();
  linkToolbarUI.fullSlowRefresh();
}

LinkToolbarUI.prototype.fullSlowRefresh =
function()
{
  var currentNode = getBrowser().contentDocument.documentElement;
  if (!(currentNode instanceof Components.interfaces.nsIDOMHTMLHtmlElement))
    return;
  currentNode = currentNode.firstChild;
  
  while(currentNode)
  {
    if (currentNode instanceof Components.interfaces.nsIDOMHTMLHeadElement) {
      currentNode = currentNode.firstChild;
      
      while(currentNode)
      {
        if (currentNode instanceof Components.interfaces.nsIDOMHTMLLinkElement)
          linkToolbarUI.linkAdded({originalTarget: currentNode});
        currentNode = currentNode.nextSibling;
      }
    }
    else if (currentNode instanceof Components.interfaces.nsIDOMElement)
    {
      // head is supposed to be the first element inside html.
      // Got something else instead. returning
       return;
    }
    else
    {
      // Got a comment node or something like that. Moving on.
      currentNode = currentNode.nextSibling;
    }
  }  
}

LinkToolbarUI.prototype.toolbarActive = false;

LinkToolbarUI.prototype.activate =
function()
{
  if (!linkToolbarUI.toolbarActive) {
    linkToolbarUI.toolbarActive = true;
    document.getElementById("linktoolbar").setAttribute("hasitems", "true");
    var contentArea = document.getElementById("appcontent");
    contentArea.addEventListener("pagehide", linkToolbarUI.clear, true);
    contentArea.addEventListener("pageshow", linkToolbarUI.deactivate, true);
    contentArea.addEventListener("DOMHeadLoaded", linkToolbarUI.deactivate,
                                 true);
  }
}

LinkToolbarUI.prototype.deactivate =
function()
{
  // This function can never be called unless the toolbar is active, because
  // it's a handler that's only activated in that situation, so there's no need
  // to check toolbarActive. On the other hand, by the time this method is
  // called the toolbar might have been populated again already, in which case
  // we don't want to deactivate.
  if (!linkToolbarHandler.hasItems) {
    linkToolbarUI.toolbarActive = false;
    document.getElementById("linktoolbar").setAttribute("hasitems", "false");
    var contentArea = document.getElementById("appcontent");
    contentArea.removeEventListener("pagehide", linkToolbarUI.clear, true);
    contentArea.removeEventListener("pageshow", linkToolbarUI.deactivate, true);
    contentArea.removeEventListener("DOMHeadLoaded", linkToolbarUI.deactivate,
                                    true);
  }
}

/* called whenever something on the toolbar gets an oncommand event */
LinkToolbarUI.prototype.commanded =
function(event)
{
  // Return if this is one of the menubuttons.
  if (event.target.getAttribute("type") == "menu") return;
  
  if (!event.target.getAttribute("href")) return;

  var destURL = event.target.getAttribute("href");
  
  // We have to do a security check here, because we are loading URIs given
  // to us by a web page from chrome, which is privileged.
  try {
    urlSecurityCheck(destURL, content.document.nodePrincipal,
                     Components.interfaces.nsIScriptSecurityManager.STANDARD);
    loadURI(destURL, content.document.documentURIObject);
  } catch (e) {
    dump("Error: it is not permitted to load this URI from a <link> element: " + e);
  }
}

// functions for twiddling XUL elements in the toolbar

LinkToolbarUI.prototype.toggleLinkToolbar =
function(checkedItem)
{
  this.goToggleTristateToolbar("linktoolbar", checkedItem);
  this.initHandlers();
  if (this.isLinkToolbarEnabled())
    this.fullSlowRefresh();
  else
    linkToolbarHandler.clearAllItems();
}

LinkToolbarUI.prototype.initLinkbarVisibilityMenu = 
function()
{
  var state = document.getElementById("linktoolbar").getAttribute("hidden");
  if (!state)
    state = "maybe";
  var checkedItem = document.getElementById("cmd_viewlinktoolbar_" + state);
  checkedItem.setAttribute("checked", true);
  checkedItem.checked = true;
}

LinkToolbarUI.prototype.goToggleTristateToolbar =
function(id, checkedItem)
{
  var toolbar = document.getElementById(id);
  if (toolbar)
  {
    toolbar.setAttribute("hidden", checkedItem.value);
    document.persist(id, "hidden");
  }
}

LinkToolbarUI.prototype.addHandlerActive = false;

LinkToolbarUI.prototype.initialized = false;

LinkToolbarUI.prototype.initHandlers =
function()
{
  var contentArea = document.getElementById("appcontent");
  if (linkToolbarUI.isLinkToolbarEnabled())
  {
    if (!linkToolbarUI.addHandlerActive) {
      contentArea.addEventListener("select", linkToolbarUI.tabSelected,
                                   false);
      contentArea.addEventListener("DOMLinkAdded", linkToolbarUI.linkAdded,
                                   true);
      linkToolbarUI.addHandlerActive = true;
    }
  } else
  {
    if (linkToolbarUI.addHandlerActive) {
      contentArea.removeEventListener("select", linkToolbarUI.tabSelected,
                                      false);
      contentArea.removeEventListener("DOMLinkAdded", linkToolbarUI.linkAdded,
                                      true);
      linkToolbarUI.addHandlerActive = false;
    }
  }
  if (!linkToolbarUI.initialized)
  {
    linkToolbarUI.initialized = true;
    document.removeEventListener("pageshow", linkToolbarUI.initHandlers, true);
  }
}

const linkToolbarUI = new LinkToolbarUI;

