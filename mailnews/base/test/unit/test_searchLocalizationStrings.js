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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 
 // tests that localization strings added in bug 484147 are defined in preferences
 
const gValidityManager = Cc['@mozilla.org/mail/search/validityManager;1']
                           .getService(Ci.nsIMsgSearchValidityManager);

const gStringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                        .getService(Ci.nsIStringBundleService)
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
