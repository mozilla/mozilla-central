/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozilla.com>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const MODULE_NAME = 'prompt-helpers';

const RELATIVE_ROOT = '../shared-modules';

// we need this for the main controller
const MODULE_REQUIRES = ['mock-object-helpers'];
const kMockPromptServiceName = "Mock Prompt Service";
const kPromptServiceContractID = "@mozilla.org/embedcomp/prompt-service;1";
const kPromptServiceName = "Prompt Service";

let gMockAuthPromptReg;

function setupModule() {
  let moh = collector.getModule('mock-object-helpers');
  gMockAuthPromptReg = new moh.MockObjectReplacer("@mozilla.org/prompter;1",
                                                  MockAuthPromptFactoryConstructor);
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.gMockPromptService = gMockPromptService;
  module.gMockAuthPromptReg = gMockAuthPromptReg;
  module.gMockAuthPrompt = gMockAuthPrompt;
}

function MockAuthPromptFactoryConstructor() {
  return gMockAuthPromptFactory;
}

var gMockAuthPromptFactory = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPromptFactory]),
  getPrompt: function(aParent, aIID, aResult) {
    return gMockAuthPrompt.QueryInterface(aIID);
  }
}


var gMockAuthPrompt = {
  password: "",

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAuthPrompt]),

  prompt: function MAP_prompt(aTitle, aText, aRealm, aSave,
                              aDefaultText) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  promptUsernameAndPassword: function
      MAP_promptUsernameAndPassword(aTitle, aText, aRealm, aSave,
                                    aUser, aPwd) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  promptPassword: function MAP_promptPassword(aTitle, aText,
                                              aRealm, aSave,
                                              aPwd) {
    aPwd.value = this.password;
    return true;
  }
};

var gMockPromptService = {
  _registered: false,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPromptService]),
  _will_return: null,
  _inout_value: null,
  _promptState: null,
  _origFactory: null,
  _promptCb: null,

  confirm: function(aParent, aDialogTitle, aText) {
    this._promptState = {
      method: "confirm",
      parent: aParent,
      dialogTitle: aDialogTitle,
      text: aText,
    };

    this.fireCb();

    return this._will_return;
  },

  confirmEx: function(aParent, aDialogTitle, aText, aButtonFlags,
                      aButton0Title, aButton1Title, aButton2Title,
                      aCheckMsg, aCheckState) {
    this._promptState = {
      method: "confirmEx",
      parent: aParent,
      dialogTitle: aDialogTitle,
      text: aText,
      buttonFlags: aButtonFlags,
      button0Title: aButton0Title,
      button1Title: aButton1Title,
      button2Title: aButton2Title,
      checkMsg: aCheckMsg,
      checkState: aCheckState,
    };

    this.fireCb();

    return this._will_return;
  },

  prompt: function(aParent, aDialogTitle, aText, aValue, aCheckMsg,
                   aCheckState) {
    this._promptState = {
      method: "prompt",
      parent: aParent,
      dialogTitle: aDialogTitle,
      text: aText,
      value: aValue,
      checkMsg: aCheckMsg,
      checkState: aCheckState,
    };

    this.fireCb();

    if (this._inout_value != null)
      aValue.value = this._inout_value;

    return this._will_return;
  },

  // Other dialogs should probably be mocked here, including alert,
  // alertCheck, confirmCheck, etc.
  // See:  http://mxr.mozilla.org/mozilla-central/source/embedding/components/
  //       windowwatcher/public/nsIPromptService.idl

  /* Sets the value that the alert, confirm, etc dialog will return to
   * the caller.
   */
  set returnValue(aReturn) {
    this._will_return = aReturn;
  },

  set inoutValue(aValue) {
    this._inout_value = aValue;
  },

  set onPromptCallback(aCb) {
    this._promptCb = aCb;
  },

  fireCb: function() {
    if (typeof(this._promptCb) == "function")
      this._promptCb.call();
  },

  /* Wipes out the prompt state and any return values.
   */
  reset: function() {
    this._will_return = null;
    this._promptState = null;
    this._promptCb = null;
    this._inout_value = null;
  },

  /* Returns the prompt state if one was observed since registering
   * the Mock Prompt Service.
   */
  get promptState() {
    return this._promptState;
  },

  get CID() {
    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    return registrar.contractIDToCID(kPromptServiceContractID);
  },

  /* Registers the Mock Prompt Service, and stores the original Prompt Service.
   */
  register: function() {
    if (this._registered)
      return;

    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    this._origFactory = Components.manager
                                  .getClassObject(Cc[kPromptServiceContractID],
                                                  Ci.nsIFactory);

    registrar.unregisterFactory(Components.ID(this.CID),
                                this._origFactory);

    registrar.registerFactory(Components.ID(this.CID),
                              kMockPromptServiceName,
                              kPromptServiceContractID,
                              gMockPromptServiceFactory);
    this._registered = true;
  },

  /* Unregisters the Mock Prompt Service, and re-registers the original
   * Prompt Service.
   */
  unregister: function() {
    if (!this._registered)
      return;

    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    registrar.unregisterFactory(Components.ID(this.CID),
                                gMockPromptServiceFactory);

    registrar.registerFactory(Components.ID(this.CID),
                              kPromptServiceName,
                              kPromptServiceContractID,
                              this._origFactory);

    delete this._origFactory;

    this._registered = false;
  },
};

var gMockPromptServiceFactory = {
  createInstance: function(aOuter, aIID) {
    if (aOuter != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    if (!aIID.equals(Ci.nsIPromptService))
      throw Cr.NS_ERROR_NO_INTERFACE;

    return gMockPromptService;
  }
};


