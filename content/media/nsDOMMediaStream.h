/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef NSDOMMEDIASTREAM_H_
#define NSDOMMEDIASTREAM_H_

#include "nsIDOMMediaStream.h"
#include "GraphManager.h"
#include "nsCycleCollectionParticipant.h"

/**
 * DOM wrapper for Streams.
 */
class nsDOMMediaStream : public nsIDOMMediaStream
{
  typedef mozilla::media::Stream Stream;

public:
  nsDOMMediaStream() : mStream(nsnull) {}
  virtual ~nsDOMMediaStream();

  NS_DECL_CYCLE_COLLECTION_CLASS(nsDOMMediaStream)
  NS_DECL_CYCLE_COLLECTING_ISUPPORTS

  NS_DECL_NSIDOMMEDIASTREAM

  Stream* GetStream() { return mStream; }
  bool IsFinished() { return !mStream || mStream->IsFinished(); }

  static already_AddRefed<nsDOMMediaStream> CreateInputStream();

protected:
  // Stream is owned by the graph, but we tell it when to die, and it won't
  // die until we let it.
  Stream* mStream;
};

#endif /* NSDOMMEDIASTREAM_H_ */
