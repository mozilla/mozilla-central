/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...

#include "nsIURL.h"
#include "nsPop3URL.h"
#include "nsPop3Protocol.h"
#include "nsStringGlue.h"
#include "prmem.h"
#include "plstr.h"
#include "prprf.h"

nsPop3URL::nsPop3URL(): nsMsgMailNewsUrl()
{
}

nsPop3URL::~nsPop3URL()
{
}

NS_IMPL_ISUPPORTS_INHERITED1(nsPop3URL, nsMsgMailNewsUrl, nsIPop3URL)


////////////////////////////////////////////////////////////////////////////////////
// Begin nsIPop3URL specific support
////////////////////////////////////////////////////////////////////////////////////

nsresult nsPop3URL::SetPop3Sink(nsIPop3Sink* aPop3Sink)
{
    if (aPop3Sink)
        m_pop3Sink = aPop3Sink;
    return NS_OK;
}

nsresult nsPop3URL::GetPop3Sink(nsIPop3Sink** aPop3Sink)
{
    if (aPop3Sink)
    {
        *aPop3Sink = m_pop3Sink;
        NS_IF_ADDREF(*aPop3Sink);
    }
    return NS_OK;
}

NS_IMETHODIMP
nsPop3URL::GetMessageUri(char ** aMessageUri)
{
    if(!aMessageUri || m_messageUri.IsEmpty())
        return NS_ERROR_NULL_POINTER;
    *aMessageUri = ToNewCString(m_messageUri);
    return NS_OK;
}

NS_IMETHODIMP
nsPop3URL::SetMessageUri(const char *aMessageUri)
{
    if (aMessageUri)
        m_messageUri = aMessageUri;
    return NS_OK;
}
