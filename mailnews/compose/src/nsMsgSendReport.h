/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgSendReport_h__
#define __nsMsgSendReport_h__

#include "nsIMsgSendReport.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"

class nsMsgProcessReport : public nsIMsgProcessReport
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGPROCESSREPORT

  nsMsgProcessReport();
  virtual ~nsMsgProcessReport();

private:
  bool      mProceeded;
  nsresult  mError;
  nsString  mMessage;
};


class nsMsgSendReport : public nsIMsgSendReport
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSENDREPORT

  nsMsgSendReport();
  virtual ~nsMsgSendReport();

private:
  #define SEND_LAST_PROCESS  process_FCC
  nsCOMPtr<nsIMsgProcessReport> mProcessReport[SEND_LAST_PROCESS + 1];
  int32_t mDeliveryMode;
  int32_t mCurrentProcess;
  bool mAlreadyDisplayReport;
};

#endif
