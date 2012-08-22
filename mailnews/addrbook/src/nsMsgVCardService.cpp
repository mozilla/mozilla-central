/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgVCardService.h"
#include "nsVCard.h"
#include "prmem.h"
#include "plstr.h"
    
NS_IMPL_ISUPPORTS1(nsMsgVCardService, nsIMsgVCardService)

nsMsgVCardService::nsMsgVCardService()
{
}

nsMsgVCardService::~nsMsgVCardService()
{
}

NS_IMETHODIMP_(void) nsMsgVCardService::CleanVObject(VObject * o)
{
    cleanVObject(o);
}

NS_IMETHODIMP_(VObject *) nsMsgVCardService::NextVObjectInList(VObject * o)
{
    return nextVObjectInList(o);
}

NS_IMETHODIMP_(VObject *) nsMsgVCardService::Parse_MIME(const char *input, uint32_t len)
{
    return parse_MIME(input, (unsigned long)len);
}

NS_IMETHODIMP_(char *) nsMsgVCardService::FakeCString(VObject * o)
{
    return fakeCString(vObjectUStringZValue(o));
}

NS_IMETHODIMP_(VObject *) nsMsgVCardService::IsAPropertyOf(VObject * o, const char *id)
{
    return isAPropertyOf(o,id);
}

NS_IMETHODIMP_(char *) nsMsgVCardService::WriteMemoryVObjects(const char *s, int32_t *len, VObject * list, bool expandSpaces)
{
    return writeMemoryVObjects((char *)s, len, list, expandSpaces);
}

NS_IMETHODIMP_(VObject *) nsMsgVCardService::NextVObject(VObjectIterator * i)
{
    return nextVObject(i);
}

NS_IMETHODIMP_(void) nsMsgVCardService::InitPropIterator(VObjectIterator * i, VObject * o)
{
    initPropIterator(i,o);
}

NS_IMETHODIMP_(int32_t) nsMsgVCardService::MoreIteration(VObjectIterator * i)
{
    return ((int32_t)moreIteration(i));
}

NS_IMETHODIMP_(const char *) nsMsgVCardService::VObjectName(VObject * o)
{
    return vObjectName(o);
}

NS_IMETHODIMP_(char *) nsMsgVCardService::VObjectAnyValue(VObject * o)
{
    char *retval = (char *)PR_MALLOC(strlen((char *)vObjectAnyValue(o)) + 1);
    if (retval)
        PL_strcpy(retval, (char *) vObjectAnyValue(o));
    return retval;
}
