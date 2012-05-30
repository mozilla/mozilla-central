#! /bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

MOZ_APP_NAME=thunderbird
MOZ_UPDATER=1
MOZ_THUNDERBIRD=1
MOZ_CHROME_FILE_FORMAT=omni
MOZ_NO_ACTIVEX_SUPPORT=1
MOZ_ACTIVEX_SCRIPTING_SUPPORT=
if [ "$COMM_BUILD" ]; then
  MOZ_LDAP_XPCOM=1
fi
MOZ_COMPOSER=1
MOZ_SAFE_BROWSING=1
MOZ_MORK=1
if test -z "$MOZ_INCOMPLETE_EXTERNAL_LINKAGE"; then
MOZ_APP_COMPONENT_LIBS="xpautocomplete mailcomps $MAIL_COMPONENT $LDAP_COMPONENT $MORK_COMPONENT"
MOZ_APP_COMPONENT_MODULES="MODULE(xpAutoComplete) MODULE(nsMailCompsModule) $MAIL_MODULE $LDAP_MODULE $MORK_MODULE"
MOZ_APP_EXTRA_LIBS="$LDAP_LIBS"
fi

MOZ_APP_VERSION_TXT=${_topsrcdir}/$MOZ_BUILD_APP/config/version.txt
MOZ_APP_VERSION=`cat $MOZ_APP_VERSION_TXT`
THUNDERBIRD_VERSION=$MOZ_APP_VERSION

MOZ_BRANDING_DIRECTORY=mail/branding/nightly
MOZ_OFFICIAL_BRANDING_DIRECTORY=other-licenses/branding/thunderbird
