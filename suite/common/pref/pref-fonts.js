/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Gervase Markham <gerv@gerv.net>
 *   Tuukka Tolvanen <tt@lament.cjb.net>
 *   Stefan Borggraefe <Stefan.Borggraefe@gmx.de>
 *   Ben Goodger <ben@mozilla.org>
 *   Asaf Romano <mozilla.mano@sent.com>
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

var gAllFonts = null;
var gFontEnumerator = null;
var gDisabled = false;

function GetFontEnumerator()
{
  if (!gFontEnumerator)
  {
    gFontEnumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
                                .createInstance(Components.interfaces.nsIFontEnumerator);
  }
  return gFontEnumerator;
}

function BuildFontList(aLanguage, aFontType, aMenuList, aPreference)
{
  var defaultFont = null;
  // Load Font Lists
  var fonts = GetFontEnumerator().EnumerateFonts(aLanguage, aFontType, {});
  if (fonts.length)
  {
    defaultFont = GetFontEnumerator().getDefaultFont(aLanguage, aFontType);
  }
  else
  {
    fonts = GetFontEnumerator().EnumerateFonts(aLanguage, "", {});
    if (fonts.length)
      defaultFont = GetFontEnumerator().getDefaultFont(aLanguage, "");
  }

  if (!gAllFonts)
    gAllFonts = GetFontEnumerator().EnumerateAllFonts({});

  // Reset the list
  while (aMenuList.hasChildNodes())
    aMenuList.removeChild(aMenuList.firstChild);

  // Build the UI for the Default Font and Fonts for this CSS type.
  var popup = document.createElement("menupopup");
  var separator;
  if (fonts.length)
  {
    if (defaultFont)
    {
      var bundlePreferences = document.getElementById("bundleFontsPreferences");
      var label = bundlePreferences.getFormattedString("labelDefaultFont", [defaultFont]);
      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", label);
      menuitem.setAttribute("value", ""); // Default Font has a blank value
      popup.appendChild(menuitem);

      separator = document.createElement("menuseparator");
      popup.appendChild(separator);
    }

    for (var i = 0; i < fonts.length; ++i)
    {
      menuitem = document.createElement("menuitem");
      menuitem.setAttribute("value", fonts[i]);
      menuitem.setAttribute("label", fonts[i]);
      popup.appendChild(menuitem);
    }
  }

  // Build the UI for the remaining fonts.
  if (gAllFonts.length > fonts.length)
  {
    // Both lists are sorted, and the Fonts-By-Type list is a subset of the
    // All-Fonts list, so walk both lists side-by-side, skipping values we've
    // already created menu items for.

    if (fonts.length)
    {
      separator = document.createElement("menuseparator");
      popup.appendChild(separator);
    }

    for (i = 0; i < gAllFonts.length; ++i)
    {
      if (fonts.lastIndexOf(gAllFonts[i], 0) == 0)
      {
        fonts.shift(); //Remove matched font from array
      }
      else
      {
        menuitem = document.createElement("menuitem");
        menuitem.setAttribute("value", gAllFonts[i]);
        menuitem.setAttribute("label", gAllFonts[i]);
        popup.appendChild(menuitem);
      }
    }
  }
  aMenuList.appendChild(popup);

  // Fully populated so re-enable menulist before setting preference,
  // unless panel is locked.
  if (!gDisabled)
    aMenuList.disabled = false;
  aMenuList.setAttribute("preference", aPreference.id);
  aPreference.setElementValue(aMenuList);
}

