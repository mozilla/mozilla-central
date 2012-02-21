#!/bin/bash
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla code.
#
# The Initial Developer of the Original Code is the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2010
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Randell Jesup <rjesup@jesup.org>
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



# First, get a new copy of the tree to play with
# They both want to be named 'trunk'...
cd media/webrtc
mkdir webrtc_update
cd webrtc_update

# Note: must be in trunk; won't work with --name (error during sync)
gclient config http://webrtc.googlecode.com/svn/trunk
gclient sync --force
export date=`date`

cd trunk

# build makefiles from .gyp - probably cruft since we do it by hand, but it
# may do more than just that
gclient runhooks --force
export revision=`svn info | grep Revision:`

echo "WebRTC revision = $revision"

# put the output in the Mozilla object dir
cd ..
python trunk/build/gyp_chromium --depth=trunk -G output_dir='$(OBJDIR)/media/webrtc/out' trunk/webrtc.gyp
cd ..


# safety - make it easy to find our way out of the forest
hg tag -f -l old-tip

# Ok, now we have a copy of the source.  See what changed
# (webrtc-import-last is a bookmark)
# FIX! verify no changes in webrtc!
hg update --clean webrtc-import-last

rm -rf trunk
mv webrtc_update/trunk trunk
mv webrtc_update/.g* .
rmdir webrtc_update
(hg addremove --exclude "**.svn" --exclude "**.git" --exclude "**.pyc" --exclude "**.yuv" --similarity 90 --dry-run trunk; hg status -m) | less

# FIX! Query user about add-removes better!!
echo "Waiting 30 seconds - Hit ^C now to stop addremove and commit!"
sleep 30  # let them ^C

# Add/remove files, detect renames
hg addremove --exclude "**.svn" --exclude "**.git" --exclude "**.pyc" --exclude "**.yuv" --similarity 90 trunk

# leave this for the user for now until we're comfortable it works safely

# Commit the vendor branch
echo "Commit, merge and push to server - cut and paste"
echo "You probably want to do these from another shell so you can look at these"
hg commit -m "Webrtc import $revision"
# webrtc-import-last is auto-updated (bookmark)

#echo ""
#echo "hg update --clean webrtc-pending"
#echo "hg merge -r webrtc-import-last"
#echo "hg commit -m 'merge latest import to pending, rev blah'"
# webrtc-pending is auto-updated (bookmark)

echo ""
hg update --clean webrtc-trim
hg merge -r webrtc-import-last
hg commit -m "merge latest import to trim, $revision"
# webrtc-trim is auto-updated (bookmark)

# commands to pull - never do more than echo them for the user
echo ""
echo "Here's how to pull this update into the mozilla repo:"
echo "cd your_tree"
echo "hg qpop -a"
echo "hg pull --bookmark webrtc-trim path-to-webrtc-import-repo"
echo "hg merge"
echo "hg commit -m 'Webrtc updated to $revision; pull made on $date'"
echo ""
echo "Once you feel safe:"
echo "hg push"
