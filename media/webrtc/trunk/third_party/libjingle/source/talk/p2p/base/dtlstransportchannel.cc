/*
 * libjingle
 * Copyright 2011, Google Inc.
 * Copyright 2011, RTFM, Inc.
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

#include "talk/p2p/base/dtlstransportchannel.h"

#include "talk/base/buffer.h"
#include "talk/base/messagequeue.h"
#include "talk/base/stream.h"
#include "talk/base/sslstreamadapter.h"
#include "talk/base/thread.h"

namespace cricket {

static const size_t kDtlsRecordHeaderLen = 13;
static const size_t kMaxDtlsPacketLen = 2048;

talk_base::StreamResult StreamInterfaceChannel::Read(void* buffer,
                                                     size_t buffer_len,
                                                     size_t* read,
                                                     int* error) {
  if (state_ == talk_base::SS_CLOSED)
    return talk_base::SR_EOS;
  if (state_ == talk_base::SS_OPENING)
    return talk_base::SR_BLOCK;

  return fifo_.Read(buffer, buffer_len, read, error);
}

talk_base::StreamResult StreamInterfaceChannel::Write(const void* data,
                                                      size_t data_len,
                                                      size_t* written,
                                                      int* error) {
  // Always succeeds, since this is an unreliable transport anyway.
  // TODO: Should this block if channel_'s temporarily unwritable?
  channel_->SendPacket(static_cast<const char*>(data), data_len);
  if (written) {
    *written = data_len;
  }
  return talk_base::SR_SUCCESS;
}

bool StreamInterfaceChannel::OnPacketReceived(const char* data, size_t size) {
  // We force a read event here to ensure that we don't overflow our FIFO.
  // Under high packet rate this can occur if we wait for the FIFO to post its
  // own SE_READ.
  bool ret = (fifo_.WriteAll(data, size, NULL, NULL) == talk_base::SR_SUCCESS);
  if (ret) {
    SignalEvent(this, talk_base::SE_READ, 0);
  }
  return ret;
}

void StreamInterfaceChannel::OnEvent(talk_base::StreamInterface* stream,
                                     int sig, int err) {
  SignalEvent(this, sig, err);
}

DtlsTransportChannelWrapper::DtlsTransportChannelWrapper(
                                           Transport* transport,
                                           TransportChannelImpl* channel)
    : TransportChannelImpl(channel->name(), channel->content_type()),
      transport_(transport),
      worker_thread_(talk_base::Thread::Current()),
      channel_(channel),
      downward_(NULL),
      dtls_started_(false),
      dtls_bypass_data_(false) {
  channel_->SignalReadableState.connect(this,
      &DtlsTransportChannelWrapper::OnReadableState);
  channel_->SignalWritableState.connect(this,
      &DtlsTransportChannelWrapper::OnWritableState);
  channel_->SignalReadPacket.connect(this,
      &DtlsTransportChannelWrapper::OnReadPacket);
  channel_->SignalRequestSignaling.connect(this,
      &DtlsTransportChannelWrapper::OnRequestSignaling);
  channel_->SignalCandidateReady.connect(this,
      &DtlsTransportChannelWrapper::OnCandidateReady);
  channel_->SignalCandidatesAllocationDone.connect(this,
      &DtlsTransportChannelWrapper::OnCandidatesAllocationDone);
  channel_->SignalRouteChange.connect(this,
      &DtlsTransportChannelWrapper::OnRouteChange);
}

DtlsTransportChannelWrapper::~DtlsTransportChannelWrapper() {
}

bool DtlsTransportChannelWrapper::SetupDtls(talk_base::SSLIdentity* identity,
                                            talk_base::SSLRole role,
                                            const std::string& digest_alg,
                                            const unsigned char* digest,
                                            std::size_t digest_len) {
  if (dtls_.get()) {
    LOG(LS_WARNING) << "DTLS is already set up";
    return true;
  }

  StreamInterfaceChannel* downward =
      new StreamInterfaceChannel(worker_thread_, channel_);
  dtls_.reset(talk_base::SSLStreamAdapter::Create(downward));
  if (!dtls_.get()) {
    LOG(LS_ERROR) << "Failed to create DTLS adapter";
    delete downward;
    return false;
  }

  downward_ = downward;

  dtls_->SetIdentity(identity->GetReference());
  dtls_->SetMode(talk_base::SSL_MODE_DTLS);
  dtls_->SetServerRole(role);
  dtls_->SignalEvent.connect(this, &DtlsTransportChannelWrapper::OnDtlsEvent);
  if (!dtls_->SetPeerCertificateDigest(digest_alg, digest, digest_len)) {
    LOG(LS_ERROR) << "Couldn't set DTLS certificate digest";
    return false;
  }

  // Set up DTLS-SRTP, if it's been enabled.
  if (!srtp_ciphers_.empty()) {
    if (!dtls_->SetDtlsSrtpCiphers(srtp_ciphers_)) {
      LOG(LS_ERROR) << "Couldn't set DTLS-SRTP ciphers";
      return false;
    }
  }

  // If we're already writable, start handshaking.
  if (!MaybeStartDtls()) {
    return false;
  }

  LOG(LS_INFO) << "DTLS setup complete";
  return true;
}

// Called from upper layers to send a media packet.
int DtlsTransportChannelWrapper::SendPacket(const char* data, size_t size) {
  // Fail if we're doing DTLS but it's not live yet.
  if (dtls_.get() && dtls_->GetState() != talk_base::SS_OPEN)
    return -1;

  // dtls_bypass_data_ instructs us not to encrypt the data using
  // DTLS. This is used for SRTP, which shouldn't be
  // double-encrypted.
  int result;
  if (!dtls_.get() || dtls_bypass_data_) {
    result = channel_->SendPacket(data, size);
  } else {
    result = (dtls_->WriteAll(data, size, NULL, NULL) ==
        talk_base::SR_SUCCESS) ? static_cast<int>(size) : -1;
  }

  return result;
}

// The state transition logic here is as follows:
// (1) If we're not doing DTLS-SRTP, then the state is just the
//     state of the underlying impl()
// (2) If we're doing DTLS-SRTP:
//     - Prior to the DTLS handshake, the state is neither readable or
//       writable
//     - When the impl goes writable for the first time we
//       start the DTLS handshake
//     - Once the DTLS handshake completes, the state is that of the
//       impl again
void DtlsTransportChannelWrapper::OnReadableState(TransportChannel* channel) {
  ASSERT(talk_base::Thread::Current() == worker_thread_);
  ASSERT(channel == channel_);
  LOG(LS_VERBOSE)
      << "DTLSTransportChannelWrapper: channel readable state changed";

  if (!dtls_.get() || (dtls_->GetState() == talk_base::SS_OPEN)) {
    set_readable(channel_->readable());
    // Note: SignalReadableState fired by set_readable.
  }
}

void DtlsTransportChannelWrapper::OnWritableState(TransportChannel* channel) {
  ASSERT(talk_base::Thread::Current() == worker_thread_);
  ASSERT(channel == channel_);
  LOG(LS_VERBOSE)
      << "DTLSTransportChannelWrapper: channel writable state changed";

  if (dtls_.get()) {
    if (!dtls_started_) {
      if (!MaybeStartDtls()) {
        ASSERT(false);  // This should never happen.
      }
    } else {
      if (dtls_->GetState() == talk_base::SS_OPEN) {
        set_writable(channel_->writable());
        // Note: SignalWritableState fired by set_writable.
      }
    }
  } else {
    set_writable(channel_->writable());
    // Note: SignalWritableState fired by set_writable.
  }
}

void DtlsTransportChannelWrapper::OnReadPacket(TransportChannel* channel,
                                               const char* data, size_t size) {
  ASSERT(talk_base::Thread::Current() == worker_thread_);
  ASSERT(channel == channel_);
  const uint8* datau = reinterpret_cast<const uint8*>(data);

  if (dtls_started_) {
    // Is this potentially a DTLS packet?
    if ((size >= kDtlsRecordHeaderLen) && (datau[0] > 19) && (datau[0] < 64)) {
      if (!HandleDtlsPacket(data, size)) {
        LOG(LS_ERROR) << "Failed to handle DTLS packet";
        return;
      }
    } else {
      if (!dtls_bypass_data_) {
        LOG(LS_ERROR) << "Received non-DTLS packet on non-bypass channel";
        return;
      }
      if (dtls_->GetState() != talk_base::SS_OPEN) {
        LOG(LS_ERROR) << "Received non-DTLS packet before DTLS complete";
        return;
      }

      // We get here if we are doing SRTP because the data is
      // not DTLS encrypted.
      SignalReadPacket(this, data, size);
    }
  } else if (!dtls_.get()) {
    // This is the fallback case, where we never tried to establish DTLS.
    SignalReadPacket(this, data, size);
  } else {
    // TODO: Decide if this is the right thing to do.
    // This might happen if the other side goes writable and sends its client
    // hello before we go writable; we'll ignore it and it will retransmit.
    // If we accepted it, we'd fail sending our server hello. However, if we
    // end up piggybacking DTLS info on STUN, this could all change.
    LOG(LS_WARNING) << "Received packet before DTLS started";
  }
}

void DtlsTransportChannelWrapper::OnDtlsEvent(talk_base::StreamInterface* dtls,
                                              int sig, int err) {
  ASSERT(talk_base::Thread::Current() == worker_thread_);
  ASSERT(dtls == dtls_.get());
  if (sig & talk_base::SE_OPEN) {
    // This is the first time.
    LOG(LS_INFO) << "DTLS handshake complete";
    if (dtls_->GetState() == talk_base::SS_OPEN) {
      // The check for OPEN shouldn't be necessary but let's make
      // sure we don't accidentally frob the state if it's closed.
      set_readable(true);
      set_writable(true);
    }
  }
  if (sig & talk_base::SE_READ) {
    char buf[kMaxDtlsPacketLen];
    size_t read;
    if (dtls_->Read(buf, sizeof(buf), &read, NULL) == talk_base::SR_SUCCESS) {
      SignalReadPacket(this, buf, read);
    }
  }
  if (sig & talk_base::SE_CLOSE) {
    ASSERT(sig == talk_base::SE_CLOSE);  // SE_CLOSE should be by itself.
    if (!err) {
      LOG(LS_INFO) << "DTLS channel closed";
    } else {
      LOG(LS_INFO) << "DTLS channel error, code=" << err;
    }

    set_readable(false);
    set_writable(false);
  }
}

bool DtlsTransportChannelWrapper::MaybeStartDtls() {
  if (channel_->writable()) {
    if (dtls_->StartSSLWithPeer()) {
      LOG(LS_ERROR) << "Couldn't start DTLS handshake";
      return false;
    }
    LOG(LS_INFO) << "DtlsTransportChannelWrapper: Started DTLS handshake";
    dtls_started_ = true;
  }
  return true;
}

// Called from OnReadPacket when a DTLS packet is received.
bool DtlsTransportChannelWrapper::HandleDtlsPacket(const char* data,
                                                   size_t size) {
  // Sanity check we're not passing junk that
  // just looks like DTLS.
  const uint8* tmp_data = reinterpret_cast<const uint8* >(data);
  size_t tmp_size = size;
  while (tmp_size > 0) {
    if (tmp_size < kDtlsRecordHeaderLen)
      return false;  // Too short for the header

    size_t record_len = (tmp_data[11] << 8) | (tmp_data[12]);
    if ((record_len + kDtlsRecordHeaderLen) > tmp_size)
      return false;  // Body too short

    tmp_data += record_len + kDtlsRecordHeaderLen;
    tmp_size -= record_len + kDtlsRecordHeaderLen;
  }

  // Looks good. Pass to the SIC which ends up being passed to
  // the DTLS stack.
  return downward_->OnPacketReceived(data, size);
}

void DtlsTransportChannelWrapper::OnRequestSignaling(
    TransportChannelImpl* channel) {
  ASSERT(channel == channel_);
  SignalRequestSignaling(this);
}

void DtlsTransportChannelWrapper::OnCandidateReady(
    TransportChannelImpl* channel, const Candidate& c) {
  ASSERT(channel == channel_);
  SignalCandidateReady(this, c);
}

void DtlsTransportChannelWrapper::OnCandidatesAllocationDone(
    TransportChannelImpl* channel) {
  ASSERT(channel == channel_);
  SignalCandidatesAllocationDone(this);
}

void DtlsTransportChannelWrapper::OnRouteChange(
    TransportChannel* channel, const Candidate& candidate) {
  ASSERT(channel == channel_);
  SignalRouteChange(this, candidate);
}

}  // namespace cricket

