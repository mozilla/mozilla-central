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

#if HAVE_OPENSSL_SSL_H

#include "talk/base/opensslstreamadapter.h"

#include <openssl/bio.h>
#include <openssl/crypto.h>
#include <openssl/err.h>
#include <openssl/rand.h>
#include <openssl/ssl.h>
#include <openssl/x509v3.h>

#include "talk/base/common.h"
#include "talk/base/logging.h"
#include "talk/base/stream.h"
#include "talk/base/openssladapter.h"
#include "talk/base/opensslidentity.h"
#include "talk/base/stringutils.h"

namespace talk_base {

//////////////////////////////////////////////////////////////////////
// StreamBIO
//////////////////////////////////////////////////////////////////////

static int stream_write(BIO* h, const char* buf, int num);
static int stream_read(BIO* h, char* buf, int size);
static int stream_puts(BIO* h, const char* str);
static long stream_ctrl(BIO* h, int cmd, long arg1, void* arg2);
static int stream_new(BIO* h);
static int stream_free(BIO* data);

static BIO_METHOD methods_stream = {
  BIO_TYPE_BIO,
  "stream",
  stream_write,
  stream_read,
  stream_puts,
  0,
  stream_ctrl,
  stream_new,
  stream_free,
  NULL,
};

static BIO_METHOD* BIO_s_stream() { return(&methods_stream); }

static BIO* BIO_new_stream(StreamInterface* stream) {
  BIO* ret = BIO_new(BIO_s_stream());
  if (ret == NULL)
    return NULL;
  ret->ptr = stream;
  return ret;
}

// bio methods return 1 (or at least non-zero) on success and 0 on failure.

static int stream_new(BIO* b) {
  b->shutdown = 0;
  b->init = 1;
  b->num = 0;  // 1 means end-of-stream
  b->ptr = 0;
  return 1;
}

static int stream_free(BIO* b) {
  if (b == NULL)
    return 0;
  return 1;
}

static int stream_read(BIO* b, char* out, int outl) {
  if (!out)
    return -1;
  StreamInterface* stream = static_cast<StreamInterface*>(b->ptr);
  BIO_clear_retry_flags(b);
  size_t read;
  int error;
  StreamResult result = stream->Read(out, outl, &read, &error);
  if (result == SR_SUCCESS) {
    return read;
  } else if (result == SR_EOS) {
    b->num = 1;
  } else if (result == SR_BLOCK) {
    BIO_set_retry_read(b);
  }
  return -1;
}

static int stream_write(BIO* b, const char* in, int inl) {
  if (!in)
    return -1;
  StreamInterface* stream = static_cast<StreamInterface*>(b->ptr);
  BIO_clear_retry_flags(b);
  size_t written;
  int error;
  StreamResult result = stream->Write(in, inl, &written, &error);
  if (result == SR_SUCCESS) {
    return written;
  } else if (result == SR_BLOCK) {
    BIO_set_retry_write(b);
  }
  return -1;
}

static int stream_puts(BIO* b, const char* str) {
  return stream_write(b, str, strlen(str));
}

static long stream_ctrl(BIO* b, int cmd, long num, void* ptr) {
  UNUSED(num);
  UNUSED(ptr);

  switch (cmd) {
    case BIO_CTRL_RESET:
      return 0;
    case BIO_CTRL_EOF:
      return b->num;
    case BIO_CTRL_WPENDING:
    case BIO_CTRL_PENDING:
      return 0;
    case BIO_CTRL_FLUSH:
      return 1;
    default:
      return 0;
  }
}

/////////////////////////////////////////////////////////////////////////////
// OpenSSLStreamAdapter
/////////////////////////////////////////////////////////////////////////////

OpenSSLStreamAdapter::OpenSSLStreamAdapter(StreamInterface* stream)
    : SSLStreamAdapter(stream),
      state_(SSL_NONE),
      role_(SSL_CLIENT),
      ssl_read_needs_write_(false), ssl_write_needs_read_(false),
      ssl_(NULL), ssl_ctx_(NULL),
      custom_verification_succeeded_(false) {
}

OpenSSLStreamAdapter::~OpenSSLStreamAdapter() {
  Cleanup();
}

void OpenSSLStreamAdapter::SetIdentity(SSLIdentity* identity) {
  ASSERT(identity_.get() == NULL);
  identity_.reset(static_cast<OpenSSLIdentity*>(identity));
}

void OpenSSLStreamAdapter::SetServerRole() {
  role_ = SSL_SERVER;
}

void OpenSSLStreamAdapter::SetPeerCertificate(SSLCertificate* cert) {
  ASSERT(peer_certificate_.get() == NULL);
  ASSERT(ssl_server_name_.empty());
  peer_certificate_.reset(static_cast<OpenSSLCertificate*>(cert));
}

int OpenSSLStreamAdapter::StartSSLWithServer(const char* server_name) {
  ASSERT(server_name != NULL && server_name[0] != '\0');
  ssl_server_name_ = server_name;
  return StartSSL();
}

int OpenSSLStreamAdapter::StartSSLWithPeer() {
  ASSERT(ssl_server_name_.empty());
  // It is permitted to specify peer_certificate_ only later.
  return StartSSL();
}

//
// StreamInterface Implementation
//

StreamResult OpenSSLStreamAdapter::Write(const void* data, size_t data_len,
                                         size_t* written, int* error) {
  LOG(LS_INFO) << "OpenSSLStreamAdapter::Write(" << data_len << ")";

  switch (state_) {
  case SSL_NONE:
    // pass-through in clear text
    return StreamAdapterInterface::Write(data, data_len, written, error);

  case SSL_WAIT:
  case SSL_CONNECTING:
    return SR_BLOCK;

  case SSL_CONNECTED:
    break;

  case SSL_ERROR:
  case SSL_CLOSED:
  default:
    if (error)
      *error = ssl_error_code_;
    return SR_ERROR;
  }

  // OpenSSL will return an error if we try to write zero bytes
  if (data_len == 0) {
    if (written)
      *written = 0;
    return SR_SUCCESS;
  }

  ssl_write_needs_read_ = false;

  int code = SSL_write(ssl_, data, data_len);
  switch (SSL_get_error(ssl_, code)) {
  case SSL_ERROR_NONE:
    LOG(LS_INFO) << " -- success";
    ASSERT(0 < code && static_cast<unsigned>(code) <= data_len);
    if (written)
      *written = code;
    return SR_SUCCESS;
  case SSL_ERROR_WANT_READ:
    LOG(LS_INFO) << " -- error want read";
    ssl_write_needs_read_ = true;
    return SR_BLOCK;
  case SSL_ERROR_WANT_WRITE:
    LOG(LS_INFO) << " -- error want write";
    return SR_BLOCK;

  case SSL_ERROR_ZERO_RETURN:
  default:
    Error("SSL_write", (code ? code : -1), false);
    if (error)
      *error = ssl_error_code_;
    return SR_ERROR;
  }
  // not reached
}

StreamResult OpenSSLStreamAdapter::Read(void* data, size_t data_len,
                                        size_t* read, int* error) {
  LOG(LS_INFO) << "OpenSSLStreamAdapter::Read(" << data_len << ")";
  switch (state_) {
    case SSL_NONE:
      // pass-through in clear text
      return StreamAdapterInterface::Read(data, data_len, read, error);

    case SSL_WAIT:
    case SSL_CONNECTING:
      return SR_BLOCK;

    case SSL_CONNECTED:
      break;

    case SSL_CLOSED:
      return SR_EOS;

    case SSL_ERROR:
    default:
      if (error)
        *error = ssl_error_code_;
      return SR_ERROR;
  }

  // Don't trust OpenSSL with zero byte reads
  if (data_len == 0) {
    if (read)
      *read = 0;
    return SR_SUCCESS;
  }

  ssl_read_needs_write_ = false;

  int code = SSL_read(ssl_, data, data_len);
  switch (SSL_get_error(ssl_, code)) {
    case SSL_ERROR_NONE:
      LOG(LS_INFO) << " -- success";
      ASSERT(0 < code && static_cast<unsigned>(code) <= data_len);
      if (read)
        *read = code;
      return SR_SUCCESS;
    case SSL_ERROR_WANT_READ:
      LOG(LS_INFO) << " -- error want read";
      return SR_BLOCK;
    case SSL_ERROR_WANT_WRITE:
      LOG(LS_INFO) << " -- error want write";
      ssl_read_needs_write_ = true;
      return SR_BLOCK;
    case SSL_ERROR_ZERO_RETURN:
      LOG(LS_INFO) << " -- remote side closed";
      return SR_EOS;
      break;
    default:
      LOG(LS_INFO) << " -- error " << code;
      Error("SSL_read", (code ? code : -1), false);
      if (error)
        *error = ssl_error_code_;
      return SR_ERROR;
  }
  // not reached
}

void OpenSSLStreamAdapter::Close() {
  Cleanup();
  ASSERT(state_ == SSL_CLOSED || state_ == SSL_ERROR);
  StreamAdapterInterface::Close();
}

StreamState OpenSSLStreamAdapter::GetState() const {
  switch(state_) {
    case SSL_WAIT:
    case SSL_CONNECTING:
      return SS_OPENING;
    case SSL_CONNECTED:
      return SS_OPEN;
    default:
      return SS_CLOSED;
  };
  // not reached
}

void OpenSSLStreamAdapter::OnEvent(StreamInterface* stream, int events,
                                   int err) {
  int events_to_signal = 0;
  int signal_error = 0;
  ASSERT(stream == this->stream());
  if ((events & SE_OPEN)) {
    LOG(LS_INFO) << "OpenSSLStreamAdapter::OnEvent SE_OPEN";
    if (state_ != SSL_WAIT) {
      ASSERT(state_ == SSL_NONE);
      events_to_signal |= SE_OPEN;
    } else {
      state_ = SSL_CONNECTING;
      if (int err = BeginSSL()) {
        Error("BeginSSL", err, true);
        return;
      }
    }
  }
  if ((events & (SE_READ|SE_WRITE))) {
    LOG(LS_INFO) << "OpenSSLStreamAdapter::OnEvent"
                 << ((events & SE_READ) ? " SE_READ" : "")
                 << ((events & SE_WRITE) ? " SE_WRITE" : "");
    if (state_ == SSL_NONE) {
      events_to_signal |= events & (SE_READ|SE_WRITE);
    } else if (state_ == SSL_CONNECTING) {
      if (int err = ContinueSSL()) {
        Error("ContinueSSL", err, true);
        return;
      }
    } else if (state_ == SSL_CONNECTED) {
      if (((events & SE_READ) && ssl_write_needs_read_) ||
          (events & SE_WRITE)) {
        LOG(LS_INFO) << " -- onStreamWriteable";
        events_to_signal |= SE_WRITE;
      }
      if (((events & SE_WRITE) && ssl_read_needs_write_) ||
          (events & SE_READ)) {
        LOG(LS_INFO) << " -- onStreamReadable";
        events_to_signal |= SE_READ;
      }
    }
  }
  if ((events & SE_CLOSE)) {
    LOG(LS_INFO) << "OpenSSLStreamAdapter::OnEvent(SE_CLOSE, " << err << ")";
    Cleanup();
    events_to_signal |= SE_CLOSE;
    // SE_CLOSE is the only event that uses the final parameter to OnEvent().
    ASSERT(signal_error == 0);
    signal_error = err;
  }
  if(events_to_signal)
    StreamAdapterInterface::OnEvent(stream, events_to_signal, signal_error);
}

int OpenSSLStreamAdapter::StartSSL() {
  ASSERT(state_ == SSL_NONE);

  if (StreamAdapterInterface::GetState() != SS_OPEN) {
    state_ = SSL_WAIT;
    return 0;
  }

  state_ = SSL_CONNECTING;
  if (int err = BeginSSL()) {
    Error("BeginSSL", err, false);
    return err;
  }

  return 0;
}

int OpenSSLStreamAdapter::BeginSSL() {
  ASSERT(state_ == SSL_CONNECTING);
  // The underlying stream has open. If we are in peer-to-peer mode
  // then a peer certificate must have been specified by now.
  ASSERT(!ssl_server_name_.empty() || peer_certificate_.get() != NULL);
  LOG(LS_INFO) << "BeginSSL: "
               << (!ssl_server_name_.empty() ? ssl_server_name_ :
                                               "with peer");

  BIO* bio = NULL;

  // First set up the context
  ASSERT(ssl_ctx_ == NULL);
  ssl_ctx_ = SetupSSLContext();
  if (!ssl_ctx_)
    return -1;

  bio = BIO_new_stream(static_cast<StreamInterface*>(stream()));
  if (!bio)
    return -1;

  ssl_ = SSL_new(ssl_ctx_);
  if (!ssl_) {
    BIO_free(bio);
    return -1;
  }

  SSL_set_app_data(ssl_, this);

  SSL_set_bio(ssl_, bio, bio);  // the SSL object owns the bio now.

  SSL_set_mode(ssl_, SSL_MODE_ENABLE_PARTIAL_WRITE |
               SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER);

  // Do the connect
  return ContinueSSL();
}

int OpenSSLStreamAdapter::ContinueSSL() {
  LOG(LS_INFO) << "ContinueSSL";
  ASSERT(state_ == SSL_CONNECTING);

  int code = (role_ == SSL_CLIENT) ? SSL_connect(ssl_) : SSL_accept(ssl_);
  switch (SSL_get_error(ssl_, code)) {
    case SSL_ERROR_NONE:
      LOG(LS_INFO) << " -- success";

      if (!SSLPostConnectionCheck(ssl_, ssl_server_name_.c_str(),
                                  peer_certificate_.get() != NULL
                                  ? peer_certificate_->x509() : NULL)) {
        LOG(LS_ERROR) << "TLS post connection check failed";
        return -1;
      }

      state_ = SSL_CONNECTED;
      StreamAdapterInterface::OnEvent(stream(), SE_OPEN|SE_READ|SE_WRITE, 0);
      break;

    case SSL_ERROR_WANT_READ:
      LOG(LS_INFO) << " -- error want read";
      break;

    case SSL_ERROR_WANT_WRITE:
      LOG(LS_INFO) << " -- error want write";
      break;

    case SSL_ERROR_ZERO_RETURN:
    default:
      LOG(LS_INFO) << " -- error " << code;
      return (code != 0) ? code : -1;
  }

  return 0;
}

void OpenSSLStreamAdapter::Error(const char* context, int err, bool signal) {
  LOG(LS_WARNING) << "OpenSSLStreamAdapter::Error("
                  << context << ", " << err << ")";
  state_ = SSL_ERROR;
  ssl_error_code_ = err;
  Cleanup();
  if (signal)
    StreamAdapterInterface::OnEvent(stream(), SE_CLOSE, err);
}

void OpenSSLStreamAdapter::Cleanup() {
  LOG(LS_INFO) << "Cleanup";

  if (state_ != SSL_ERROR) {
    state_ = SSL_CLOSED;
    ssl_error_code_ = 0;
  }

  if (ssl_) {
    SSL_free(ssl_);
    ssl_ = NULL;
  }
  if (ssl_ctx_) {
    SSL_CTX_free(ssl_ctx_);
    ssl_ctx_ = NULL;
  }
  identity_.reset();
  peer_certificate_.reset();
}

SSL_CTX* OpenSSLStreamAdapter::SetupSSLContext() {
  SSL_CTX* ctx = SSL_CTX_new(role_ == SSL_CLIENT ? TLSv1_client_method()
                             : TLSv1_server_method());
  if (ctx == NULL)
    return NULL;

  if (identity_.get() && !identity_->ConfigureIdentity(ctx)) {
    SSL_CTX_free(ctx);
    return NULL;
  }

  if (peer_certificate_.get() == NULL) {  // traditional mode
    // Add the root cert to the SSL context
    if(!OpenSSLAdapter::ConfigureTrustedRootCertificates(ctx)) {
      SSL_CTX_free(ctx);
      return NULL;
    }
  }

  if (peer_certificate_.get() != NULL && role_ == SSL_SERVER)
    // we must specify which client cert to ask for
    SSL_CTX_add_client_CA(ctx, peer_certificate_->x509());

#ifdef _DEBUG
  SSL_CTX_set_info_callback(ctx, OpenSSLAdapter::SSLInfoCallback);
#endif

  SSL_CTX_set_verify(ctx, SSL_VERIFY_PEER |SSL_VERIFY_FAIL_IF_NO_PEER_CERT,
                     SSLVerifyCallback);
  SSL_CTX_set_verify_depth(ctx, 4);
  SSL_CTX_set_cipher_list(ctx, "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH");

  return ctx;
}

int OpenSSLStreamAdapter::SSLVerifyCallback(int ok, X509_STORE_CTX* store) {
#if _DEBUG
  if (!ok) {
    char data[256];
    X509* cert = X509_STORE_CTX_get_current_cert(store);
    int depth = X509_STORE_CTX_get_error_depth(store);
    int err = X509_STORE_CTX_get_error(store);

    LOG(LS_INFO) << "Error with certificate at depth: " << depth;
    X509_NAME_oneline(X509_get_issuer_name(cert), data, sizeof(data));
    LOG(LS_INFO) << "  issuer  = " << data;
    X509_NAME_oneline(X509_get_subject_name(cert), data, sizeof(data));
    LOG(LS_INFO) << "  subject = " << data;
    LOG(LS_INFO) << "  err     = " << err
      << ":" << X509_verify_cert_error_string(err);
  }
#endif

  // Get our SSL structure from the store
  SSL* ssl = reinterpret_cast<SSL*>(X509_STORE_CTX_get_ex_data(
                                        store,
                                        SSL_get_ex_data_X509_STORE_CTX_idx()));

  OpenSSLStreamAdapter* stream =
    reinterpret_cast<OpenSSLStreamAdapter*>(SSL_get_app_data(ssl));

  // In peer-to-peer mode, no root cert / certificate authority was
  // specified, so the libraries knows of no certificate to accept,
  // and therefore it will necessarily call here on the first cert it
  // tries to verify.
  if (!ok && stream->peer_certificate_.get() != NULL) {
    X509* cert = X509_STORE_CTX_get_current_cert(store);
    int err = X509_STORE_CTX_get_error(store);
    // peer-to-peer mode: allow the certificate to be self-signed,
    // assuming it matches the cert that was specified.
    if (err == X509_V_ERR_DEPTH_ZERO_SELF_SIGNED_CERT &&
        X509_cmp(cert, stream->peer_certificate_->x509()) == 0) {
      LOG(LS_INFO) << "Accepted self-signed peer certificate authority";
      ok = 1;
    }
  } else if (!ok && OpenSSLAdapter::custom_verify_callback_) {
    // this applies only in traditional mode
    void* cert =
        reinterpret_cast<void*>(X509_STORE_CTX_get_current_cert(store));
    if (OpenSSLAdapter::custom_verify_callback_(cert)) {
      stream->custom_verification_succeeded_ = true;
      LOG(LS_INFO) << "validated certificate using custom callback";
      ok = 1;
    }
  }

  if (!ok && stream->ignore_bad_cert()) {
    LOG(LS_WARNING) << "Ignoring cert error while verifying cert chain";
    ok = 1;
  }

  return ok;
}

// This code is taken from the "Network Security with OpenSSL"
// sample in chapter 5
bool OpenSSLStreamAdapter::SSLPostConnectionCheck(SSL* ssl,
                                                  const char* server_name,
                                                  const X509* peer_cert) {
  ASSERT(server_name != NULL);
  bool ok;
  if(server_name[0] != '\0') {  // traditional mode
    ok = OpenSSLAdapter::VerifyServerName(ssl, server_name, ignore_bad_cert());

    if (ok) {
      ok = (SSL_get_verify_result(ssl) == X509_V_OK ||
            custom_verification_succeeded_);
    }
  } else {  // peer-to-peer mode
    ASSERT(peer_cert != NULL);
    // no server name validation
    ok = true;
  }

  if (!ok && ignore_bad_cert()) {
    LOG(LS_ERROR) << "SSL_get_verify_result(ssl) = "
                  << SSL_get_verify_result(ssl);
    LOG(LS_INFO) << "Other TLS post connection checks failed.";
    ok = true;
  }

  return ok;
}

}  // namespace talk_base

#endif  // HAVE_OPENSSL_SSL_H
