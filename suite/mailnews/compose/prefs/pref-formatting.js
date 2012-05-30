/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gListbox;
var gPref;
var gError;

function Startup()
{
  // Store some useful elements in globals.
  gListbox =
  {
    html:      document.getElementById("html_domains"),
    plaintext: document.getElementById("plaintext_domains")
  };
  gPref =
  {
    html_domains:      document.getElementById("mailnews.html_domains"),
    plaintext_domains: document.getElementById("mailnews.plaintext_domains")
  };
  gError = document.getElementById("formatting_error_msg");

  // Make it easier to access the pref pane from onsync.
  gListbox.html.pane = this;
  gListbox.plaintext.pane = this;
}

function AddDomain(aType)
{
  var domains = null;
  var result = {value: null};
  if (Services.prompt.prompt(window, gListbox[aType].getAttribute("title"),
                             gListbox[aType].getAttribute("msg"), result,
                             null, {value: 0}))
    domains = result.value.replace(/ /g, "").split(",");

  if (domains)
  {
    var added = false;
    var removed = false;
    var listbox = gListbox[aType];
    var other = aType == "html" ? gListbox.plaintext : gListbox.html;
    for (var i = 0; i < domains.length; i++)
    {
      var domainName = TidyDomainName(domains[i], true);
      if (domainName)
      {
        if (!DomainFirstMatch(listbox, domainName))
        {
          var match = DomainFirstMatch(other, domainName);
          if (match)
          {
            other.removeChild(match);
            removed = true;
          }
          listbox.appendItem(domainName);
          added = true;
        }
      }
    }
    if (added)
      listbox.doCommand();
    if (removed)
      other.doCommand();
  }
}

function TidyDomainName(aDomain, aWarn)
{
  // See if it is an email address and if so take just the domain part.
  aDomain = aDomain.replace(/.*@/, "");

  // See if it is a valid domain otherwise return null.
  if (!/.\../.test(aDomain))
  {
    if (aWarn)
    {
      var errorMsg = gError.getAttribute("inverr").replace(/@string@/, aDomain);
      Services.prompt.alert(window, gError.getAttribute("title"), errorMsg);
    }
    return null;
  }

  // Finally make sure the domain is in lowercase.
  return aDomain.toLowerCase();
}

function DomainFirstMatch(aListbox, aDomain)
{
  return aListbox.getElementsByAttribute("label", aDomain).item(0);
}

function RemoveDomains(aType, aEvent)
{
  if (aEvent && aEvent.keyCode != KeyEvent.DOM_VK_DELETE &&
      aEvent.keyCode != KeyEvent.DOM_VK_BACK_SPACE)
    return;

  var nextNode = null;
  var listbox = gListbox[aType];

  while (listbox.selectedItem)
  {
    var selectedNode = listbox.selectedItem;
    nextNode = selectedNode.nextSibling || selectedNode.previousSibling;
    listbox.removeChild(selectedNode);
  }

  if (nextNode)
    listbox.selectItem(nextNode);

  listbox.doCommand();
}

function ReadDomains(aListbox)
{
  var arrayOfPrefs = gPref[aListbox.id].value.replace(/ /g, "").split(",");
  if (arrayOfPrefs)
  {
    var i;
    // Check all the existing items, remove any that are not needed and
    // make sure we do not duplicate any by removing from pref array.
    var domains = aListbox.getElementsByAttribute("label", "*");
    if (domains)
    {
      for (i = domains.length; --i >= 0; )
      {
        var domain = domains[i];
        var index = arrayOfPrefs.indexOf(domain.label);
        if (index > -1)
          arrayOfPrefs.splice(index, 1);
        else
          aListbox.removeChild(domain);
      }
    }
    for (i = 0; i < arrayOfPrefs.length; i++)
    {
      var str = TidyDomainName(arrayOfPrefs[i], false);
      if (str)
        aListbox.appendItem(str);
    }
  }
}

function WriteDomains(aListbox)
{
  var domains = aListbox.getElementsByAttribute("label", "*");
  return Array.map(domains, function(e) { return e.label; }).join(",");
}