function ReadFontLanguageGroup()
{
  var prefs = [{format: "default",       type: "string",  element: "defaultFontType", fonttype: ""          },
               {format: "name.",         type: "unichar", element: "serif",           fonttype: "serif"     },
               {format: "name.",         type: "unichar", element: "sans-serif",      fonttype: "sans-serif"},
               {format: "name.",         type: "unichar", element: "monospace",       fonttype: "monospace" },
               {format: "name.",         type: "unichar", element: "cursive",         fonttype: "cursive"   },
               {format: "name.",         type: "unichar", element: "fantasy",         fonttype: "fantasy"   },
               {format: "name-list.",    type: "unichar", element: null,              fonttype: "serif"     },
               {format: "name-list.",    type: "unichar", element: null,              fonttype: "sans-serif"},
               {format: "name-list.",    type: "unichar", element: null,              fonttype: "monospace" },
               {format: "name-list.",    type: "unichar", element: null,              fonttype: "cursive"   },
               {format: "name-list.",    type: "unichar", element: null,              fonttype: "fantasy"   },
               {format: "size.variable", type: "int",     element: "sizeVar",         fonttype: ""          },
               {format: "size.fixed",    type: "int",     element: "sizeMono",        fonttype: ""          },
               {format: "minimum-size",  type: "int",     element: "minSize",         fonttype: ""          }];
  gDisabled = document.getElementById("browser.display.languageList").locked;
  var fontLanguage = document.getElementById("font.language.group");
  if (gDisabled)
    fontLanguage.disabled = true;
  var languageGroup = fontLanguage.value;
  var preferences = document.getElementById("fonts_preferences");
  for (var i = 0; i < prefs.length; ++i)
  {
    var name = "font."+ prefs[i].format + prefs[i].fonttype + "." + languageGroup;
    var preference = document.getElementById(name);
    if (!preference)
    {
      preference = document.createElement("preference");
      preference.id = name;
      preference.setAttribute("name", name);
      preference.setAttribute("type", prefs[i].type);
      preferences.appendChild(preference);
    }

    if (!prefs[i].element)
      continue;

    var element = document.getElementById(prefs[i].element);
    if (element)
    {
      if (prefs[i].fonttype)
      {
        // Set an empty label so it does not jump when items are added.
        element.setAttribute("label", "");
        // Disable menulist for the moment.
        element.disabled = true;
        // Lazily populate font lists, each gets re-enabled at the end.
        window.setTimeout(BuildFontList, 0, languageGroup,
                          prefs[i].fonttype, element, preference);
      }
      else
      {
        // Unless the panel is locked, make sure these elements are not
        // disabled just in case they were in the last language group.
        element.disabled = gDisabled;
        element.setAttribute("preference", preference.id);
        preference.setElementValue(element);
      }
    }
  }
}

function ReadFontSelection(aElement)
{
  // Determine the appropriate value to select, for the following cases:
  // - there is no setting 
  // - the font selected by the user is no longer present (e.g. deleted from
  //   fonts folder)
  var preference = document.getElementById(aElement.getAttribute("preference"));
  if (preference.value)
  {
    var fontItems = aElement.getElementsByAttribute("value", preference.value);

    // There is a setting that actually is in the list. Respect it.
    if (fontItems.length)
      return undefined;
  }

  var defaultValue = aElement.firstChild.firstChild.getAttribute("value");
  var languagePref = document.getElementById("font.language.group");
  preference = document.getElementById("font.name-list." + aElement.id + "." + languagePref.value);
  if (!preference || !preference.hasUserValue)
    return defaultValue;

  var fontNames = preference.value.split(",");

  for (var i = 0; i < fontNames.length; ++i)
  {
    fontItems = aElement.getElementsByAttribute("value", fontNames[i].trim());
    if (fontItems.length)
      return fontItems[0].getAttribute("value");
  }
  return defaultValue;
}

function ReadFontPref(aElement, aDefaultValue)
{
  // Check to see if preference value exists,
  // if not return given default value.
  var preference = document.getElementById(aElement.getAttribute("preference"));
  return preference.value || aDefaultValue;
}

function ReadUseDocumentFonts()
{
  var preference = document.getElementById("browser.display.use_document_fonts");
  return preference.value == 1;
}
 
function WriteUseDocumentFonts(aUseDocumentFonts)
{
  return aUseDocumentFonts.checked ? 1 : 0;
}
