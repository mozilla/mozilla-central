/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ts = Cc["@mozilla.org/msg-trait-service;1"]
             .getService(Ci.nsIMsgTraitService);

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
  do_check_eq(kGoodId,
              Services.prefs.getCharPref("mailnews.traits.id." + kGoodIndex));
  do_check_eq(kJunkId,
              Services.prefs.getCharPref("mailnews.traits.id." + kJunkIndex));
  do_check_eq(kGoodId,
              Services.prefs.getCharPref("mailnews.traits.antiId." + kJunkIndex));
  do_check_true(Services.prefs.getBoolPref("mailnews.traits.enabled." + kJunkIndex));

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

  // check of aliases
  // add three random aliases
  ts.addAlias(1, 501);
  ts.addAlias(1, 502);
  ts.addAlias(1, 601);
  let aliases = ts.getAliases(1, {});
  do_check_eq(aliases[0], 501);
  do_check_eq(aliases[1], 502);
  do_check_eq(aliases[2], 601);

  // remove the middle one
  ts.removeAlias(1, 502);
  aliases = ts.getAliases(1, {});
  do_check_eq(aliases.length, 2);
  do_check_eq(aliases[0], 501);
  do_check_eq(aliases[1], 601);

  // try to add an existing value
  ts.addAlias(1, 501);
  aliases = ts.getAliases(1, {});
  do_check_eq(aliases.length, 2);
  do_check_eq(aliases[0], 501);
  do_check_eq(aliases[1], 601);

  // now let's make sure this got saved in preferences
  do_check_eq(proId,
              Services.prefs.getCharPref("mailnews.traits.id." + proIndex));
  do_check_eq(proName,
              Services.prefs.getCharPref("mailnews.traits.name." + proIndex));
  do_check_true(Services.prefs.getBoolPref("mailnews.traits.enabled." + proIndex));
  do_check_eq(antiId,
              Services.prefs.getCharPref("mailnews.traits.antiId." + proIndex));

  // remove the pro trait
  ts.unRegisterTrait(proId);
  do_check_false(ts.isRegistered(proId));

  // check that this is also removed from prefs. The get calls should fail
  try {
    Services.prefs.getCharPref("mailnews.traits.id." + proIndex);
    do_check_true(false);
  }
  catch (e) {}

  try {
    Services.prefs.getCharPref("mailnews.traits.name." + proIndex);
    do_check_true(false);
  }
  catch (e) {}

  try {
    Services.prefs.getBoolPref("mailnews.traits.enabled." + proIndex);
    do_check_true(false);
  }
  catch (e) {}

  try {
    Services.prefs.getCharPref("mailnews.traits.antiId." + proIndex);
    do_check_true(false);
  }
  catch(e) {}
}
