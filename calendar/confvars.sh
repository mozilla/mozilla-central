#! /bin/sh
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
# The Original Code is Mozilla Build System
#
# The Initial Developer of the Original Code is
# Ben Turner <mozilla@songbirdnest.com>
#
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
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

MOZ_APP_NAME=sunbird
MOZ_APP_DISPLAYNAME=Calendar
MOZ_UPDATER=1
MOZ_SUNBIRD=1
MOZ_CALENDAR=1
MOZ_APP_VERSION=$SUNBIRD_VERSION
MOZ_PLAINTEXT_EDITOR_ONLY=1
NECKO_PROTOCOLS_DEFAULT="about data file ftp http res viewsource"
MOZ_NO_ACTIVEX_SUPPORT=1
MOZ_ACTIVEX_SCRIPTING_SUPPORT=
MOZ_INSTALLER=
MOZ_MATHML=
NECKO_DISK_CACHE=
# MOZ_OJI is only required to be cleared for MOZILLA_1_9_1_BRANCH.
# mozilla-central does not have this.
MOZ_OJI=
NECKO_COOKIES=
MOZ_NO_XPCOM_OBSOLETE=1
MOZ_EXTENSIONS_DEFAULT=
MOZ_UNIVERSALCHARDET=
MOZ_APP_VERSION=`cat $topsrcdir/$MOZ_BUILD_APP/sunbird/config/version.txt`
SUNBIRD_VERSION=$MOZ_APP_VERSION
