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
 * The Original Code is aboutSupport.xhtml.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Curtis Bartley <cbartley@mozilla.com>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

/**
 * Coerces x into a string.
 */
function toStr(x) {
  return "" + x;
}

/**
 * Marks x as private (see below).
 */
function toPrivate(x) {
  return {localized: x, neutral: x, isPrivate: true};
}

/**
 * A list of fields for the incoming server of an account. Each element of the
 * list is a pair of [property name, transforming function]. The transforming
 * function should take the property and return either a string or an object
 * with the following properties:
 * - localized: the data in (possibly) localized form
 * - neutral: the data in language-neutral form
 * - isPrivate (optional): true if the data is private-only, false if public-only,
 *                         not stated otherwise
 */
var gIncomingDetails = [
  ["key", toStr],
  ["name", toPrivate],
  ["hostDetails", toStr],
  ["socketType", AboutSupport.getSocketTypeText.bind(AboutSupport)],
  ["authMethod", AboutSupport.getAuthMethodText.bind(AboutSupport)],
];

/**
 * A list of fields for the outgoing servers associated with an account. This is
 * similar to gIncomingDetails above.
 */
var gOutgoingDetails = [
  ["name", toStr],
  ["socketType", AboutSupport.getSocketTypeText.bind(AboutSupport)],
  ["authMethod", AboutSupport.getAuthMethodText.bind(AboutSupport)],
  ["isDefault", toStr],
];

/**
 * A list of account details.
 */
XPCOMUtils.defineLazyGetter(window, "gAccountDetails",
                            function () AboutSupport.getAccountDetails());

function populateAccountsSection() {
  let trAccounts = [];

  function createTD(data, rowSpan) {
    let text = (typeof data == "string") ? data : data.localized;
    let copyData = (typeof data == "string") ? null : data.neutral;
    let attributes = {rowspan: rowSpan};
    if (typeof data == "object" && "isPrivate" in data)
      attributes.class = data.isPrivate ? CLASS_DATA_PRIVATE : CLASS_DATA_PUBLIC;

    return createElement("td", text, attributes, copyData);
  }

  for (let [, account] in Iterator(gAccountDetails)) {
    // We want a minimum rowspan of 1
    let rowSpan = account.smtpServers.length || 1;
    // incomingTDs is a list of TDs
    let incomingTDs = [createTD(fn(account[prop]), rowSpan)
                       for ([, [prop, fn]] in Iterator(gIncomingDetails))];
    // outgoingTDs is a list of list of TDs
    let outgoingTDs = [[createTD(fn(smtp[prop]), 1)
                        for ([, [prop, fn]] in Iterator(gOutgoingDetails))]
                       for ([, smtp] in Iterator(account.smtpServers))];

    // If there are no SMTP servers, add a dummy element to make life easier below
    if (outgoingTDs.length == 0)
      outgoingTDs = [[]];

    // Add the first SMTP server to this tr.
    let tr = createParentElement("tr", incomingTDs.concat(outgoingTDs[0]));
    trAccounts.push(tr);
    // Add the remaining SMTP servers as separate trs
    for each (let [, tds] in Iterator(outgoingTDs.slice(1)))
      trAccounts.push(createParentElement("tr", tds));
  }

  appendChildren(document.getElementById("accounts-tbody"), trAccounts);
}

/**
 * Returns a plaintext representation of the accounts data.
 */
function getAccountsText(aHidePrivateData, aIndent) {
  let accumulator = [];

  // Given a string or object, converts it into a language-neutral form
  function neutralizer(data) {
    if (typeof data == "string")
      return data;
    if ("isPrivate" in data && (aHidePrivateData == data.isPrivate))
      return "";
    return data.neutral;
  }

  for (let [, account] in Iterator(gAccountDetails)) {
    accumulator.push(aIndent + account.key + ":");
    // incomingData is a list of strings
    let incomingData = [neutralizer(fn(account[prop]))
                        for ([, [prop, fn]] in Iterator(gIncomingDetails))];
    accumulator.push(aIndent + "  INCOMING: " + incomingData.join(", "));

    // outgoingData is a list of list of strings
    let outgoingData = [[neutralizer(fn(smtp[prop]))
                         for ([, [prop, fn]] in Iterator(gOutgoingDetails))]
                        for ([, smtp] in Iterator(account.smtpServers))];
    for (let [, data] in Iterator(outgoingData))
      accumulator.push(aIndent + "  OUTGOING: " + data.join(", "));

    accumulator.push("");
  }

  return accumulator.join("\n");
}
