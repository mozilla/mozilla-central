/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* We expect the following arguments:
   - pref name of LDAP directory to fetch from
   - array with email addresses

  Display modal dialog with message and stop button.
  In onload, kick off binding to LDAP.
  When bound, kick off the searches.
  On finding certificates, import into permanent cert database.
  When all searches are finished, close the dialog.
*/

Components.utils.import("resource://gre/modules/Services.jsm");

const nsIX509CertDB = Components.interfaces.nsIX509CertDB;
const nsX509CertDB = "@mozilla.org/security/x509certdb;1";
const CertAttribute = "usercertificate;binary";

var gEmailAddresses;
var gDirectoryPref;
var gLdapServerURL;
var gLdapConnection;
var gCertDB;
var gLdapOperation;
var gLogin;

function onLoad()
{
  gDirectoryPref = window.arguments[0];
  gEmailAddresses = window.arguments[1];

  if (!gEmailAddresses.length)
  {
    window.close();
    return;
  }

  setTimeout(search, 1);
}

function search()
{
  // get the login to authenticate as, if there is one
  try {
    gLogin = Services.prefs.getComplexValue(gDirectoryPref + ".auth.dn", Components.interfaces.nsISupportsString).data;
  } catch (ex) {
    // if we don't have this pref, no big deal
  }

  try {
    let url = Services.prefs.getCharPref(gDirectoryPref + ".uri");

    gLdapServerURL = Services.io
      .newURI(url, null, null).QueryInterface(Components.interfaces.nsILDAPURL);

    gLdapConnection = Components.classes["@mozilla.org/network/ldap-connection;1"]
      .createInstance().QueryInterface(Components.interfaces.nsILDAPConnection);

    gLdapConnection.init(gLdapServerURL, gLogin, new boundListener(),
      null, Components.interfaces.nsILDAPConnection.VERSION3);

  } catch (ex) {
    dump(ex);
    dump(" exception creating ldap connection\n");
    window.close();
  }
}

function stopFetching()
{
  if (gLdapOperation) {
    try {
      gLdapOperation.abandon();
    }
    catch (e) {
    }
  }
  return true;
}

function importCert(ber_value)
{
  if (!gCertDB) {
    gCertDB = Components.classes[nsX509CertDB].getService(nsIX509CertDB);
  }

  var cert_length = new Object();
  var cert_bytes = ber_value.get(cert_length);

  if (cert_bytes) {
    gCertDB.importEmailCertificate(cert_bytes, cert_length.value, null);
  }
}

function getLDAPOperation()
{
    gLdapOperation = Components.classes["@mozilla.org/network/ldap-operation;1"]
      .createInstance().QueryInterface(Components.interfaces.nsILDAPOperation);

    gLdapOperation.init(gLdapConnection,
                        new ldapMessageListener(),
                        null);
}

function getPassword()
{
  // we only need a password if we are using credentials
  if (gLogin)
  {
    let authPrompter = Services.ww.getNewAuthPrompter(window.QueryInterface(Components.interfaces.nsIDOMWindow));
    let strBundle = document.getElementById('bundle_ldap');
    let password = { value: "" };

    // nsLDAPAutocompleteSession uses asciiHost instead of host for the prompt text, I think we should be
    // consistent.
    if (authPrompter.promptPassword(strBundle.getString("authPromptTitle"),
                                     strBundle.getFormattedString("authPromptText", [gLdapServerURL.asciiHost]),
                                     gLdapServerURL.spec,
                                     authPrompter.SAVE_PASSWORD_PERMANENTLY,
                                     password))
      return password.value;
  }

  return null;
}

function kickOffBind()
{
  try {
    getLDAPOperation();
    gLdapOperation.simpleBind(getPassword());
  }
  catch (e) {
    window.close();
  }
}

function kickOffSearch()
{
  try {
    var prefix1 = "";
    var suffix1 = "";

    var urlFilter = gLdapServerURL.filter;

    if (urlFilter != null && urlFilter.length > 0 && urlFilter != "(objectclass=*)") {
      if (urlFilter.startsWith('(')) {
        prefix1 = "(&" + urlFilter;
      }
      else {
        prefix1 = "(&(" + urlFilter + ")";
      }
      suffix1 = ")";
    }

    var prefix2 = "";
    var suffix2 = "";

    if (gEmailAddresses.length > 1) {
      prefix2 = "(|";
      suffix2 = ")";
    }

    var mailFilter = "";

    for (var i = 0; i < gEmailAddresses.length; ++i) {
      mailFilter += "(mail=" + gEmailAddresses[i] + ")";
    }

    var filter = prefix1 + prefix2 + mailFilter + suffix2 + suffix1;

    var wanted_attributes = CertAttribute;

    // Max search results =>
    // Double number of email addresses, because each person might have
    // multiple certificates listed. We expect at most two certificates,
    // one for signing, one for encrypting.
    // Maybe that number should be larger, to allow for deployments,
    // where even more certs can be stored per user???

    var maxEntriesWanted = gEmailAddresses.length * 2;

    getLDAPOperation();
    gLdapOperation.searchExt(gLdapServerURL.dn, gLdapServerURL.scope,
                             filter, wanted_attributes, 0, maxEntriesWanted);
  }
  catch (e) {
    window.close();
  }
}


function boundListener() {
}

boundListener.prototype.QueryInterface =
  function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) ||
        iid.equals(Components.interfaces.nsILDAPMessageListener))
        return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }

boundListener.prototype.onLDAPMessage =
  function(aMessage) {
  }

boundListener.prototype.onLDAPInit =
  function(aConn, aStatus) {
    kickOffBind();
  }


function ldapMessageListener() {
}

ldapMessageListener.prototype.QueryInterface =
  function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) ||
        iid.equals(Components.interfaces.nsILDAPMessageListener))
        return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }

ldapMessageListener.prototype.onLDAPMessage =
  function(aMessage) {
    if (Components.interfaces.nsILDAPMessage.RES_SEARCH_RESULT == aMessage.type) {
      window.close();
      return;
    }

    if (Components.interfaces.nsILDAPMessage.RES_BIND == aMessage.type) {
      if (Components.interfaces.nsILDAPErrors.SUCCESS != aMessage.errorCode) {
        window.close();
      }
      else {
        kickOffSearch();
      }
      return;
    }

    if (Components.interfaces.nsILDAPMessage.RES_SEARCH_ENTRY == aMessage.type) {
      var outSize = new Object();
      try {
        var outBinValues = aMessage.getBinaryValues(CertAttribute, outSize);

        var i;
        for (i=0; i < outSize.value; ++i) {
          importCert(outBinValues[i]);
        }
      }
      catch (e) {
      }
      return;
    }
  }

ldapMessageListener.prototype.onLDAPInit =
  function(aConn, aStatus) {
  }
