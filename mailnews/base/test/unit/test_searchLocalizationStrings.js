/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
 // tests that localization strings added in bug 484147 are defined in preferences
 
Components.utils.import("resource://gre/modules/Services.jsm");

const gValidityManager = Cc['@mozilla.org/mail/search/validityManager;1']
                           .getService(Ci.nsIMsgSearchValidityManager);

const gStringBundle = Services.strings
                              .createBundle("chrome://messenger/locale/search-attributes.properties");

// The following table of valid table scopes matches the allowable table
// scopes in nsMsgSearchValidityManager::GetTable
const kValidScopes =
[
  Ci.nsMsgSearchScope.offlineMail,
  Ci.nsMsgSearchScope.offlineMailFilter,
  Ci.nsMsgSearchScope.onlineMail,
  Ci.nsMsgSearchScope.onlineMailFilter,
  Ci.nsMsgSearchScope.news,
  Ci.nsMsgSearchScope.newsFilter,
  Ci.nsMsgSearchScope.localNews,
  Ci.nsMsgSearchScope.LDAP,
  Ci.nsMsgSearchScope.LDAPAnd,
  Ci.nsMsgSearchScope.LocalAB,
  Ci.nsMsgSearchScope.LocalABAnd
];

function run_test()
{
  for (var index = 0; index < kValidScopes.length; ++index)
  {
    let scope = kValidScopes[index];
    let table = gValidityManager.getTable(scope);
    let attributes = table.getAvailableAttributes({});
    let attribute;
    while ((attribute = attributes.pop()) && attribute)
    {
      let property = gValidityManager.getAttributeProperty(attribute);
      let valid = false;
      try
      {
        localizedString = gStringBundle.GetStringFromName(property);
        valid = true;
      }
      catch (e)
      {
        dump("\n" + e);
      }
      valid = valid && localizedString && (localizedString.length > 0);
      if (!valid)
        dump("\nNo valid property for scope = " + scope
              + " attribute = " + attribute
              + " property = " + property);
      do_check_true(valid);
    }
  }
}
