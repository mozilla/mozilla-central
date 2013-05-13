/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <string.h>
#include "nsMimeRebuffer.h"
#include "prmem.h"

MimeRebuffer::MimeRebuffer(void)
{
}

MimeRebuffer::~MimeRebuffer(void)
{
}

uint32_t
MimeRebuffer::GetSize()
{
  return mBuf.Length();
}

uint32_t
MimeRebuffer::IncreaseBuffer(const nsACString &addBuf)
{
  mBuf.Append(addBuf);
  return mBuf.Length();
}

uint32_t
MimeRebuffer::ReduceBuffer(uint32_t numBytes)
{
  if (numBytes == 0)
    return mBuf.Length();

  if (numBytes >= mBuf.Length())
  {
    mBuf.Truncate();
    return 0;
  }

  mBuf.Cut(0, numBytes);
  return mBuf.Length();
}

nsACString &
MimeRebuffer::GetBuffer()
{
  return mBuf;
}
