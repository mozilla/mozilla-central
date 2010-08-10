# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla MailNews test code.
#
# The Initial Developer of the Original Code is
# Mozilla Messaging.
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Mark Banner <bugzilla@standard8.plus.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****
import shutil

def copyCommonProfileFiles(destination):
    # Copy our bloat prefs file straight over the generated prefs.js
    shutil.copy("../common/mailnewsTestPrefs.js", destination + "/prefs.js")
    # Nothing else to do yet

def AddCommonOptions(self, defaults):
    self.add_option("--binary-dir",
                    action = "store", type = "string", dest = "binaryDir",
                    help = "path to the application binary")
    defaults["binaryDir"] = ""

    self.add_option("--profile-dir",
                    action = "store", type = "string", dest = "profileDir",
                    help = "path to the test profile")
    defaults["profileDir"] = ""

    # -h, --help are automatically handled by OptionParser

    self.set_defaults(**defaults)

    usage = """\
Usage instructions for setUpBloatTest.py.
--binary-dir and --profile-dir must be specified.
"""
    self.set_usage(usage)
