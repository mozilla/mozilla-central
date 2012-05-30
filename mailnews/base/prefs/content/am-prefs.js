/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/* functions for disabling front end elements when the appropriate
   back-end preference is locked. */


var nsPrefBranch = null;

// Prefs in mailnews require dynamic portions to indicate 
// which of multiple servers or identies.  This function
// takes a string and a xul element.
//  The string is a prefstring with a token %tokenname%.
//  The xul element has an attribute of name |tokenname|
//  whose value is substituted into the string and returned
//  by the function.
//  Any tokens which do not have associated attribute value
//  are not substituted, and left in the string as-is.
function substPrefTokens(aStr, element)
{
  var tokenpat = /%(\w+)%/;
  var token;
  var newprefstr = "";

  var prefPartsArray = aStr.split(".");
  /* here's a little loop that goes through
     each part of the string separated by a dot, and
     if any parts are of the form %string%, it will replace
     them with the value of the attribute of that name from
     the xul object */
  for (var i=0; i< prefPartsArray.length; i++) {
    token = prefPartsArray[i].match(tokenpat);
    if (token) { /* we've got a %% match */
      if (token[1]) {
        if (element[token[1]]) {
          newprefstr += element[token[1]] + "."; // here's where we get the info
        } else { /* all we got was this stinkin % */
          newprefstr += prefPartsArray[i] + ".";
        }
      }
    } else /* if (token) */ {
      newprefstr += prefPartsArray[i] + ".";
    }
  }
  newprefstr = newprefstr.slice(0,-1); // remove the last char, a dot
  if (newprefstr.length <=0 )
    newprefstr = null;

  return newprefstr;
}

// A simple function which given a xul element with
// the pref related attributes (pref, preftype, prefstring)
// return if the prefstring specified in that element is
// locked (true/false).
// If it does not have a valid prefstring, a false is returned.
function getAccountValueIsLocked(element)
{
  var prefstr = "";
  var preftype;
  var prefval;
  var prefstring;

  if (!nsPrefBranch) {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"];
    prefService = prefService.getService();
    prefService = prefService.QueryInterface(Components.interfaces.nsIPrefService);

    nsPrefBranch = prefService.getBranch(null);
  }

  prefstring = element.getAttribute("prefstring");
  if (prefstring) {
    preftype    = element.getAttribute("preftype");
    prefstr = substPrefTokens(prefstring, element);
    // see if the prefstring is locked
    if (prefstr) {
      var bLocked=nsPrefBranch.prefIsLocked(prefstr);
      return bLocked;
    }
  }
  return false;
}

/**
 * Enables/disables element (slave) according to the checked state
 * of another element (master).
 *
 * @param changeElementId  slave element which should be enabled/disabled
 *                         if the checkElement is checked/unchecked
 * @param checkElementId  the master element which changed .checked state
 *
 * See bug 728681 for the pattern on how this is used.
 */
function onCheckItem(changeElementId, checkElementId)
{
  let element = document.getElementById(changeElementId);
  let notify = document.getElementById(checkElementId);

  if (notify.checked && !getAccountValueIsLocked(notify))
    element.removeAttribute("disabled");
  else
    element.setAttribute("disabled", "true");
}
