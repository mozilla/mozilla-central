/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* functions for disabling front end elements when the appropriate
   back-end preference is locked. */

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Prefs in MailNews require dynamic portions to indicate
 * which of multiple servers or identities. This function
 * takes a string and a xul element.
 *
 * @param aStr  The string is a prefstring with a token %tokenname%.
 * @param aElement  The xul element has an attribute of name |tokenname|
 *                  whose value is substituted into the string and returned
 *                  by the function.
 *
 * Any tokens which do not have associated attribute value
 * are not substituted, and left in the string as-is.
 */
function substPrefTokens(aStr, aElement)
{
  let tokenpat = /%(\w+)%/;
  let token;
  let newprefstr = "";

  let prefPartsArray = aStr.split(".");
  /* here's a little loop that goes through
     each part of the string separated by a dot, and
     if any parts are of the form %string%, it will replace
     them with the value of the attribute of that name from
     the xul object */
  for (let i = 0; i < prefPartsArray.length; i++) {
    token = prefPartsArray[i].match(tokenpat);
    if (token) { /* we've got a %% match */
      if (token[1]) {
        if (aElement[token[1]]) {
          newprefstr += aElement[token[1]] + "."; // here's where we get the info
        } else { /* all we got was this stinkin % */
          newprefstr += prefPartsArray[i] + ".";
        }
      }
    } else /* if (token) */ {
      newprefstr += prefPartsArray[i] + ".";
    }
  }
  newprefstr = newprefstr.slice(0, -1); // remove the last char, a dot
  if (newprefstr.length <= 0)
    newprefstr = null;

  return newprefstr;
}

/**
 * A simple function to check if a pref in an element is locked.
 *
 * @param aElement  a xul element with the pref related attributes
 *                 (pref, preftype, prefstring)
 * @return  whether the prefstring specified in that element is
 *          locked (true/false).
 *          If it does not have a valid prefstring, a false is returned.
 */
function getAccountValueIsLocked(aElement)
{
  let prefstring = aElement.getAttribute("prefstring");
  if (prefstring) {
    let prefstr = substPrefTokens(prefstring, aElement);
    // see if the prefstring is locked
    if (prefstr)
      return Services.prefs.prefIsLocked(prefstr);
  }
  return false;
}

/**
 * Enables/disables element (slave) according to the checked state
 * of another elements (masters).
 *
 * @param aChangeElementId  Slave element which should be enabled
 *                          if all the checkElementIDs are checked.
 *                          Otherwise it gets disabled.
 * @param aCheckElementIds  An array of IDs of the master elements.
 *
 * See bug 728681 for the pattern on how this is used.
 */
function onCheckItem(aChangeElementId, aCheckElementIds)
{
  let elementToControl = document.getElementById(aChangeElementId);
  let disabled = false;

  for each (let notifyId in aCheckElementIds) {
    let notifyElement = document.getElementById(notifyId);
    let notifyElementState = null;
    if ("checked" in notifyElement)
      notifyElementState = notifyElement.checked;
    else if ("selected" in notifyElement)
      notifyElementState = notifyElement.selected;
    else
      Components.utils.reportError("Unknown type of control element: " + notifyElement.id);

    if (!notifyElementState) {
      disabled = true;
      break;
    }
  }

  if (!disabled && getAccountValueIsLocked(elementToControl))
    disabled = true;

  elementToControl.disabled = disabled;
}
