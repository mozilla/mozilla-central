/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsImapStringBundle_H__
#define _nsImapStringBundle_H__

#include "nsIStringBundle.h"

PR_BEGIN_EXTERN_C

nsresult      IMAPGetStringByName(const char* stringName, PRUnichar **aString);
nsresult      IMAPGetStringBundle(nsIStringBundle **aBundle);

PR_END_EXTERN_C

#endif /* _nsImapStringBundle_H__ */
