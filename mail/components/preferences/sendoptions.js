/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gSendOptionsDialog = {
  mPrefsBundle: null,
  mHTMLListBox: null,
  mPlainTextListBox: null,

  init: function ()
  {
    this.mPrefsBundle = document.getElementById('bundlePreferences'); 
    this.mHTMLListBox = document.getElementById('html_domains');
    this.mPlainTextListBox = document.getElementById('plaintext_domains');

    var htmlDomainPrefString = document.getElementById('mailnews.html_domains').value;
    this.loadDomains(document.getElementById('mailnews.html_domains').value, 
                     this.mHTMLListBox);
    this.loadDomains(document.getElementById('mailnews.plaintext_domains').value, 
                     this.mPlainTextListBox);
  },

  saveDomainPref: function(aHTML)
  {
    var listbox = aHTML ? this.mHTMLListBox : this.mPlainTextListBox;
    var num_domains = 0;
    var pref_string = "";

    for (var item = listbox.firstChild; item != null; item = item.nextSibling) 
    {
      var domainid = item.getAttribute('label');
      if (domainid.length > 1) 
      {
        num_domains++;

        //separate >1 domains by commas
        if (num_domains > 1)
          pref_string = pref_string + "," + domainid;
        else
          pref_string = domainid;
      }
    }
    
    return pref_string;
  },

  loadDomains: function (aPrefString, aListBox)
  {
    var arrayOfPrefs = aPrefString.split(',');
    if (arrayOfPrefs)
      for (var i = 0; i < arrayOfPrefs.length; i++) 
      {
        var str = arrayOfPrefs[i].replace(/ /g,"");
        if (str)
          this.addItemToDomainList(aListBox, str);
      }
  },

  removeDomains: function(aHTML)
  {
    var listbox = aHTML ? this.mHTMLListBox : this.mPlainTextListBox;

    var currentIndex = listbox.currentIndex;

    while (listbox.selectedItems.length > 0) 
      listbox.removeChild(listbox.selectedItems[0]);

    document.getElementById('SendOptionsDialogPane').userChangedValue(listbox);
  },

  addDomain: function (aHTML)
  {
    var listbox = aHTML ? this.mHTMLListBox : this.mPlainTextListBox;
      
    var domainName;
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService();
    promptService = promptService.QueryInterface(Components.interfaces.nsIPromptService);

    if (promptService)
    {
      var result = {value:null};
      if (promptService.prompt(window, this.mPrefsBundle.getString(listbox.id + 'AddDomainTitle'),
                               this.mPrefsBundle.getString(listbox.id + 'AddDomain'), result, null, {value:0}))
        domainName = result.value.replace(/ /g,"");
    }

    if (domainName && !this.domainAlreadyPresent(domainName))
    {
      this.addItemToDomainList(listbox, domainName);
      document.getElementById('SendOptionsDialogPane').userChangedValue(listbox);
    }

  },

  domainAlreadyPresent: function(aDomainName)
  {
    var matchingDomains = this.mHTMLListBox.getElementsByAttribute('label', aDomainName);
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService();
    promptService = promptService.QueryInterface(Components.interfaces.nsIPromptService);

    if (!matchingDomains.length)
      matchingDomains = this.mPlainTextListBox.getElementsByAttribute('label', aDomainName);

    if (matchingDomains.length)
    {
      promptService.alert(window, this.mPrefsBundle.getString('domainNameErrorTitle'), 
                         this.mPrefsBundle.getFormattedString("domainDuplicationError", [aDomainName]));
    }

    return matchingDomains.length;
  },

  addItemToDomainList: function (aListBox, aDomainTitle)
  {
    var item = document.createElement('listitem');
    item.setAttribute('label', aDomainTitle);
    aListBox.appendChild(item);
  }
};
