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
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const ts = Cc["@mozilla.org/msg-trait-service;1"]
             .getService(Ci.nsIMsgTraitService);
var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService);
var traitsBranch = prefs.getBranch("mailnews.traits.");

// junk-related traits set by default
const kJunkId = "mailnews@mozilla.org#junk";
const kGoodId = "mailnews@mozilla.org#good";
const kGoodIndex = Ci.nsIJunkMailPlugin.GOOD_TRAIT;
const kJunkIndex = Ci.nsIJunkMailPlugin.JUNK_TRAIT;

// a dummy set of traits
const proId = "TheProTrait";
const proName = "ProName";
const antiId = "TheAntiTrait";
const antiName = "AntiName";

function run_test()
{
  // Check lastIndex prior to adding, 3 - 1000 are reserved for mailnews
  do_check_eq(ts.lastIndex, 1000);

  // basic junk as traits should be setup automatically
  do_check_eq(kGoodId, traitsBranch.getCharPref("id." + kGoodIndex));
  do_check_eq(kJunkId, traitsBranch.getCharPref("id." + kJunkIndex));
  do_check_eq(kGoodId, traitsBranch.getCharPref("antiId." + kJunkIndex));
  do_check_true(traitsBranch.getBoolPref("enabled." + kJunkIndex));

  // add the pro and anti test traits
  do_check_false(ts.isRegistered(proId));
  var proIndex = ts.registerTrait(proId);
  do_check_true(ts.isRegistered(proId));
  do_check_eq(proIndex, 1001);
  do_check_eq(proIndex, ts.getIndex(proId));
  do_check_eq(proId, ts.getId(proIndex));
  var antiIndex = ts.registerTrait(antiId);
  do_check_eq(proIndex, 1001);
  do_check_eq(antiIndex, 1002);

  // check setting and getting things through the service
  ts.setName(proId, proName);
  do_check_eq(proName, ts.getName(proId));
  do_check_false(ts.getEnabled(proId));
  ts.setEnabled(proId, true);
  do_check_true(ts.getEnabled(proId));
  ts.setAntiId(proId, antiId);
  do_check_eq(antiId, ts.getAntiId(proId));
  var proArray = {};
  var antiArray = {};
  ts.getEnabledIndices({}, proArray, antiArray);
  do_check_eq(proArray.value.length, 2);
  do_check_eq(antiArray.value.length, 2);
  do_check_eq(proArray.value[1], proIndex);
  do_check_eq(antiArray.value[1], antiIndex);

  // now let's make sure this got saved in preferences
  do_check_eq(proId, traitsBranch.getCharPref("id." + proIndex));
  do_check_eq(proName, traitsBranch.getCharPref("name." + proIndex));
  do_check_true(traitsBranch.getBoolPref("enabled." + proIndex));
  do_check_eq(antiId, traitsBranch.getCharPref("antiId." + proIndex));

  // remove the pro trait
  ts.unRegisterTrait(proId);
  do_check_false(ts.isRegistered(proId));

  // check that this is also removed from prefs. The get calls should fail
  try {
    traitsBranch.getCharPref("id." + proIndex);
    do_check_true(false);
  }
  catch (e) {}

  try {
    traitsBranch.getCharPref("name." + proIndex);
    do_check_true(false);
  }
  catch (e) {}

  try {
    traitsBranch.getBoolPref("enabled." + proIndex);
    do_check_true(false);
  }
  catch (e) {}

  try {
    traitsBranch.getCharPref("antiId." + proIndex);
    do_check_true(false);
  }
  catch(e) {}
}
