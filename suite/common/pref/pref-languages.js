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

//Dictionary of all available languages
var langObj = { availLanguageDict: [] };

var activeLanguages;

function Startup()
{
  var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                  .getService(Components.interfaces.nsIObserverService);
  observerService.notifyObservers(null, "charsetmenu-selected", "other");

  var defaultCharsetList = document.getElementById("DefaultCharsetList");
  defaultCharsetList.setAttribute("ref", "NC:DecodersRoot");

  activeLanguages = document.getElementById("activeLanguages");

  ReadAvailableLanguages();
}

function AddLanguage()
{
  document.documentElement.openSubDialog("chrome://communicator/content/pref/pref-languages-add.xul","addlangwindow", langObj);
}

function ReadAvailableLanguages()
{
  var i =0;
  var languagesBundle = document.getElementById("languagesBundle");
  var prefLangBundle = document.getElementById("prefLangBundle");
  var regionsBundle = document.getElementById("regionsBundle");
  var langStrings = document.getElementById("acceptedBundle").strings;

  while (langStrings.hasMoreElements())
  {
    //progress through the bundle
    var curItem = langStrings.getNext();

    if (!(curItem instanceof Components.interfaces.nsIPropertyElement))
      break;

    var stringNameProperty = curItem.key.split('.');

    if (stringNameProperty[1] == 'accept')
    {
        var str = stringNameProperty[0];
        var stringLangRegion = stringNameProperty[0].split('-');
        var tit;

        if (stringLangRegion[0])
        {
          var language;
          var region;
          var useRegionFormat = false;

          try {
            language = languagesBundle.getString(stringLangRegion[0]);
          }
          catch (ex) {
            language = "";
          }

          if (stringLangRegion.length > 1)
          {

            try {
              region = regionsBundle.getString(stringLangRegion[1]);
              useRegionFormat = true;
            }
            catch (ex) {
            }
          }
          
          if (useRegionFormat)
            tit = prefLangBundle.getFormattedString("languageRegionCodeFormat",
                                                    [language, region, str]);
          else
            tit = prefLangBundle.getFormattedString("languageCodeFormat",
                                                    [language, str]);
        }

        if (str && tit)
        {
          langObj.availLanguageDict[i] = [];
          langObj.availLanguageDict[i].push(tit, str, curItem.value);
          i++;
        }
    }
  }

  langObj.availLanguageDict.sort( // sort on first element
    function compareFn(a, b) {
      return a[0].localeCompare(b[0]);
    });
}

function ReadActiveLanguages(aListbox)
{
  var prefString = document.getElementById("intl.accept_languages").value;
  var arrayOfPrefs = prefString.split(/\s*,\s*/);
  
  var listboxChildren = aListbox.childNodes;

  // No need to rebuild listitems if languages in prefs and listitems match.
  if (InSync(arrayOfPrefs, listboxChildren))
   return undefined;

  while (aListbox.hasChildNodes())
    aListbox.removeChild(aListbox.firstChild);

  arrayOfPrefs.forEach(function(aElement) {
    if (aElement)
    {
      let langTitle = GetLanguageTitle(aElement);

      if (!langTitle)
       langTitle = '[' + aElement + ']';

      let listitem = document.createElement('listitem');
      listitem.setAttribute('label', langTitle);
      listitem.id = aElement;
      aListbox.appendChild(listitem);
    }
  });

  SelectLanguage();

  return undefined;
}

// Checks whether listitems and pref values matches, returns false if not
function InSync(aPrefArray, aListItemArray)
{
  // Can't match if they don't have the same length
  if (aPrefArray.length != aListItemArray.length)
    return false;

  return aPrefArray.every(IsTheSame, aListItemArray);
}

function IsTheSame(aElement, aIndex, aArray, aListItemArray)
{
  return (aElement == this[aIndex].id);
}

// Called on onsynctopreference
function WriteActiveLanguages(aListbox)
{
  var languages = 0;
  var prefString = "";

  for (var item = aListbox.firstChild; item != null; item = item.nextSibling)
  {
    var languageid = item.id;

    if (languageid.length > 1)
    {
      languages++;
      //separate > 1 languages by commas
      if (languages > 1)
        prefString += ", " + languageid;
      else
        prefString = languageid;
    }
  }
      
  return prefString;
}
   
function MoveUp()
{
  var selectedItems = activeLanguages.selectedIndex;
  var selections = activeLanguages.selectedItems;
  if (activeLanguages.selectedItems.length == 1)
  {
    var selected = activeLanguages.selectedItems[0];
    var before = selected.previousSibling
    if (before)
    {
      before.parentNode.insertBefore(selected, before);
      activeLanguages.selectItem(selected);
      activeLanguages.ensureElementIsVisible(selected);
    }
  }
  
  if (activeLanguages.selectedIndex == 0)
  {
    // selected item is first
    var moveUp = document.getElementById("up");
    moveUp.disabled = true;
  }

  if (activeLanguages.childNodes.length > 1)
  {
    // more than one item so we can move selected item back down
    var moveDown = document.getElementById("down");
    moveDown.disabled = false;
  }

  SelectLanguage();
  activeLanguages.doCommand();
}

function MoveDown()
{
  if (activeLanguages.selectedItems.length == 1)
  {
    var selected = activeLanguages.selectedItems[0];
    if (selected.nextSibling)
    {
      if (selected.nextSibling.nextSibling)
      {
        activeLanguages.insertBefore(selected, selected.nextSibling.nextSibling);
      }
      else
      {
        activeLanguages.appendChild(selected);
      }

      activeLanguages.selectItem(selected);
    }
  }

  if (activeLanguages.selectedIndex == activeLanguages.childNodes.length - 1)
  {
    // selected item is last
    var moveDown = document.getElementById("down");
    moveDown.disabled = true;
  }

  if (activeLanguages.childNodes.length > 1)
  {
    // more than one item so we can move selected item back up 
    var moveUp = document.getElementById("up");
    moveUp.disabled = false;
  }

  SelectLanguage();
  activeLanguages.doCommand();
}

function RemoveActiveLanguage()
{
  var nextNode = null;
  var numSelected = activeLanguages.selectedItems.length;

  for (var i = 0; i < numSelected; i++)
  {
    var selectedNode = activeLanguages.selectedItems[0];
    nextNode = selectedNode.nextSibling;

    if (!nextNode)
      if (selectedNode.previousSibling)
        nextNode = selectedNode.previousSibling;

    activeLanguages.removeChild(selectedNode);
  }

  if (nextNode)
    activeLanguages.selectItem(nextNode)

  SelectLanguage();
  activeLanguages.doCommand();
}

function GetLanguageTitle(id)
{

  if (langObj.availLanguageDict)
    for (var j = 0; j < langObj.availLanguageDict.length; j++)
    {
      if ( langObj.availLanguageDict[j][1] == id)
        return langObj.availLanguageDict[j][0];
    }

  return "";
}

function SelectLanguage()
{
  if (activeLanguages.selectedItems.length)
  {
    document.getElementById("remove").disabled = false;
    var selected = activeLanguages.selectedItems[0];
    document.getElementById("down").disabled = !selected.nextSibling;

    document.getElementById("up").disabled = !selected.previousSibling;
  }
  else
  {
    document.getElementById("remove").disabled = true;
    document.getElementById("down").disabled = true;
    document.getElementById("up").disabled = true;
  }
}

function LanguagesPaneKeyPress(aEvent)
{
  if (aEvent.keyCode == aEvent.DOM_VK_DELETE || aEvent.keyCode == aEvent.DOM_VK_BACK_SPACE)
    RemoveActiveLanguage();
}
