#! /bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

MOZ_APP_NAME=sunbird
# This sets the default for nightly branding, and may get overriden by options
# in configure.in depending on the arguments passed.
MOZ_BRANDING_DIRECTORY=$MOZ_BUILD_APP/sunbird/branding/nightly
MOZ_UPDATER=1
MOZ_SUNBIRD=1
MOZ_CALENDAR=1
MOZ_NO_ACTIVEX_SUPPORT=1
MOZ_ACTIVEX_SCRIPTING_SUPPORT=
MOZ_MATHML=
MOZ_EXTENSIONS_DEFAULT=
MOZ_UNIVERSALCHARDET=

MOZ_APP_VERSION_TXT=${_topsrcdir}/$MOZ_BUILD_APP/sunbird/config/version.txt
MOZ_APP_VERSION=`cat $MOZ_APP_VERSION_TXT`
SUNBIRD_VERSION=$MOZ_APP_VERSION
MOZ_OFFICIAL_BRANDING_DIRECTORY=other-licenses/branding/sunbird
