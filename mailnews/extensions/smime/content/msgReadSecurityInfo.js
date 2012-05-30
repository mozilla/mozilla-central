/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIPKIParamBlock = Components.interfaces.nsIPKIParamBlock;
const nsIDialogParamBlock = Components.interfaces.nsIDialogParamBlock;
const nsIX509Cert = Components.interfaces.nsIX509Cert;
const nsICMSMessageErrors = Components.interfaces.nsICMSMessageErrors;
const nsICertificateDialogs = Components.interfaces.nsICertificateDialogs;
const nsCertificateDialogs = "@mozilla.org/nsCertificateDialogs;1"

var gSignerCert = null;
var gEncryptionCert = null;

var gSignatureStatus = -1;
var gEncryptionStatus = -1;

var params = null;

function setText(id, value) {
  var element = document.getElementById(id);
  if (!element)
    return;
  if (element.hasChildNodes())
    element.removeChild(element.firstChild);
  var textNode = document.createTextNode(value);
  element.appendChild(textNode);
}

function onLoad()
{
  var pkiParams = window.arguments[0].QueryInterface(nsIPKIParamBlock);
  var isupport = pkiParams.getISupportAtIndex(1);
  if (isupport) {
    gSignerCert = isupport.QueryInterface(nsIX509Cert);
  }
  isupport = pkiParams.getISupportAtIndex(2);
  if (isupport) {
    gEncryptionCert = isupport.QueryInterface(nsIX509Cert);
  }

  params = pkiParams.QueryInterface(nsIDialogParamBlock);

  gSignatureStatus = params.GetInt(1);
  gEncryptionStatus = params.GetInt(2);

  var bundle = document.getElementById("bundle_smime_read_info");

  if (bundle) {
    var sigInfoLabel = null;
    var sigInfoHeader = null;
    var sigInfo = null;
    var sigInfo_clueless = false;

    switch (gSignatureStatus) {
      case -1:
      case nsICMSMessageErrors.VERIFY_NOT_SIGNED:
        sigInfoLabel = "SINoneLabel";
        sigInfo = "SINone";
        break;

      case nsICMSMessageErrors.SUCCESS:
        sigInfoLabel = "SIValidLabel";
        sigInfo = "SIValid";
        break;


      case nsICMSMessageErrors.VERIFY_BAD_SIGNATURE:
      case nsICMSMessageErrors.VERIFY_DIGEST_MISMATCH:
        sigInfoLabel = "SIInvalidLabel";
        sigInfoHeader = "SIInvalidHeader";
        sigInfo = "SIContentAltered";
        break;

      case nsICMSMessageErrors.VERIFY_UNKNOWN_ALGO:
      case nsICMSMessageErrors.VERIFY_UNSUPPORTED_ALGO:
        sigInfoLabel = "SIInvalidLabel";
        sigInfoHeader = "SIInvalidHeader";
        sigInfo = "SIInvalidCipher";
        break;

      case nsICMSMessageErrors.VERIFY_HEADER_MISMATCH:
        sigInfoLabel = "SIPartiallyValidLabel";
        sigInfoHeader = "SIPartiallyValidHeader";
        sigInfo = "SIHeaderMismatch";
        break;

      case nsICMSMessageErrors.VERIFY_CERT_WITHOUT_ADDRESS:
        sigInfoLabel = "SIPartiallyValidLabel";
        sigInfoHeader = "SIPartiallyValidHeader";
        sigInfo = "SICertWithoutAddress";
        break;

      case nsICMSMessageErrors.VERIFY_UNTRUSTED:
        sigInfoLabel = "SIInvalidLabel";
        sigInfoHeader = "SIInvalidHeader";
        sigInfo = "SIUntrustedCA";
        // XXX Need to extend to communicate better errors
        // might also be:
        // SIExpired SIRevoked SINotYetValid SIUnknownCA SIExpiredCA SIRevokedCA SINotYetValidCA
        break;

      case nsICMSMessageErrors.VERIFY_NOT_YET_ATTEMPTED:
      case nsICMSMessageErrors.GENERAL_ERROR:
      case nsICMSMessageErrors.VERIFY_NO_CONTENT_INFO:
      case nsICMSMessageErrors.VERIFY_BAD_DIGEST:
      case nsICMSMessageErrors.VERIFY_NOCERT:
      case nsICMSMessageErrors.VERIFY_ERROR_UNVERIFIED:
      case nsICMSMessageErrors.VERIFY_ERROR_PROCESSING:
      case nsICMSMessageErrors.VERIFY_MALFORMED_SIGNATURE:
        sigInfoLabel = "SIInvalidLabel";
        sigInfoHeader = "SIInvalidHeader";
        sigInfo_clueless = true;
        break;
    }


    document.getElementById("signatureLabel").value = 
      bundle.getString(sigInfoLabel);

    var label;
    if (sigInfoHeader) {
      label = document.getElementById("signatureHeader");
      label.collapsed = false;
      label.value = bundle.getString(sigInfoHeader);
    }

    var str;
    if (sigInfo) {
      str = bundle.getString(sigInfo);
    }
    else if (sigInfo_clueless) {
      str = bundle.getString("SIClueless") + " (" + gSignatureStatus + ")";
    }
    setText("signatureExplanation", str);
    

    var encInfoLabel = null;
    var encInfoHeader = null;
    var encInfo = null;
    var encInfo_clueless = false;

    switch (gEncryptionStatus) {
      case -1:
        encInfoLabel = "EINoneLabel";
        encInfo = "EINone";
        break;

      case nsICMSMessageErrors.SUCCESS:
        encInfoLabel = "EIValidLabel";
        encInfo = "EIValid";
        break;

      case nsICMSMessageErrors.ENCRYPT_INCOMPLETE:
        encInfoLabel = "EIInvalidLabel";
        encInfo = "EIContentAltered";
        break;

      case nsICMSMessageErrors.GENERAL_ERROR:
        encInfoLabel = "EIInvalidLabel";
        encInfoHeader = "EIInvalidHeader";
        encInfo_clueless = 1;
        break;
    }


    document.getElementById("encryptionLabel").value = 
      bundle.getString(encInfoLabel);

    if (encInfoHeader) {
      label = document.getElementById("encryptionHeader");
      label.collapsed = false;
      label.value = bundle.getString(encInfoHeader);
    }

    if (encInfo) {
      str = bundle.getString(encInfo);
    }
    else if (encInfo_clueless) {
      str = bundle.getString("EIClueless");
    }
    setText("encryptionExplanation", str);
  }

  if (gSignerCert) {
    document.getElementById("signatureCert").collapsed = false;
    if (gSignerCert.subjectName) {
      document.getElementById("signedBy").value = gSignerCert.commonName;
    }
    if (gSignerCert.emailAddress) {
      document.getElementById("signerEmail").value = gSignerCert.emailAddress;
    }
    if (gSignerCert.issuerName) {
      document.getElementById("sigCertIssuedBy").value = gSignerCert.issuerCommonName;
    }
  }

  if (gEncryptionCert) {
    document.getElementById("encryptionCert").collapsed = false;
    if (gEncryptionCert.subjectName) {
      document.getElementById("encryptedFor").value = gEncryptionCert.commonName;
    }
    if (gEncryptionCert.emailAddress) {
      document.getElementById("recipientEmail").value = gEncryptionCert.emailAddress;
    }
    if (gEncryptionCert.issuerName) {
      document.getElementById("encCertIssuedBy").value = gEncryptionCert.issuerCommonName;
    }
  }
}

function viewCertHelper(parent, cert) {
  var cd = Components.classes[nsCertificateDialogs].getService(nsICertificateDialogs);
  cd.viewCert(parent, cert);
}

function viewSignatureCert()
{
  if (gSignerCert) {
    viewCertHelper(window, gSignerCert);
  }
}

function viewEncryptionCert()
{
  if (gEncryptionCert) {
    viewCertHelper(window, gEncryptionCert);
  }
}

function doHelpButton()
{
  openHelp('received_security');
}
