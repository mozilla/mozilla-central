/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
