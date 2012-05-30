# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifdef XP_MACOSX
  <!-- Needed for Mac OS X "Window" menu -->
  <script type="application/javascript" src="chrome://sunbird/content/hiddenWindow.js"/>
#endif

  <script type="application/javascript" src="chrome://calendar/content/calendar.js"/>
  <script type="application/javascript" src="chrome://sunbird/content/calendar-offline.js"/>
  <script type="application/javascript" src="chrome://calendar/content/calendar-migration-dialog.js"/>

  <!-- NEEDED FOR APPLICATION SUPPORT -->
  <script type="application/javascript" src="chrome://sunbird/content/applicationUtil.js"/>
  <script type="application/javascript" src="chrome://calendar/content/calApplicationUtils.js"/>
  <script type="application/javascript" src="chrome://global/content/globalOverlay.js"/>
  <script type="application/javascript" src="chrome://global/content/printUtils.js"/>
