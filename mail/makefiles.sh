# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

if [ "$COMM_BUILD" ]; then
add_makefiles "
mail/Makefile
mail/app/Makefile
mail/app/profile/Makefile
mail/base/Makefile
mail/components/Makefile
mail/components/about-support/Makefile
mail/components/activity/Makefile
mail/components/addrbook/Makefile
mail/components/build/Makefile
mail/components/compose/Makefile
mail/components/im/Makefile
mail/components/migration/Makefile
mail/components/migration/public/Makefile
mail/components/migration/src/Makefile
mail/components/newmailaccount/Makefile
mail/components/phishing/Makefile
mail/components/preferences/Makefile
mail/components/search/Makefile
mail/components/shell/Makefile
mail/components/shell/public/Makefile
mail/components/test/Makefile
mail/components/wintaskbar/Makefile
mail/extensions/Makefile
mail/extensions/mailviews/Makefile
mail/extensions/smime/Makefile
mail/installer/Makefile
mail/installer/windows/Makefile
mail/jquery/Makefile
mail/locales/Makefile
mail/steel/Makefile
mail/test/mozmill/Makefile
mail/themes/Makefile
mail/themes/gnomestripe/Makefile
mail/themes/pinstripe/Makefile
mail/themes/qute/Makefile
$MOZ_BRANDING_DIRECTORY/Makefile
$MOZ_BRANDING_DIRECTORY/locales/Makefile
"

. "${srcdir}/chat/makefiles.sh"
fi
