/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Adrian Havill <havill@redhat.com>
 *   Stefan Hermes <stefanh@inbox.com>
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

var gLangObj;                             
var availableLanguages;
var otherField;

function Startup()
{ 
  gLangObj = window.arguments[0];
  availableLanguages = document.getElementById("availableLanguages");
  otherField = document.getElementById("otherLanguages");
  LoadAvailableLanguages();
}

function LoadAvailableLanguages()
{
  if (gLangObj.availLanguageDict)
  {
    for (var i = 0; i < gLangObj.availLanguageDict.length; i++)
    {
      if (gLangObj.availLanguageDict[i][2] == "true")
        AddListItem(document, availableLanguages, gLangObj.availLanguageDict[i][1], gLangObj.availLanguageDict[i][0]);
    }
  }
}

function IsAlpha(aMixedCase)
{
  var allCaps = aMixedCase.toUpperCase();
  for (var i = allCaps.length - 1; i >= 0; i--)
  {
    let c = allCaps.charAt(i);
    if (c < 'A' || c > 'Z') return false;
  }
  return true;
}

function IsAlphaNum(aMixedCase)
{
  var allCaps = aMixedCase.toUpperCase();
  for (var i = allCaps.length - 1; i >= 0; i--)
  {
    let c = allCaps.charAt(i);
    if ((c < 'A' || c > 'Z') && (c < '0' || c > '9')) return false;
  }
  return true;
}

function IsRFC1766LangTag(aCandidate)
{

  /* reject bogus lang strings, INCLUDING those with HTTP "q"
     values kludged on the end of them

     Valid language codes examples:
     i.e. ja-JP-kansai (Kansai dialect of Japanese)
          en-US-texas (Texas dialect)
          i-klingon-tng (did TOS Klingons speak in non-English?)
          sgn-US-MA (Martha Vineyard's Sign Language)
  */
  var tags = aCandidate.split('-');

  /* if not IANA "i" or a private "x" extension, the primary
     tag should be a ISO 639 country code, two or three letters long.
     we don't check if the country code is bogus or not.
  */
  var checkedTags = 0;
  if (tags[0].toLowerCase() != "x" && tags[0].toLowerCase() != "i")
  {
    if (tags[0].length != 2 && tags[0].length != 3) return false;
    if (!IsAlpha(tags[0])) return false;
    checkedTags++;

    /* the first subtag can be either a 2 letter ISO 3166 country code,
       or an IANA registered tag from 3 to 8 characters.
    */
    if (tags.length > 1)
    {
      if (tags[1].length < 2 || tags[1].length > 8) return false;
      if (!IsAlphaNum(tags[1])) return false;

      /* do not allow user-assigned ISO 3166 country codes */
      if (tags[1].length == 2 && IsAlpha(tags[1]))
      {
        var countryCode = tags[1].toUpperCase();
        if (countryCode == "AA" || countryCode == "ZZ") return false;
        if (countryCode[0] == 'X') return false;
        if (countryCode[0] == 'Q' && countryCode[1] > 'L') return false;
      }
      checkedTags++;
    }
  }
  else if (tags.length < 2) return false;
  else
  {
    if ((tags[1].length < 1) || (tags[1].length > 8)) return false;
    if (!IsAlphaNum(tags[1])) return false;
    checkedTags++;
  }

  /* any remaining subtags must be one to eight alphabetic characters */

  for (var i = checkedTags; i < tags.length; i++)
  {
    if ((tags[1].length < 1) || (tags[i].length > 8)) return false;
    if (!IsAlphaNum(tags[i])) return false;
    checkedTags++;
  }
  return true;
}

function WriteAddedLanguages(aListbox)
{
  var addedLang = [];
  var prefString = document.getElementById("intl.accept_languages").value;

  //selected languages
  for (var i = 0; i < aListbox.selectedItems.length; i++)
  {
    let selItem = aListbox.selectedItems[i];
    let languageId = selItem.id;
    if (!LangAlreadyActive(languageId))
      addedLang.push(languageId);
  }

  //user-defined languages
  if (otherField.value)
  {
    let languageIdsString = otherField.value.replace(/\s/g,"").toLowerCase();
    let languageIds = languageIdsString.split(/\s*,\s*/);
    for (var i = 0; i < languageIds.length; i++)
    {
      let languageId = languageIds[i];
      
      if (IsRFC1766LangTag(languageId))
      {
        if (!LangAlreadySelected(languageId) && !LangAlreadyActive(languageId))
          addedLang.push(languageId);
      }
    }
  }

  if (addedLang.length > 0)
  {
    if (!prefString)
      prefString = addedLang[0];
    else
      prefString += ", " + addedLang[0];

    for (var i = 1; i < addedLang.length; i++)
      prefString += ", " + addedLang[i];
  }

  return prefString;
}

function CheckOtherField()
{
  if (!otherField.value)
    return true;

  var invalidLangs = [];
  var languageIdsString = otherField.value.replace(/\s/g,"").toLowerCase();
  var languageIds = languageIdsString.split(/\s*,\s*/);

  languageIds.forEach(function(aElement) {
    if (!IsRFC1766LangTag(aElement))
      invalidLangs.push(aElement);
  });

  if (invalidLangs.length > 0)
  {
    let prefLangBundle = document.getElementById("prefLangBundle");
    const errorMsg = prefLangBundle.getString("illegalOtherLanguage") + " " +
                     invalidLangs.join(", ");
    const errorTitle = prefLangBundle.getString("illegalOtherLanguageTitle");
    let prompter = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                             .getService(Components.interfaces.nsIPromptService);
    prompter.alert(this.window, errorTitle, errorMsg);
    otherField.focus();
    return false;
  }

  return true;
}


function LangAlreadySelected(aLangID)
{
  return availableLanguages.selectedItems.some(AlreadyExists, aLangID);
}

function LangAlreadyActive(aLangID)
{
  var prefString = document.getElementById("intl.accept_languages").value;
  var arrayOfPrefs = prefString.split(/\s*,\s*/);

  if (arrayOfPrefs)
    return arrayOfPrefs.some(AlreadyExists, aLangID);

  return false;
}

function AlreadyExists(aElement, aIndex, aArray, aLangID)
{
  return (aElement == this)
}

function HandleDoubleClick()
{
  document.documentElement.acceptDialog();
}

function DoBeforeAccept()
{
  availableLanguages.doCommand();
}

function AddListItem(doc, listbox, langID, langTitle)
{
  try {  //let's beef up our error handling for languages without label / title

      // Create a listitem for the new Language
      var item = doc.createElement('listitem');

      // Copy over the attributes
      item.setAttribute('label', langTitle);
      item.id = langID;

      listbox.appendChild(item);

  } //try

  catch (ex) {
  } //catch
}
