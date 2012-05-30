# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# NSIS defines for nightly builds.
# The release build branding.nsi is located in other-licenses/branding/sunbird/
!define BrandShortName        "Calendar"
!define BrandFullName         "Calendar"
# BrandFullNameInternal is used for some registry and file system values that
# should not contain release that may be in the BrandFullName (e.g. Beta 1, etc.)
!define BrandFullNameInternal "Mozilla Sunbird"
!define CompanyName           "Mozilla"
!define URLInfoAbout          "http://www.mozilla.org/"
!define URLUpdateInfo         "http://www.mozilla.org/projects/calendar/sunbird/"
