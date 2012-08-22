/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgPrompts_H_
#define _nsMsgPrompts_H_

#include "nscore.h"
#include "nsError.h"
#include "nsStringGlue.h"

class nsIPrompt;

nsresult      nsMsgGetMessageByID(int32_t aMsgID, nsString& aResult);
nsresult      nsMsgBuildMessageWithFile(nsIFile * aFile, nsString& aResult);
nsresult      nsMsgBuildMessageWithTmpFile(nsIFile * aFile, nsString& aResult);
nsresult      nsMsgDisplayMessageByID(nsIPrompt * aPrompt, int32_t msgID, const PRUnichar * windowTitle = nullptr);
nsresult      nsMsgDisplayMessageByString(nsIPrompt * aPrompt, const PRUnichar * msg, const PRUnichar * windowTitle = nullptr);
nsresult      nsMsgAskBooleanQuestionByString(nsIPrompt * aPrompt, const PRUnichar * msg, bool *answer, const PRUnichar * windowTitle = nullptr);

#endif /* _nsMsgPrompts_H_ */
