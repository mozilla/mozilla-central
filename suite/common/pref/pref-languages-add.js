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
 *   Ian Neal <iann_bugzilla@blueyonder.co.uk>
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

var gLanguageNames;
var gAvailableLanguages;
var gOtherLanguages;
var gSelectedLanguages = [];
var gInvalidLanguages;

function OnLoadAddLanguages()
{
  gLanguageNames = window.arguments[0];
  gAvailableLanguages = document.getElementById("availableLanguages");
  gSelectedLanguages = document.getElementById("intl.accept_languages").value
                               .split(/\s*,\s*/);
  gOtherLanguages = document.getElementById("otherLanguages");

  if (gLanguageNames)
  {
    for (var i = 0; i < gLanguageNames.length; i++)
    {
      if (gSelectedLanguages.indexOf(gLanguageNames[i][1]) == -1)
        gAvailableLanguages.appendItem(gLanguageNames[i][0],
                                       gLanguageNames[i][1]);
    }
  }
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
  var checkedTags = 0;

  if (/^[ix]$/.test(tags[0]))
  {
    if (tags.length < 2)
      return false;
    checkedTags++;
  }
  else
  /* if not IANA "i" or a private "x" extension, the primary
     tag should be a ISO 639 country code, two or three letters long.
     we don't check if the country code is bogus or not.
  */
  {
    if (!/^[a-z]{2,3}$/.test(tags[0]))
      return false;
    checkedTags++;

    /* the first subtag can be either a 2 letter ISO 3166 country code,
       or an IANA registered tag from 3 to 8 characters.
    */
    if (tags.length > 1)
    {
      if (!/^[a-z0-9]{2,8}$/.test(tags[1]))
        return false;

      /* do not allow user-assigned ISO 3166 country codes */
      if (/^(aa|zz|x[a-z]|q[m-z])$/.test(tags[1]))
        return false;
      checkedTags++;
    }
  }

  /* any remaining subtags must be one to eight alphabetic characters */

  while (checkedTags < tags.length)
  {
    if (!/^[a-z0-9]{1,8}$/.test(tags[checkedTags]))
      return false;
    checkedTags++;
  }
  return true;
}

function WriteAddedLanguages(aListbox)
{
  var invalidLangs = [];
  // selected languages
  var languages = aListbox.selectedItems;
  var addedLang = Array.map(languages, function(e) { return e.value; });

  // user-defined languages
  languages = gOtherLanguages.value;
  if (languages)
  {
    let languageIds = languages.replace(/\s+/g, "").toLowerCase().split(",");
    for (var i = 0; i < languageIds.length; i++)
    {
      let languageId = languageIds[i];
      if (IsRFC1766LangTag(languageId))
      {
        if (addedLang.indexOf(languageId) == -1 &&
            gSelectedLanguages.indexOf(languageId) == -1)
          addedLang.push(languageId);
      }
      else
      {
        invalidLangs.push(languageId);
      }
    }
  }

  if (invalidLangs.length)
    gInvalidLanguages = invalidLangs.join(", ");
  else
    gSelectedLanguages = gSelectedLanguages.concat(addedLang);

  return gSelectedLanguages.join(",");
}

function OnAccept()
{
  if (!gInvalidLanguages)
    return true;

  let prefLangBundle = document.getElementById("prefLangAddBundle");
  const kErrorMsg = prefLangBundle.getString("illegalOtherLanguage") + " " +
                    gInvalidLanguages;
  const kErrorTitle = prefLangBundle.getString("illegalOtherLanguageTitle");
  let prompter = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                           .getService(Components.interfaces.nsIPromptService);
  prompter.alert(this.window, kErrorTitle, kErrorMsg);

  gInvalidLanguages = null;
  gOtherLanguages.focus();
  return false;
}

function HandleDoubleClick()
{
  document.documentElement.acceptDialog();
}

function DoBeforeAccept()
{
  gAvailableLanguages.doCommand();
}
