/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;
var gMailView = null;

var dialog;

function mailViewOnLoad()
{
  initializeSearchWidgets();
  initializeMailViewOverrides();
  dialog = {};

  if ("arguments" in window && window.arguments[0]) 
  {
    var args = window.arguments[0];
    if ("mailView" in args) 
      gMailView = window.arguments[0].mailView; 
    if ("onOkCallback" in args)
      dialog.okCallback =  window.arguments[0].onOkCallback;
  }

  dialog.OKButton = document.documentElement.getButton("accept");
  dialog.nameField = document.getElementById("name");
  dialog.nameField.focus();

  setSearchScope(nsMsgSearchScope.offlineMail);  

  if (gMailView)
  {
    dialog.nameField.value = gMailView.prettyName;
    initializeSearchRows(nsMsgSearchScope.offlineMail, gMailView.searchTerms);
  }
  else
    onMore(null);
 
  doEnabling();
}

function mailViewOnUnLoad()
{

}

function onOK()
{
  var mailViewList = Components.classes["@mozilla.org/messenger/mailviewlist;1"].getService(Components.interfaces.nsIMsgMailViewList);
  
  // reflect the search widgets back into the search session
  var newMailView = null;
  if (gMailView)
  {
    saveSearchTerms(gMailView.searchTerms, gMailView);
    // if the name of the view has been changed...
    if (gMailView.prettyName != dialog.nameField.value)
      gMailView.mailViewName = dialog.nameField.value;
  }
  else  
  {
    // otherwise, create a new mail view 
    newMailView = mailViewList.createMailView();

    saveSearchTerms(newMailView.searchTerms, newMailView);
    newMailView.mailViewName = dialog.nameField.value;
    // now add the mail view to our mail view list
    mailViewList.addMailView(newMailView);
  }
    
  mailViewList.save();
 
  if (dialog.okCallback)
    dialog.okCallback(gMailView ? gMailView : newMailView);

  return true;
}

function initializeMailViewOverrides()
{
  // replace some text with something we want. Need to add some ids to searchOverlay.js
  //var orButton = document.getElementById('or');
  //orButton.setAttribute('label', 'Any of the following');
  //var andButton = document.getElementById('and');
  //andButton.setAttribute('label', 'All of the following');
  // matchAll doesn't make sense for views, since views are a single folder
  hideMatchAllItem();
  
}

function UpdateAfterCustomHeaderChange()
{
  updateSearchAttributes();
}

function doEnabling()
{
  if (dialog.nameField.value) 
  {
    if (dialog.OKButton.disabled)
      dialog.OKButton.disabled = false;
  } else 
  {
    if (!dialog.OKButton.disabled)
      dialog.OKButton.disabled = true;
  }
}

function onEnterInSearchTerm()
{
  // no-op for us...
}

function doHelpButton()
{
  openHelp("message-views-create-new");
}

