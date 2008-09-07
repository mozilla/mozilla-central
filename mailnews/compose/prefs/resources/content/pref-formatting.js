/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ian Neal <iann_bugzilla@blueyonder.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gListbox;
var gPref;
var gError;
var gPromptService;

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
  gPromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                             .getService(Components.interfaces.nsIPromptService);
}

function AddDomain(aType)
{
  var domains = null;
  if (gPromptService)
  {
    var result = {value: null};
    if (gPromptService.prompt(window, gListbox[aType].getAttribute("title"),
                              gListbox[aType].getAttribute("msg"), result,
                              null, {value: 0}))
      domains = result.value.replace(/ /g, "").split(",");
  }

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
      if (gPromptService)
        gPromptService.alert(window, gError.getAttribute("title"), errorMsg);
      else
        window.alert(errorMsg);
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
