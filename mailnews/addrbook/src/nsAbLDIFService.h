/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef __nsAbLDIFService_h
#define __nsAbLDIFService_h

#include "nsIAbLDIFService.h"
#include "nsCOMPtr.h"

class nsIMdbRow;

class nsAbLDIFService : public nsIAbLDIFService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABLDIFSERVICE

  nsAbLDIFService();
  virtual ~nsAbLDIFService();
private:
  nsresult        str_parse_line(char *line, char **type, char **value, int *vlen) const;
  char *          str_getline(char **next) const;
  nsresult        GetLdifStringRecord(char* buf, int32_t len, int32_t& stopPos);
  void AddLdifRowToDatabase(nsIAddrDatabase *aDatabase, bool aIsList);
  void AddLdifColToDatabase(nsIAddrDatabase *aDatabase, nsIMdbRow* newRow,
                            char* typeSlot, char* valueSlot, bool bIsList);
  void            ClearLdifRecordBuffer();
  void            SplitCRLFAddressField(nsCString &inputAddress, nsCString &outputLine1, nsCString &outputLine2) const;

  bool            mStoreLocAsHome;
  nsCString       mLdifLine;
  int32_t         mLFCount;
  int32_t         mCRCount;
};

#endif
