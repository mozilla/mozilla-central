#! /bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

if [ "$COMM_BUILD" ]; then

    add_makefiles "
    calendar/sunbird/Makefile
    calendar/sunbird/app/Makefile
    calendar/sunbird/base/Makefile
    calendar/sunbird/locales/Makefile
    $MOZ_BRANDING_DIRECTORY/Makefile
    $MOZ_BRANDING_DIRECTORY/locales/Makefile
    "

   . ${srcdir}/calendar/shared_makefiles.sh
fi
