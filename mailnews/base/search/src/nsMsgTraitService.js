/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// local static variables

var _lastIndex = 0;  // the first index will be one
var _traits = {};

var traitsBranch = Services.prefs.getBranch("mailnews.traits.");

function _registerTrait(aId, aIndex)
{
  var trait = {};
  trait.enabled = false;
  trait.name = "";
  trait.antiId = "";
  trait.index = aIndex;
  _traits[aId] = trait;
  return;
}

function nsMsgTraitService() {}

nsMsgTraitService.prototype =
{
  // Component setup
  classID: Components.ID("{A2E95F4F-DA72-4a41-9493-661AD353C00A}"),

  QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.nsIMsgTraitService]),

  // nsIMsgTraitService implementation

  get lastIndex()
  {
    return _lastIndex;
  },

  registerTrait: function(aId)
  {
    if (_traits[aId])
      return 0;  // meaning already registered
    _registerTrait(aId, ++_lastIndex);
    traitsBranch.setBoolPref("enabled." + _lastIndex, false);
    traitsBranch.setCharPref("id." + _lastIndex, aId);
    return _lastIndex;
  },

  unRegisterTrait: function(aId)
  {
    if (_traits[aId])
    {
      var index = _traits[aId].index;
      _traits[aId] = null;
      traitsBranch.clearUserPref("id." + index);
      traitsBranch.clearUserPref("enabled." + index);
      traitsBranch.clearUserPref("antiId." + index);
      traitsBranch.clearUserPref("name." + index);
    }
    return;
  },

  isRegistered: function(aId)
  {
    return _traits[aId] ? true : false;
  },

  setName: function(aId, aName)
  {
    traitsBranch.setCharPref("name." + _traits[aId].index, aName);
    _traits[aId].name = aName;
  },

  getName: function(aId)
  {
    return _traits[aId].name;
  },

  getIndex: function(aId)
  {
    return _traits[aId].index;
  },

  getId: function(aIndex)
  {
    for (let id in _traits)
      if (_traits[id].index == aIndex)
        return id;
    return null;
  },

  setEnabled: function(aId, aEnabled)
  {
    traitsBranch.setBoolPref("enabled." + _traits[aId].index, aEnabled);
    _traits[aId].enabled = aEnabled;
  },

  getEnabled: function(aId)
  {
    return _traits[aId].enabled;
  },

  setAntiId: function(aId, aAntiId)
  {
    traitsBranch.setCharPref("antiId." + _traits[aId].index, aAntiId);
    _traits[aId].antiId = aAntiId;
  },

  getAntiId: function(aId)
  {
    return _traits[aId].antiId;
  },

  getEnabledIndices: function(aCount, aProIndices, aAntiIndices)
  {
    let proIndices = [];
    let antiIndices = [];
    for (let id in _traits)
      if (_traits[id].enabled)
      {
        proIndices.push(_traits[id].index);
        antiIndices.push(_traits[_traits[id].antiId].index);
      }
    aCount.value = proIndices.length;
    aProIndices.value = proIndices;
    aAntiIndices.value = antiIndices;
    return;
  },

  addAlias: function addAlias(aTraitIndex, aTraitAliasIndex)
  {
    let aliasesString = "";
    try {
      aliasesString = traitsBranch.getCharPref("aliases." + aTraitIndex);
    }
    catch (e) {}
    let aliases;
    if (aliasesString.length)
      aliases = aliasesString.split(",");
    else
      aliases = [];
    if (aliases.indexOf(aTraitAliasIndex.toString()) == -1)
    {
      aliases.push(aTraitAliasIndex);
      traitsBranch.setCharPref("aliases." + aTraitIndex, aliases.join());
    }
  },

  removeAlias: function removeAlias(aTraitIndex, aTraitAliasIndex)
  {
    let aliasesString = "";
    try {
      aliasesString = traitsBranch.getCharPref("aliases." + aTraitIndex);
    }
    catch (e) {
      return;
    }
    let aliases;
    if (aliasesString.length)
      aliases = aliasesString.split(",");
    else
      aliases = [];
    let location;
    if ((location = aliases.indexOf(aTraitAliasIndex.toString())) != -1)
    {
      aliases.splice(location, 1);
      traitsBranch.setCharPref("aliases." + aTraitIndex, aliases.join());
    }
  },

  getAliases: function getAliases(aTraitIndex, aLength)
  {
    let aliasesString = "";
    try {
      aliasesString = traitsBranch.getCharPref("aliases." + aTraitIndex);
    }
    catch (e) {}

    let aliases;
    if (aliasesString.length)
      aliases = aliasesString.split(",");
    else
      aliases = [];
    aLength.value = aliases.length;
    return aliases;
  },
};

// initialization

_init();

function _init()
{
  // get existing traits
  var idBranch = Services.prefs.getBranch("mailnews.traits.id.");
  var nameBranch = Services.prefs.getBranch("mailnews.traits.name.");
  var enabledBranch = Services.prefs.getBranch("mailnews.traits.enabled.");
  var antiIdBranch = Services.prefs.getBranch("mailnews.traits.antiId.");
  _lastIndex = Services.prefs.getBranch("mailnews.traits.").getIntPref("lastIndex");
  var ids = idBranch.getChildList("");
  for (var i = 0; i < ids.length; i++)
  {
    var id = idBranch.getCharPref(ids[i]);
    var index = parseInt(ids[i]);
    _registerTrait(id, index, false);

    // Read in values, ignore errors since that usually means the
    // value does not exist
    try {
      _traits[id].name = nameBranch.getCharPref(ids[i]);
    }
    catch (e) {}

    try {
      _traits[id].enabled = enabledBranch.getBoolPref(ids[i]);
    }
    catch (e) {}

    try {
      _traits[id].antiId = antiIdBranch.getCharPref(ids[i]);
    }
    catch (e) {}

    if (_lastIndex < index)
      _lastIndex = index;
  }

  //for (traitId in _traits)
  //  dump("\nindex of " + traitId + " is " + _traits[traitId].index);
  //dump("\n");
}

var components = [nsMsgTraitService];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
