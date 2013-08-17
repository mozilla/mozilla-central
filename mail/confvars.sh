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
MOZ_LDAP_XPCOM=1
MOZ_COMPOSER=1
if test "$OS_ARCH" = "WINNT"; then
  if ! test "$HAVE_64BIT_OS"; then
    MOZ_VERIFY_MAR_SIGNATURE=1
    MOZ_MAINTENANCE_SERVICE=1
  fi
fi

# Disable Accessibility on Mac for now as unit tests fail (bug 862238).
if test "$OS_ARCH" = "Darwin"; then
  ACCESSIBILITY=
fi

MOZ_SAFE_BROWSING=1
MOZ_MEDIA_NAVIGATOR=1
MOZ_MORK=1
MAIL_COMPONENT="mail import"
MAIL_MODULE="MODULE(nsMailModule) MODULE(nsImportServiceModule)"
if test -n "$MOZ_MAPI_SUPPORT"; then
  MAIL_COMPONENT="$MAIL_COMPONENT msgMapi"
  MAIL_MODULE="$MAIL_MODULE MODULE(msgMapiModule)"
fi

MOZ_APP_VERSION_TXT=${_topsrcdir}/$MOZ_BUILD_APP/config/version.txt
MOZ_APP_VERSION=`cat $MOZ_APP_VERSION_TXT`
THUNDERBIRD_VERSION=$MOZ_APP_VERSION

MOZ_UA_BUILDID=20100101

MOZ_BRANDING_DIRECTORY=mail/branding/nightly
MOZ_OFFICIAL_BRANDING_DIRECTORY=other-licenses/branding/thunderbird
MOZ_APP_ID={3550f703-e582-4d05-9a08-453d09bdfdc6}
# This should usually be the same as the value MAR_CHANNEL_ID.
# If more than one ID is needed, then you should use a comma separated list
# of values.
ACCEPTED_MAR_CHANNEL_IDS=thunderbird-comm-central
# The MAR_CHANNEL_ID must not contain the following 3 characters: ",\t "
MAR_CHANNEL_ID=thunderbird-comm-central
