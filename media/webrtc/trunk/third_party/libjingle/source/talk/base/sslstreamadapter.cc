/*
 * libjingle
 * Copyright 2004--2008, Google Inc.
 *
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice, 
 *     this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products 
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF 
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, 
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR 
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF 
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#if HAVE_CONFIG_H
#include "config.h"
#endif  // HAVE_CONFIG_H

// Decide which (if any) implementation of SSL we will use.
#if !defined(SSL_USE_SCHANNEL) && !defined(SSL_USE_OPENSSL)
#ifdef WIN32
#define SSL_USE_SCHANNEL 1
#else  // !WIN32
#define SSL_USE_OPENSSL HAVE_OPENSSL_SSL_H
#endif  // !WIN32
#endif

#include "talk/base/sslstreamadapter.h"

#if SSL_USE_SCHANNEL

#error "Not implemented yet"

#elif SSL_USE_OPENSSL  // && !SSL_USE_SCHANNEL

#include "talk/base/opensslstreamadapter.h"

#endif  // SSL_USE_OPENSSL && !SSL_USE_SCHANNEL

///////////////////////////////////////////////////////////////////////////////

namespace talk_base {

SSLStreamAdapter* SSLStreamAdapter::Create(StreamInterface* stream) {
#if SSL_USE_SCHANNEL
  // not implemented yet
  // return new SChannelStreamAdapter(stream);
#elif SSL_USE_OPENSSL  // && !SSL_USE_SCHANNEL
  return new OpenSSLStreamAdapter(stream);
#else  // !SSL_USE_OPENSSL && !SSL_USE_SCHANNEL
  return NULL;
#endif  // !SSL_USE_OPENSSL && !SSL_USE_SCHANNEL
}

///////////////////////////////////////////////////////////////////////////////

}  // namespace talk_base
