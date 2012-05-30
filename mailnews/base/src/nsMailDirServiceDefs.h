/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#ifndef nsMailDirectoryServiceDefs_h___
#define nsMailDirectoryServiceDefs_h___

//=============================================================================
//
// Defines property names for directories available from the mail-specific
// nsMailDirProvider.
//
// System and XPCOM properties are defined in nsDirectoryServiceDefs.h.
// General application properties are defined in nsAppDirectoryServiceDefs.h.
//
//=============================================================================

// ----------------------------------------------------------------------------
// Files and directories that exist on a per-profile basis.
// ----------------------------------------------------------------------------

#define NS_APP_MAIL_50_DIR                      "MailD"
#define NS_APP_IMAP_MAIL_50_DIR                 "IMapMD"
#define NS_APP_NEWS_50_DIR                      "NewsD"

#define NS_APP_MESSENGER_FOLDER_CACHE_50_FILE   "MFCaF"

#define ISP_DIRECTORY_LIST                 "ISPDL"
      
#endif
