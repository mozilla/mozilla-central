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

"""
Sets up the supplied profile with required items for MailNews Bloat Tests
"""

import optparse
import os
import os.path
import platform
import re
import shutil
from subprocess import Popen,PIPE
import sys

# append the common directory so we can import the common module
sys.path.append(os.path.join(os.getcwd(), '../common'))
import setUpCommonMailNews

class BloatProfileOptions(optparse.OptionParser):
    """Parses Set Up Bloat Profile commandline options."""
    def __init__(self, **kwargs):
        optparse.OptionParser.__init__(self, **kwargs)
        defaults = {}

        setUpCommonMailNews.AddCommonOptions(self, defaults);

def copyChromeFiles(destination):
    # Copy bloat*Overlay.js/xul to the chrome directory
    copyFiles = ["bloatComposeOverlay.js",
                 "bloatComposeOverlay.xul",
                 "bloatAddrOverlay.js",
                 "bloatAddrOverlay.xul",
                 "bloatMainOverlay.js",
                 "bloatMainOverlay.xul"];
    for file in copyFiles:
        shutil.copy(file, destination)

def createManifest(chromeDir, manifestFileName):
    # Formulate a manifest to allow load of and overlay the bloatTestOverlay.xul
    # file onto the main windows
    fileLocation = chromeDir + "/" + manifestFileName
    try:
        f = open(fileLocation, 'w');
    except IOError:
        print "Couldn't write to " + fileLocation
        sys.exit(2)

    # Must have a "/" on the end of chromeDir
    realChromeDir = chromeDir + "/"
    if platform.system() in ("Windows", "Microsoft"):
        realChromeDir.replace("\\", "\/");

    f.write("content mailnewstest file:///" + realChromeDir + "\n")
    text = """\
overlay chrome://messenger/content/messenger.xul chrome://mailnewstest/content/bloatMainOverlay.xul
overlay chrome://messenger/content/addressbook/addressbook.xul chrome://mailnewstest/content/bloatAddrOverlay.xul
overlay chrome://messenger/content/messengercompose/messengercompose.xul chrome://mailnewstest/content/bloatComposeOverlay.xul
"""
    f.write(text)
    f.close()


def main():
    # Argument parsing and checking
    parser = BloatProfileOptions()
    options, args = parser.parse_args()

    if options.binaryDir=="" or options.profileDir=="":
        print "Binary and Profile Directories must be supplied"
        sys.exit(2)
 
    if not os.path.exists(options.binaryDir) or not os.path.exists(options.profileDir):
        print "Binary and Profile Directories must be exist"
        sys.exit(2)

    # The main work
    print "Running setUpBloatTest.py"

    copyChromeFiles(options.binaryDir + "/chrome")

    createManifest(options.binaryDir + "/chrome", "mailnewstest.manifest")

    setUpCommonMailNews.copyCommonProfileFiles(options.profileDir)

    print "setUpBloatTest.py completed succesfully"

#########
# DO IT #
#########

if __name__ == "__main__":
    main()
