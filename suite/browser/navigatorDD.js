/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function _RDF(aType)
  {
    return "http://www.w3.org/1999/02/22-rdf-syntax-ns#" + aType;
  }
function NC_RDF(aType)
  {
    return "http://home.netscape.com/NC-rdf#" + aType;
  }

var RDFUtils = {
  getResource: function(aString)
    {
      return this.rdf.GetResource(aString, true);
    },

  getTarget: function(aDS, aSourceID, aPropertyID)
    {
      var source = this.getResource(aSourceID);
      var property = this.getResource(aPropertyID);
      return aDS.GetTarget(source, property, true);
    },

  getValueFromResource: function(aResource)
    {
      aResource = aResource.QueryInterface(Components.interfaces.nsIRDFResource);
      return aResource ? aResource.Value : null;
    },
  _rdf: null,
  get rdf() {
    if (!this._rdf) {
      this._rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                            .getService(Components.interfaces.nsIRDFService);
    }
    return this._rdf;
  }
}

function htmlEscape(aString)
{
  return aString.replace(/&/g, "&amp;")
                .replace(/>/g, "&gt;")
                .replace(/</g, "&lt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");
}

function BeginDragLink(aEvent, aHref, aTitle)
{
  var dt = aEvent.dataTransfer;
  dt.setData("text/x-moz-url", aHref + "\n" + aTitle);
  dt.setData("text/uri-list", aHref);
  dt.setData("text/html", "<a href=\"" + htmlEscape(aHref) + 
                          "\">" + htmlEscape(aTitle) + "</a>");
  dt.setData("text/plain", aHref);
}

function DragLinkOver(aEvent)
{
  if (Services.droppedLinkHandler.canDropLink(aEvent, true))
    aEvent.preventDefault();
}

var proxyIconDNDObserver = {
  onDragStart: function (aEvent)
  {
    if (gProxyButton.getAttribute("pageproxystate") != "valid")
      return;

    BeginDragLink(aEvent, window.content.location.href,
                  window.content.document.title);
  }
};

var homeButtonObserver = {
  onDragStart: function (aEvent)
  {
    var homepage = GetLocalizedStringPref("browser.startup.homepage",
                                          "about:blank");

    if (homepage)
    {
      // XXX find a readable title string for homepage,
      // perhaps do a history lookup.
      BeginDragLink(aEvent, homepage, homepage);
    }
  },

  onDrop: function (aEvent)
  {
    aEvent.stopPropagation();
    // disallow setting home pages that inherit the principal
    var url = Services.droppedLinkHandler.dropLink(aEvent, {}, true);
    setTimeout(openHomeDialog, 0, url);
  },

  onDragOver: function (aEvent)
  {
    if (aEvent.target == aEvent.dataTransfer.mozSourceNode)
      return;

    DragLinkOver(aEvent);
    aEvent.dropEffect = "link";
    var statusTextFld = document.getElementById("statusbar-display");
    statusTextFld.label = gNavigatorBundle.getString("droponhomebutton");
  },

  onDragExit: function (aEvent)
  {
    aEvent.stopPropagation();
    document.getElementById("statusbar-display").label = "";
  }
};

function openHomeDialog(aURL)
{
  var promptTitle = gNavigatorBundle.getString("droponhometitle");
  var promptMsg   = gNavigatorBundle.getString("droponhomemsg");
  var okButton    = gNavigatorBundle.getString("droponhomeokbutton");
  if (Services.prompt.confirmEx(window, promptTitle, promptMsg,
                                (Services.prompt.BUTTON_TITLE_IS_STRING *
                                 Services.prompt.BUTTON_POS_0) +
                                (Services.prompt.BUTTON_TITLE_CANCEL *
                                 Services.prompt.BUTTON_POS_1),
                                okButton, null, null, null,
                                {value: false}) == 0)
    SetStringPref("browser.startup.homepage", aURL);
}

var goButtonObserver = {
  onDragOver: DragLinkOver,

  onDrop: function (aEvent)
  {
    var url = Services.droppedLinkHandler.dropLink(aEvent, {});
    var postData = {};
    url = getShortcutOrURI(url, postData);
    if (url)
      loadURI(url, null, postData.value, true);
  }
};

var searchButtonObserver = {
  onDragOver: DragLinkOver,

  onDrop: function (aEvent)
  {
    var name = {};
    var url = Services.droppedLinkHandler.dropLink(aEvent, name);
    if (url)
      BrowserSearch.loadSearch(name.value || url);
  }
};
