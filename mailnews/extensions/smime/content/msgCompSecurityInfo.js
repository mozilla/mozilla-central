/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gListBox;
var gViewButton;
var gBundle;

var gEmailAddresses;
var gCertStatusSummaries;
var gCertIssuedInfos;
var gCertExpiresInfos;
var gCerts;
var gCount;

var gSMimeContractID = "@mozilla.org/messenger-smime/smimejshelper;1";
var gISMimeJSHelper = Components.interfaces.nsISMimeJSHelper;
var gIX509Cert = Components.interfaces.nsIX509Cert;
const nsICertificateDialogs = Components.interfaces.nsICertificateDialogs;
const nsCertificateDialogs = "@mozilla.org/nsCertificateDialogs;1"

function getStatusExplanation(value)
{
  switch (value)
  {
    case gIX509Cert.VERIFIED_OK:
      return gBundle.getString("StatusValid");

    case gIX509Cert.NOT_VERIFIED_UNKNOWN:
    case gIX509Cert.INVALID_CA:
    case gIX509Cert.USAGE_NOT_ALLOWED:
      return gBundle.getString("StatusInvalid");

    case gIX509Cert.CERT_REVOKED:
      return gBundle.getString("StatusRevoked");

    case gIX509Cert.CERT_EXPIRED:
      return gBundle.getString("StatusExpired");

    case gIX509Cert.CERT_NOT_TRUSTED:
    case gIX509Cert.ISSUER_NOT_TRUSTED:
    case gIX509Cert.ISSUER_UNKNOWN:
      return gBundle.getString("StatusUntrusted");
  }

  return "";
}

function onLoad()
{
  var params = window.arguments[0];
  if (!params)
    return;

  var helper = Components.classes[gSMimeContractID].createInstance(gISMimeJSHelper);

  if (!helper)
    return;

  gListBox = document.getElementById("infolist");
  gViewButton = document.getElementById("viewCertButton");
  gBundle = document.getElementById("bundle_smime_comp_info");

  gEmailAddresses = new Object();
  gCertStatusSummaries = new Object();
  gCertIssuedInfos = new Object();
  gCertExpiresInfos = new Object();
  gCerts = new Object();
  gCount = new Object();
  var canEncrypt = new Object();

  var allow_ldap_cert_fetching = false;

  try {  
    if (params.compFields.securityInfo.requireEncryptMessage) {
      allow_ldap_cert_fetching = true;
    }
  }
  catch (e)
  {
  }

  while (true)
  {
    try
    {
      helper.getRecipientCertsInfo(
        params.compFields,
        gCount,
        gEmailAddresses,
        gCertStatusSummaries,
        gCertIssuedInfos,
        gCertExpiresInfos,
        gCerts,
        canEncrypt);
    }
    catch (e)
    {
      dump(e);
      return;
    }

    if (!allow_ldap_cert_fetching)
      break;

    allow_ldap_cert_fetching = false;

    var missing = new Array();

    for (var j = gCount.value - 1; j >= 0; --j)
    {
      if (!gCerts.value[j])
      {
        missing[missing.length] = gEmailAddresses.value[j];
      }
    }

    if (missing.length > 0)
    {
      var autocompleteLdap = Services.prefs
        .getBoolPref("ldap_2.autoComplete.useDirectory");

      if (autocompleteLdap)
      {
        var autocompleteDirectory = null;
        if (params.currentIdentity.overrideGlobalPref) {
          autocompleteDirectory = params.currentIdentity.directoryServer;
        } else {
          autocompleteDirectory = Services.prefs
            .getCharPref("ldap_2.autoComplete.directoryServer");
        }

        if (autocompleteDirectory)
        {
          window.openDialog('chrome://messenger-smime/content/certFetchingStatus.xul',
            '',
            'chrome,resizable=1,modal=1,dialog=1',
            autocompleteDirectory,
            missing
          );
        }
      }
    }
  }

  if (gBundle)
  {
    var yes_string = gBundle.getString("StatusYes");
    var no_string = gBundle.getString("StatusNo");
    var not_possible_string = gBundle.getString("StatusNotPossible");

    var signed_element = document.getElementById("signed");
    var encrypted_element = document.getElementById("encrypted");

    if (params.smFields.requireEncryptMessage)
    {
      if (params.isEncryptionCertAvailable && canEncrypt.value)
      {
        encrypted_element.value = yes_string;
      }
      else
      {
        encrypted_element.value = not_possible_string;
      }
    }
    else
    {
      encrypted_element.value = no_string;
    }

    if (params.smFields.signMessage)
    {
      if (params.isSigningCertAvailable)
      {
        signed_element.value = yes_string;
      }
      else
      {
        signed_element.value = not_possible_string;
      }
    }
    else
    {
      signed_element.value = no_string;
    }
  }

  var imax = gCount.value;

  for (var i = 0; i < imax; ++i)
  {
    var listitem  = document.createElement("listitem");

    listitem.appendChild(createCell(gEmailAddresses.value[i]));

    if (!gCerts.value[i])
    {
      listitem.appendChild(createCell(gBundle.getString("StatusNotFound")));
    }
    else
    {
      listitem.appendChild(createCell(getStatusExplanation(gCertStatusSummaries.value[i])));
      listitem.appendChild(createCell(gCertIssuedInfos.value[i]));
      listitem.appendChild(createCell(gCertExpiresInfos.value[i]));
    }

    gListBox.appendChild(listitem);
  }
}

function onSelectionChange(event)
{
  gViewButton.disabled = !(gListBox.selectedItems.length == 1 &&
                           certForRow(gListBox.selectedIndex));
}

function viewCertHelper(parent, cert) {
  var cd = Components.classes[nsCertificateDialogs].getService(nsICertificateDialogs);
  cd.viewCert(parent, cert);
}

function certForRow(aRowIndex) {
  return gCerts.value[aRowIndex];
}

function viewSelectedCert()
{
  if (!gViewButton.disabled)
    viewCertHelper(window, certForRow(gListBox.selectedIndex));
}

function doHelpButton()
{
  openHelp('compose_security', 'chrome://communicator/locale/help/suitehelp.rdf');
}

function createCell(label)
{
  var cell = document.createElement("listcell");
  cell.setAttribute("label", label)
  return cell;
}
