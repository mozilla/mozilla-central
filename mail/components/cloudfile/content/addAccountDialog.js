/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

const kFormId = "provider-form";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/cloudFileAccounts.js");

function createAccountObserver() {};

createAccountObserver.prototype = {
  onStartRequest: function(aRequest, aContext) {},
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    if (aStatusCode == Cr.NS_OK
        && aContext instanceof Ci.nsIMsgCloudFileProvider) {
      let accountKey = aContext.accountKey;

      // For now, we'll just set the display name to be the name of the service
      cloudFileAccounts.setDisplayName(accountKey, aContext.displayName);

      window.arguments[0].accountKey = aContext.accountKey;
      window.close();
    }
    else {
      if (aContext instanceof Ci.nsIMsgCloudFileProvider) {
        cloudFileAccounts.removeAccount(aContext.accountKey);
      }
      else {
        // Something went seriously wrong here...
        Components.utils.reportError("Cloud account creation failed, and " +
                                     "provider instance missing!");
      }

      addAccountDialog._accept.disabled = false;
      addAccountDialog._messages.selectedPanel = addAccountDialog._error;
    }
  },
}

let addAccountDialog = {
  _settings: null,
  _settingsWrap: null,
  _accountType: null,
  _accept: null,
  _strings: Services.strings
                    .createBundle("chrome://messenger/locale/cloudfile/addAccountDialog.properties"),

  onInit: function AAD_onInit() {
    this._settings = document.getElementById("accountSettings");
    this._accountType = document.getElementById("accountType");
    this._noAccountText = document.getElementById("noAccountText");
    this._accept = document.documentElement.getButton("accept");
    this._messages = document.getElementById("messages");
    this._authSpinner = document.getElementById("authorizing");
    this._error = document.getElementById("error");
    this._createAccountText = document.getElementById("createAccountText");

    this.removeTitleMenuItem();
    this.addAccountTypes();

    // Hook up our onInput event handler
    this._settings.addEventListener("DOMContentLoaded", function(e) {
      let doc = this.contentDocument;

      let links = doc.getElementsByTagName("a");

      for (let [, link] in Iterator(links))
        link.addEventListener("click", addAccountDialog.onClickLink);

      let form = doc.getElementById(kFormId);

      if (form)
        form.addEventListener("input", addAccountDialog.onInput);

      addAccountDialog.onInput();

      // Focus the first field in the form, if any, that does not have the
      // class "focus-filter".
      let firstField = doc.querySelector("form:not(.filter) input:not(.hidden)");
      if (firstField)
        firstField.focus();

    }, false);

    this._settings.addEventListener("overflow", function(e) {
      addAccountDialog.fitIFrame();
    });

    addAccountDialog.fitIFrame();
  },

  fitIFrame: function() {
    // Determine the height of the accountSettings iframe, and adjust
    // the height of the window appropriately.
    let newHeight = this._settings.contentDocument
                                  .body
                                  .offsetHeight;
    this._settings.style.height = this._settings.style.minHeight = newHeight + "px";
    window.sizeToContent();
  },

  removeTitleMenuItem: function AAD_removeTitleMenuItem() {
    let menuitem = this._accountType.querySelector('menuitem[value=""]');
    if (menuitem) {
      let index = this._accountType.getIndexOfItem(menuitem);
      this._accountType.removeItemAt(index);
    }
  },

  addAccountTypes: function AAD_addAccountTypes() {
    for (let [key, provider] in cloudFileAccounts.enumerateProviders()) {
      // If we already have an account for this type, don't add it to the list.
      // This limitation will hopefully be removed in the future.
      if (cloudFileAccounts.getAccountsForType(key).length > 0)
        continue;

      let menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", provider.displayName);
      menuitem.setAttribute("value", key);

      if (provider.iconClass) {
        menuitem.setAttribute("class", "menuitem-iconic menuitem-with-favicon");
        menuitem.setAttribute("image", provider.iconClass);
      }

      this._accountType.menupopup.appendChild(menuitem);
    }

    if (this._accountType.itemCount == 0) {
      this._createAccountText.hidden = true;
      this._accountType.hidden = true;
      this._noAccountText.hidden = false;
    }

    // If there's only one option, let's choose it for the user to avoid
    // a few clicks.
    if (this._accountType.itemCount == 1)
      this._accountType.selectedIndex = 0;
  },

  onOK: function AAD_onOK() {
    let accountType = this._accountType.value;
    let obs = new createAccountObserver();

    let extras = this.getExtraArgs();

    let provider = cloudFileAccounts.createAccount(accountType, obs, extras);
    this._accept.disabled = true;

    this._messages.selectedPanel = this._authSpinner;

    return false;
  },

  getExtraArgs: function AAD_getExtraArgs() {
    if (!this._settings)
      return {};

    let func = this._settings.contentWindow
                   .wrappedJSObject
                   .extraArgs;
    if (!func)
      return {};

    return func();
  },

  accountTypeSelected: function AAD_accountTypeSelected() {
    let providerKey = this._accountType.selectedItem.value;
    if (!providerKey)
      return;

    let provider = cloudFileAccounts.getProviderForType(providerKey);
    if (!provider)
      return;

    // Reset the message display
    this._messages.selectedIndex = -1;

    // Load up the correct XHTML page for this provider.
    this._settings.contentDocument.location.href = provider.settingsURL;
  },

  onClickLink: function AAD_onClickLink(e) {
    e.preventDefault();
    let href = e.target.getAttribute("href");
    gProtocolService.loadUrl(Services.io.newURI(href, "UTF-8", null));
  },

  onInput: function AAD_onInput() {
    // Let's see if we have everything we need to make OK enabled...
    addAccountDialog._accept.disabled = !addAccountDialog.checkValidity();
  },

  checkValidity: function AAD_checkValidity() {
    // If there's a form in the iframe, ensure that
    // it's checkValidity function passes.
    let form = this._settings
                   .contentWindow
                   .wrappedJSObject
                   .document
                   .getElementById(kFormId);

    if (form)
      return form.checkValidity();

    return true;
  },

}

XPCOMUtils.defineLazyServiceGetter(this, "gProtocolService",
                                   "@mozilla.org/uriloader/external-protocol-service;1",
                                   "nsIExternalProtocolService");
