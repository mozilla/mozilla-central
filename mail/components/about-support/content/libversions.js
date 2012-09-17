/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function populateLibVersionsSection() {
  function pushInfoRow(table, name, value, value2)
  {
    table.push(createParentElement("tr", [
      createElement("td", name),
      createElement("td", value),
      createElement("td", value2),
    ]));
  }
    
  var v = null;
  try { // just to be safe
    v = Cc["@mozilla.org/security/nssversion;1"].getService(Ci.nsINSSVersion);
  } catch(e) {}
  if (!v)
    return;
    
  let bundle = Services.strings.createBundle("chrome://global/locale/aboutSupport.properties");
  let libversions_tbody = document.getElementById("libversions-tbody");

  let trLibs = [];
  trLibs.push(createParentElement("tr", [
    createElement("th", ""),
    createElement("th", bundle.GetStringFromName("minLibVersions")),
    createElement("th", bundle.GetStringFromName("loadedLibVersions")),
  ]));
  pushInfoRow(trLibs, "NSPR", v.NSPR_MinVersion, v.NSPR_Version);
  pushInfoRow(trLibs, "NSS", v.NSS_MinVersion, v.NSS_Version);
  pushInfoRow(trLibs, "NSS Util", v.NSSUTIL_MinVersion, v.NSSUTIL_Version);
  pushInfoRow(trLibs, "NSS SSL", v.NSSSSL_MinVersion, v.NSSSSL_Version);
  pushInfoRow(trLibs, "NSS S/MIME", v.NSSSMIME_MinVersion, v.NSSSMIME_Version);

  appendChildren(libversions_tbody, trLibs);
}
