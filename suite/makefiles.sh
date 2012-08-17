# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

if [ "$COMM_BUILD" ]; then
add_makefiles "
  suite/Makefile
  suite/app/Makefile
  suite/browser/Makefile
  suite/browser/test/Makefile
  suite/build/Makefile
  suite/common/Makefile
  suite/common/dataman/tests/Makefile
  suite/common/downloads/tests/Makefile
  suite/common/places/tests/Makefile
  suite/common/public/Makefile
  suite/common/src/Makefile
  suite/common/tests/Makefile
  suite/common/tests/browser/Makefile
  suite/common/tests/chrome/Makefile
  suite/common/tests/preferences/Makefile
  suite/debugQA/Makefile
  suite/debugQA/locales/Makefile
  suite/feeds/public/Makefile
  suite/feeds/src/Makefile
  suite/installer/Makefile
  suite/installer/windows/Makefile
  suite/locales/Makefile
  suite/mailnews/Makefile
  suite/mailnews/modules/Makefile
  suite/modules/Makefile
  suite/modules/test/Makefile
  suite/profile/Makefile
  suite/profile/migration/public/Makefile
  suite/profile/migration/src/Makefile
  suite/security/Makefile
  suite/shell/public/Makefile
  suite/shell/src/Makefile
  suite/smile/Makefile
  suite/smile/public/Makefile
  suite/smile/src/Makefile
  suite/smile/test/Makefile
  suite/themes/modern/Makefile
  suite/themes/classic/Makefile
  $MOZ_BRANDING_DIRECTORY/Makefile
"
fi
