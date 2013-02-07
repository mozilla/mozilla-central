#! /bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

MOZ_APP_BASENAME=Thunderbird
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
if test "$OS_ARCH" = "WINNT"; then
  if ! test "$HAVE_64BIT_OS"; then
    MOZ_VERIFY_MAR_SIGNATURE=1
    MOZ_MAINTENANCE_SERVICE=1
  fi
fi

# Disable WebRTC as we don't use it currently and to work around bug 837618
# for Mac
MOZ_WEBRTC=

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

MOZ_UA_BUILDID=20100101

MOZ_BRANDING_DIRECTORY=mail/branding/nightly
MOZ_OFFICIAL_BRANDING_DIRECTORY=other-licenses/branding/thunderbird
# This should usually be the same as the value MAR_CHANNEL_ID.
# If more than one ID is needed, then you should use a comma separated list
# of values.
ACCEPTED_MAR_CHANNEL_IDS=thunderbird-comm-central
# The MAR_CHANNEL_ID must not contain the following 3 characters: ",\t "
MAR_CHANNEL_ID=thunderbird-comm-central
