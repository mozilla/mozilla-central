/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
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

#include "talk/p2p/base/session.h"
#include "talk/base/common.h"
#include "talk/base/logging.h"
#include "talk/base/helpers.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/sslstreamadapter.h"
#include "talk/xmpp/constants.h"
#include "talk/xmpp/jid.h"
#include "talk/p2p/base/dtlstransport.h"
#include "talk/p2p/base/p2ptransport.h"
#include "talk/p2p/base/sessionclient.h"
#include "talk/p2p/base/transport.h"
#include "talk/p2p/base/transportchannelproxy.h"

#include "talk/p2p/base/constants.h"

namespace {

const uint32 MSG_TIMEOUT = 1;
const uint32 MSG_ERROR = 2;
const uint32 MSG_STATE = 3;

}  // namespace

namespace cricket {

bool BadMessage(const buzz::QName type,
                const std::string& text,
                MessageError* err) {
  err->SetType(type);
  err->SetText(text);
  return false;
}

TransportProxy::~TransportProxy() {
  for (ChannelMap::iterator iter = channels_.begin();
       iter != channels_.end(); ++iter) {
    iter->second->SignalDestroyed(iter->second);
    delete iter->second;
  }
}

std::string TransportProxy::type() const {
  return transport_->get()->type();
}

void TransportProxy::SetImplementation(TransportWrapper* impl) {
  transport_ = impl;
}

TransportChannel* TransportProxy::GetChannel(const std::string& name) {
  return GetProxy(name);
}

TransportChannel* TransportProxy::CreateChannel(
    const std::string& name, const std::string& content_type) {
  ASSERT(GetChannel(name) == NULL);
  ASSERT(!transport_->get()->HasChannel(name));

  // We always create a proxy in case we need to change out the transport later.
  TransportChannelProxy* channel =
      new TransportChannelProxy(name, content_type);
  channels_[name] = channel;

  if (state_ == STATE_NEGOTIATED) {
    SetProxyImpl(name, channel);
  } else if (state_ == STATE_CONNECTING) {
    GetOrCreateImpl(name, content_type);
  }
  return channel;
}

void TransportProxy::DestroyChannel(const std::string& name) {
  TransportChannel* channel = GetChannel(name);
  if (channel) {
    channels_.erase(name);
    channel->SignalDestroyed(channel);
    delete channel;
  }
}

void TransportProxy::SpeculativelyConnectChannels() {
  if (state_ != STATE_NEGOTIATED) {
    state_ = STATE_CONNECTING;
    for (ChannelMap::iterator iter = channels_.begin();
         iter != channels_.end(); ++iter) {
      GetOrCreateImpl(iter->first, iter->second->content_type());
    }
    transport_->get()->ConnectChannels();
  }
}

void TransportProxy::CompleteNegotiation() {
  if (state_ != STATE_NEGOTIATED) {
    state_ = STATE_NEGOTIATED;
    for (ChannelMap::iterator iter = channels_.begin();
         iter != channels_.end(); ++iter) {
      SetProxyImpl(iter->first, iter->second);
    }
    transport_->get()->ConnectChannels();
  }
}

void TransportProxy::AddSentCandidates(const Candidates& candidates) {
  for (Candidates::const_iterator cand = candidates.begin();
       cand != candidates.end(); ++cand) {
    sent_candidates_.push_back(*cand);
  }
}

void TransportProxy::AddUnsentCandidates(const Candidates& candidates) {
  for (Candidates::const_iterator cand = candidates.begin();
       cand != candidates.end(); ++cand) {
    unsent_candidates_.push_back(*cand);
  }
}


TransportChannelProxy* TransportProxy::GetProxy(const std::string& name) {
  ChannelMap::iterator iter = channels_.find(name);
  return (iter != channels_.end()) ? iter->second : NULL;
}

TransportChannelImpl* TransportProxy::GetOrCreateImpl(
    const std::string& name, const std::string& content_type) {
  TransportChannelImpl* impl = transport_->get()->GetChannel(name);
  if (impl == NULL) {
    impl = transport_->get()->CreateChannel(name, content_type);
    impl->set_session_id(sid_);
  }
  return impl;
}

void TransportProxy::SetProxyImpl(
    const std::string& name, TransportChannelProxy* proxy) {
  TransportChannelImpl* impl = GetOrCreateImpl(name, proxy->content_type());
  ASSERT(impl != NULL);
  proxy->SetImplementation(impl);
}

// This function muxes |this| onto proxy by making a copy
// of |proxy|'s transport and setting our TransportChannelProxies
// to point to |proxy|'s underlying implementations.
void TransportProxy::SetupMux(TransportProxy* proxy) {
  size_t index = 0;
  // Copy the channels from proxy 1:1 onto us.
  for (ChannelMap::const_iterator iter = proxy->channels().begin();
       iter != proxy->channels().end(); ++iter, ++index) {
    ReplaceImpl(iter->second, index);
  }
  // Now replace our transport. Must happen afterwards because
  // it deletes all impls as a side effect.
  transport_ = proxy->transport_;
}

// Mux the channel at |this->channels_[index]| (also known as
// |target_channel| onto |channel|. The new implementation (actually
// a ref-count-increased version of what's in |channel->impl| is
// obtained by calling CreateChannel on |channel|'s Transport object.
void TransportProxy::ReplaceImpl(TransportChannelProxy* channel,
                                 size_t index) {
  if (index < channels().size()) {
    ChannelMap::const_iterator iter = channels().begin();
    // map::iterator does not allow random access
    for (size_t i = 0; i < index; ++i, ++iter);

    TransportChannelProxy* target_channel = iter->second;
    if (target_channel) {
      // Reset the implementation on the target_channel
      target_channel->SetImplementation(
        // Increments ref count
        channel->impl()->GetTransport()->CreateChannel(channel->name(),
          channel->content_type()));
    }
  } else {
    LOG(LS_WARNING) << "invalid TransportChannelProxy index to replace";
  }
}

std::string BaseSession::StateToString(State state) {
  switch (state) {
    case Session::STATE_INIT:
      return "STATE_INIT";
    case Session::STATE_SENTINITIATE:
      return "STATE_SENTINITIATE";
    case Session::STATE_RECEIVEDINITIATE:
      return "STATE_RECEIVEDINITIATE";
    case Session::STATE_SENTACCEPT:
      return "STATE_SENTACCEPT";
    case Session::STATE_RECEIVEDACCEPT:
      return "STATE_RECEIVEDACCEPT";
    case Session::STATE_SENTMODIFY:
      return "STATE_SENTMODIFY";
    case Session::STATE_RECEIVEDMODIFY:
      return "STATE_RECEIVEDMODIFY";
    case Session::STATE_SENTREJECT:
      return "STATE_SENTREJECT";
    case Session::STATE_RECEIVEDREJECT:
      return "STATE_RECEIVEDREJECT";
    case Session::STATE_SENTREDIRECT:
      return "STATE_SENTREDIRECT";
    case Session::STATE_SENTTERMINATE:
      return "STATE_SENTTERMINATE";
    case Session::STATE_RECEIVEDTERMINATE:
      return "STATE_RECEIVEDTERMINATE";
    case Session::STATE_INPROGRESS:
      return "STATE_INPROGRESS";
    case Session::STATE_DEINIT:
      return "STATE_DEINIT";
    default:
      break;
  }
  return "STATE_" + talk_base::ToString(state);
}

BaseSession::BaseSession(talk_base::Thread* signaling_thread,
                         talk_base::Thread* worker_thread,
                         PortAllocator* port_allocator,
                         const std::string& sid,
                         const std::string& content_type,
                         bool initiator)
    : state_(STATE_INIT),
      error_(ERROR_NONE),
      signaling_thread_(signaling_thread),
      worker_thread_(worker_thread),
      port_allocator_(port_allocator),
      sid_(sid),
      content_type_(content_type),
      transport_type_(NS_GINGLE_P2P),
      initiator_(initiator),
      local_description_(NULL),
      remote_description_(NULL) {
  ASSERT(signaling_thread->IsCurrent());
}

BaseSession::~BaseSession() {
  ASSERT(signaling_thread()->IsCurrent());

  ASSERT(state_ != STATE_DEINIT);
  LogState(state_, STATE_DEINIT);
  state_ = STATE_DEINIT;
  SignalState(this, state_);

  for (TransportMap::iterator iter = transports_.begin();
       iter != transports_.end(); ++iter) {
    delete iter->second;
  }

  delete remote_description_;
  delete local_description_;
}

void BaseSession::set_allow_local_ips(bool allow) {
  allow_local_ips_ = allow;
  for (TransportMap::iterator iter = transports_.begin();
       iter != transports_.end(); ++iter) {
    iter->second->impl()->set_allow_local_ips(allow);
  }
}

TransportChannel* BaseSession::CreateChannel(const std::string& content_name,
                                             const std::string& channel_name) {
  // We create the proxy "on demand" here because we need to support
  // creating channels at any time, even before we send or receive
  // initiate messages, which is before we create the transports.
  TransportProxy* transproxy = GetOrCreateTransportProxy(content_name);
  return transproxy->CreateChannel(channel_name, content_type_);
}

TransportChannel* BaseSession::GetChannel(const std::string& content_name,
                                          const std::string& channel_name) {
  TransportProxy* transproxy = GetTransportProxy(content_name);
  if (transproxy == NULL)
    return NULL;
  else
    return transproxy->GetChannel(channel_name);
}

void BaseSession::DestroyChannel(const std::string& content_name,
                                 const std::string& channel_name) {
  TransportProxy* transproxy = GetTransportProxy(content_name);
  ASSERT(transproxy != NULL);
  transproxy->DestroyChannel(channel_name);
}

TransportProxy* BaseSession::GetOrCreateTransportProxy(
    const std::string& content_name) {
  TransportProxy* transproxy = GetTransportProxy(content_name);
  if (transproxy)
    return transproxy;

  Transport* transport = CreateTransport();
  transport->set_allow_local_ips(allow_local_ips_);
  transport->SignalConnecting.connect(
      this, &BaseSession::OnTransportConnecting);
  transport->SignalWritableState.connect(
      this, &BaseSession::OnTransportWritable);
  transport->SignalRequestSignaling.connect(
      this, &BaseSession::OnTransportRequestSignaling);
  transport->SignalCandidatesReady.connect(
      this, &BaseSession::OnTransportCandidatesReady);
  transport->SignalTransportError.connect(
      this, &BaseSession::OnTransportSendError);
  transport->SignalRouteChange.connect(
      this, &BaseSession::OnTransportRouteChange);
  transport->SignalCandidatesAllocationDone.connect(
      this, &BaseSession::OnTransportCandidatesAllocationDone);

  transproxy = new TransportProxy(sid_, content_name,
                                  new TransportWrapper(transport));
  transports_[content_name] = transproxy;

  return transproxy;
}

Transport* BaseSession::GetTransport(const std::string& content_name) {
  TransportProxy* transproxy = GetTransportProxy(content_name);
  if (transproxy == NULL)
    return NULL;
  return transproxy->impl();
}

TransportProxy* BaseSession::GetTransportProxy(
    const std::string& content_name) {
  TransportMap::iterator iter = transports_.find(content_name);
  return (iter != transports_.end()) ? iter->second : NULL;
}

TransportProxy* BaseSession::GetTransportProxy(const Transport* transport) {
  for (TransportMap::iterator iter = transports_.begin();
       iter != transports_.end(); ++iter) {
    TransportProxy* transproxy = iter->second;
    if (transproxy->impl() == transport) {
      return transproxy;
    }
  }
  return NULL;
}

TransportProxy* BaseSession::GetFirstTransportProxy() {
  if (transports_.empty())
    return NULL;
  return transports_.begin()->second;
}

void BaseSession::DestroyTransportProxy(
    const std::string& content_name) {
  TransportMap::iterator iter = transports_.find(content_name);
  if (iter != transports_.end()) {
    delete iter->second;
    transports_.erase(content_name);
  }
}

cricket::Transport* BaseSession::CreateTransport() {
  ASSERT(transport_type_ == NS_GINGLE_P2P);
  return new cricket::DtlsTransport<P2PTransport>(
      signaling_thread(), worker_thread(), port_allocator());
}

void BaseSession::SetState(State state) {
  ASSERT(signaling_thread_->IsCurrent());
  if (state != state_) {
    LogState(state_, state);
    state_ = state;
    SignalState(this, state_);
    signaling_thread_->Post(this, MSG_STATE);
  }
}

void BaseSession::SetError(Error error) {
  ASSERT(signaling_thread_->IsCurrent());
  if (error != error_) {
    error_ = error;
    SignalError(this, error);
  }
}

void BaseSession::OnSignalingReady() {
  ASSERT(signaling_thread()->IsCurrent());
  for (TransportMap::iterator iter = transports_.begin();
       iter != transports_.end(); ++iter) {
    iter->second->impl()->OnSignalingReady();
  }
}

void BaseSession::SpeculativelyConnectAllTransportChannels() {
  for (TransportMap::iterator iter = transports_.begin();
       iter != transports_.end(); ++iter) {
    iter->second->SpeculativelyConnectChannels();
  }
}

bool BaseSession::ContentsGrouped() {
  // TODO - present implementation checks for groups present
  // in SDP. It may be necessary to check content_names in groups of both
  // local and remote descriptions. Assumption here is that when this method
  // returns true, media contents can be muxed.
  if (local_description()->HasGroup(GROUP_TYPE_BUNDLE) &&
      remote_description()->HasGroup(GROUP_TYPE_BUNDLE)) {
    return true;
  }
  return false;
}

bool BaseSession::MaybeEnableMuxingSupport() {
  bool ret = true;
  if (!ContentsGrouped()) {
    LOG(LS_INFO) << "Contents are not grouped together cannot be muxed";
  } else {
    // Always use first content name from the group for muxing. Hence ordering
    // of content names in SDP should match to the order in group.
    const ContentGroup* muxed_content_group =
        local_description()->GetGroupByName(GROUP_TYPE_BUNDLE);
    const std::string* content_name =
        muxed_content_group->FirstContentName();
    if (content_name) {
      const ContentInfo* content =
          local_description_->GetContentByName(*content_name);
      ASSERT(content != NULL);
      SetSelectedProxy(content->name, muxed_content_group);
    }
  }
  return ret;
}

void BaseSession::SetSelectedProxy(const std::string& content_name,
                                   const ContentGroup* muxed_group) {
  TransportProxy* selected_proxy = GetTransportProxy(content_name);
  if (selected_proxy) {
    ASSERT(selected_proxy->negotiated());
    for (TransportMap::iterator iter = transports_.begin();
         iter != transports_.end(); ++iter) {
      // If content is part of group, then try to replace the Proxy with
      // the selected.
      if (iter->first != content_name &&
          muxed_group->HasContentName(iter->first)) {
        TransportProxy* proxy = iter->second;
        proxy->SetupMux(selected_proxy);
      }
    }
  }
}

void BaseSession::OnTransportCandidatesAllocationDone(Transport* transport) {
  TransportProxy* transport_proxy = GetTransportProxy(transport);
  if (transport_proxy) {
    transport_proxy->set_candidates_allocated(true);
  }

  // Check all other TransportProxies got this signal.
  for (TransportMap::iterator iter = transports_.begin();
         iter != transports_.end(); ++iter) {
    if (iter->second->impl() == transport) {
      if (!iter->second->candidates_allocated())
        return;
    }
  }
  OnCandidatesAllocationDone();
}

void BaseSession::LogState(State old_state, State new_state) {
  LOG(LS_INFO) << "Session:" << id()
               << " Old state:" << StateToString(old_state)
               << " New state:" << StateToString(new_state)
               << " Type:" << content_type()
               << " Transport:" << transport_type();
}

void BaseSession::OnMessage(talk_base::Message *pmsg) {
  switch (pmsg->message_id) {
  case MSG_TIMEOUT:
    // Session timeout has occured.
    SetError(ERROR_TIME);
    break;

  case MSG_STATE:
    switch (state_) {
    case STATE_SENTACCEPT:
    case STATE_RECEIVEDACCEPT:
      SetState(STATE_INPROGRESS);
      break;

    default:
      // Explicitly ignoring some states here.
      break;
    }
    break;
  }
}

Session::Session(SessionManager* session_manager,
                 const std::string& local_name,
                 const std::string& initiator_name,
                 const std::string& sid,
                 const std::string& content_type,
                 SessionClient* client)
    : BaseSession(session_manager->signaling_thread(),
                  session_manager->worker_thread(),
                  session_manager->port_allocator(),
                  sid, content_type, initiator_name == local_name) {
  ASSERT(client != NULL);
  session_manager_ = session_manager;
  local_name_ = local_name;
  initiator_name_ = initiator_name;
  transport_parser_ = new P2PTransportParser();
  client_ = client;
  initiate_acked_ = false;
  current_protocol_ = PROTOCOL_HYBRID;
}

Session::~Session() {
  delete transport_parser_;
}

bool Session::Initiate(const std::string &to,
                       const SessionDescription* sdesc) {
  ASSERT(signaling_thread()->IsCurrent());
  SessionError error;

  // Only from STATE_INIT
  if (state() != STATE_INIT)
    return false;

  // Setup for signaling.
  set_remote_name(to);
  set_local_description(sdesc);
  if (!CreateTransportProxies(GetEmptyTransportInfos(sdesc->contents()),
                              &error)) {
    LOG(LS_ERROR) << "Could not create transports: " << error.text;
    return false;
  }

  if (!SendInitiateMessage(sdesc, &error)) {
    LOG(LS_ERROR) << "Could not send initiate message: " << error.text;
    return false;
  }

  SetState(Session::STATE_SENTINITIATE);

  SpeculativelyConnectAllTransportChannels();
  return true;
}

bool Session::Accept(const SessionDescription* sdesc) {
  ASSERT(signaling_thread()->IsCurrent());

  // Only if just received initiate
  if (state() != STATE_RECEIVEDINITIATE)
    return false;

  // Setup for signaling.
  set_local_description(sdesc);

  SessionError error;
  if (!SendAcceptMessage(sdesc, &error)) {
    LOG(LS_ERROR) << "Could not send accept message: " << error.text;
    return false;
  }
  // TODO - Add BUNDLE support to transport-info messages.
  MaybeEnableMuxingSupport();  // Enable transport channel mux if supported.
  SetState(Session::STATE_SENTACCEPT);
  return true;
}

bool Session::Reject(const std::string& reason) {
  ASSERT(signaling_thread()->IsCurrent());

  // Reject is sent in response to an initiate or modify, to reject the
  // request
  if (state() != STATE_RECEIVEDINITIATE && state() != STATE_RECEIVEDMODIFY)
    return false;

  SessionError error;
  if (!SendRejectMessage(reason, &error)) {
    LOG(LS_ERROR) << "Could not send reject message: " << error.text;
    return false;
  }

  SetState(STATE_SENTREJECT);
  return true;
}

bool Session::TerminateWithReason(const std::string& reason) {
  ASSERT(signaling_thread()->IsCurrent());

  // Either side can terminate, at any time.
  switch (state()) {
    case STATE_SENTTERMINATE:
    case STATE_RECEIVEDTERMINATE:
      return false;

    case STATE_SENTREJECT:
    case STATE_RECEIVEDREJECT:
      // We don't need to send terminate if we sent or received a reject...
      // it's implicit.
      break;

    default:
      SessionError error;
      if (!SendTerminateMessage(reason, &error)) {
        LOG(LS_ERROR) << "Could not send terminate message: " << error.text;
        return false;
      }
      break;
  }

  SetState(STATE_SENTTERMINATE);
  return true;
}

bool Session::SendInfoMessage(const XmlElements& elems) {
  ASSERT(signaling_thread()->IsCurrent());
  SessionError error;
  if (!SendMessage(ACTION_SESSION_INFO, elems, &error)) {
    LOG(LS_ERROR) << "Could not send info message " << error.text;
    return false;
  }
  return true;
}

bool Session::SendDescriptionInfoMessage(const ContentInfos& contents) {
  XmlElements elems;
  WriteError write_error;
  if (!WriteDescriptionInfo(current_protocol_,
                            contents,
                            GetContentParsers(),
                            &elems, &write_error)) {
    LOG(LS_ERROR) << "Could not write description info message: "
                  << write_error.text;
    return false;
  }
  SessionError error;
  if (!SendMessage(ACTION_DESCRIPTION_INFO, elems, &error)) {
    LOG(LS_ERROR) << "Could not send description info message: "
                  << error.text;
    return false;
  }
  return true;
}

TransportInfos Session::GetEmptyTransportInfos(
    const ContentInfos& contents) const {
  TransportInfos tinfos;
  for (ContentInfos::const_iterator content = contents.begin();
       content != contents.end(); ++content) {
    tinfos.push_back(
        TransportInfo(content->name, transport_type(), Candidates()));
  }
  return tinfos;
}

bool Session::OnRemoteCandidates(
    const TransportInfos& tinfos, ParseError* error) {
  for (TransportInfos::const_iterator tinfo = tinfos.begin();
       tinfo != tinfos.end(); ++tinfo) {
    TransportProxy* transproxy = GetTransportProxy(tinfo->content_name);
    if (transproxy == NULL) {
      return BadParse("Unknown content name: " + tinfo->content_name, error);
    }

    // Must complete negotiation before sending remote candidates, or
    // there won't be any channel impls.
    transproxy->CompleteNegotiation();
    for (Candidates::const_iterator cand = tinfo->candidates.begin();
         cand != tinfo->candidates.end(); ++cand) {
      if (!transproxy->impl()->VerifyCandidate(*cand, error))
        return false;

      if (!transproxy->impl()->HasChannel(cand->name())) {
        buzz::XmlElement* extra_info =
            new buzz::XmlElement(QN_GINGLE_P2P_UNKNOWN_CHANNEL_NAME);
        extra_info->AddAttr(buzz::QN_NAME, cand->name());
        error->extra = extra_info;

        return BadParse("channel named in candidate does not exist: " +
                        cand->name() + " for content: "+ tinfo->content_name,
                        error);
      }
    }
    transproxy->impl()->OnRemoteCandidates(tinfo->candidates);
  }

  return true;
}

bool Session::CreateTransportProxies(const TransportInfos& tinfos,
                                     SessionError* error) {
  for (TransportInfos::const_iterator tinfo = tinfos.begin();
       tinfo != tinfos.end(); ++tinfo) {
    if (tinfo->transport_type != transport_type()) {
      error->SetText("No supported transport in offer.");
      return false;
    }

    GetOrCreateTransportProxy(tinfo->content_name);
  }
  return true;
}

TransportParserMap Session::GetTransportParsers() {
  TransportParserMap parsers;
  parsers[transport_type()] = transport_parser_;
  return parsers;
}

ContentParserMap Session::GetContentParsers() {
  ContentParserMap parsers;
  parsers[content_type()] = client_;
  return parsers;
}

void Session::OnTransportRequestSignaling(Transport* transport) {
  ASSERT(signaling_thread()->IsCurrent());
  TransportProxy* transport_proxy = GetTransportProxy(transport);
  ASSERT(transport_proxy != NULL);
  if (transport_proxy) {
    // Reset candidate allocation status for the transport proxy.
    transport_proxy->set_candidates_allocated(false);
  }
  SignalRequestSignaling(this);
}

void Session::OnTransportConnecting(Transport* transport) {
  // This is an indication that we should begin watching the writability
  // state of the transport.
  OnTransportWritable(transport);
}

void Session::OnTransportWritable(Transport* transport) {
  ASSERT(signaling_thread()->IsCurrent());

  // If the transport is not writable, start a timer to make sure that it
  // becomes writable within a reasonable amount of time.  If it does not, we
  // terminate since we can't actually send data.  If the transport is writable,
  // cancel the timer.  Note that writability transitions may occur repeatedly
  // during the lifetime of the session.
  signaling_thread()->Clear(this, MSG_TIMEOUT);
  if (transport->HasChannels() && !transport->writable()) {
    signaling_thread()->PostDelayed(
        session_manager_->session_timeout() * 1000, this, MSG_TIMEOUT);
  }
}

void Session::OnTransportCandidatesReady(Transport* transport,
                                         const Candidates& candidates) {
  ASSERT(signaling_thread()->IsCurrent());
  TransportProxy* transproxy = GetTransportProxy(transport);
  if (transproxy != NULL) {
    if (initiator() && !initiate_acked_) {
      // TODO: This is to work around server re-ordering
      // messages.  We send the candidates once the session-initiate
      // is acked.  Once we have fixed the server to guarantee message
      // order, we can remove this case.
      transproxy->AddUnsentCandidates(candidates);
    } else {
      if (!transproxy->negotiated()) {
        transproxy->AddSentCandidates(candidates);
      }
      SessionError error;
      if (!SendTransportInfoMessage(transproxy, candidates, &error)) {
        LOG(LS_ERROR) << "Could not send transport info message: "
                      << error.text;
        return;
      }
    }
  }
}

void Session::OnTransportSendError(Transport* transport,
                                   const buzz::XmlElement* stanza,
                                   const buzz::QName& name,
                                   const std::string& type,
                                   const std::string& text,
                                   const buzz::XmlElement* extra_info) {
  ASSERT(signaling_thread()->IsCurrent());
  SignalErrorMessage(this, stanza, name, type, text, extra_info);
}

void Session::OnIncomingMessage(const SessionMessage& msg) {
  ASSERT(signaling_thread()->IsCurrent());
  ASSERT(state() == STATE_INIT || msg.from == remote_name());

  if (current_protocol_== PROTOCOL_HYBRID) {
    if (msg.protocol == PROTOCOL_GINGLE) {
      current_protocol_ = PROTOCOL_GINGLE;
    } else {
      current_protocol_ = PROTOCOL_JINGLE;
    }
  }

  bool valid = false;
  MessageError error;
  switch (msg.type) {
    case ACTION_SESSION_INITIATE:
      valid = OnInitiateMessage(msg, &error);
      break;
    case ACTION_SESSION_INFO:
      valid = OnInfoMessage(msg);
      break;
    case ACTION_SESSION_ACCEPT:
      valid = OnAcceptMessage(msg, &error);
      break;
    case ACTION_SESSION_REJECT:
      valid = OnRejectMessage(msg, &error);
      break;
    case ACTION_SESSION_TERMINATE:
      valid = OnTerminateMessage(msg, &error);
      break;
    case ACTION_TRANSPORT_INFO:
      valid = OnTransportInfoMessage(msg, &error);
      break;
    case ACTION_TRANSPORT_ACCEPT:
      valid = OnTransportAcceptMessage(msg, &error);
      break;
    case ACTION_DESCRIPTION_INFO:
      valid = OnDescriptionInfoMessage(msg, &error);
      break;
    default:
      valid = BadMessage(buzz::QN_STANZA_BAD_REQUEST,
                         "unknown session message type",
                         &error);
  }

  if (valid) {
    SendAcknowledgementMessage(msg.stanza);
  } else {
    SignalErrorMessage(this, msg.stanza, error.type,
                       "modify", error.text, NULL);
  }
}

void Session::OnIncomingResponse(const buzz::XmlElement* orig_stanza,
                                 const buzz::XmlElement* response_stanza,
                                 const SessionMessage& msg) {
  ASSERT(signaling_thread()->IsCurrent());

  if (msg.type == ACTION_SESSION_INITIATE) {
    OnInitiateAcked();
  }
}

void Session::OnInitiateAcked() {
    // TODO: This is to work around server re-ordering
    // messages.  We send the candidates once the session-initiate
    // is acked.  Once we have fixed the server to guarantee message
    // order, we can remove this case.
  if (!initiate_acked_) {
    initiate_acked_ = true;
    SessionError error;
    SendAllUnsentTransportInfoMessages(&error);
  }
}

void Session::OnFailedSend(const buzz::XmlElement* orig_stanza,
                           const buzz::XmlElement* error_stanza) {
  ASSERT(signaling_thread()->IsCurrent());

  SessionMessage msg;
  ParseError parse_error;
  if (!ParseSessionMessage(orig_stanza, &msg, &parse_error)) {
    LOG(LS_ERROR) << "Error parsing failed send: " << parse_error.text
                  << ":" << orig_stanza;
    return;
  }

  // If the error is a session redirect, call OnRedirectError, which will
  // continue the session with a new remote JID.
  SessionRedirect redirect;
  if (FindSessionRedirect(error_stanza, &redirect)) {
    SessionError error;
    if (!OnRedirectError(redirect, &error)) {
      // TODO: Should we send a message back?  The standard
      // says nothing about it.
      LOG(LS_ERROR) << "Failed to redirect: " << error.text;
      SetError(ERROR_RESPONSE);
    }
    return;
  }

  std::string error_type = "cancel";

  const buzz::XmlElement* error = error_stanza->FirstNamed(buzz::QN_ERROR);
  if (error) {
    error_type = error->Attr(buzz::QN_TYPE);

    LOG(LS_ERROR) << "Session error:\n" << error->Str() << "\n"
                  << "in response to:\n" << orig_stanza->Str();
  } else {
    // don't crash if <error> is missing
    LOG(LS_ERROR) << "Session error without <error/> element, ignoring";
    return;
  }

  if (msg.type == ACTION_TRANSPORT_INFO) {
    // Transport messages frequently generate errors because they are sent right
    // when we detect a network failure.  For that reason, we ignore such
    // errors, because if we do not establish writability again, we will
    // terminate anyway.  The exceptions are transport-specific error tags,
    // which we pass on to the respective transport.

    // TODO: This is only used for unknown channel name.
    // For Jingle, find a standard-compliant way of doing this.  For
    // Gingle, guess the content name based on the channel name.
    for (const buzz::XmlElement* elem = error->FirstElement();
         NULL != elem; elem = elem->NextElement()) {
      TransportProxy* transproxy = GetFirstTransportProxy();
      if (transproxy && transproxy->type() == error->Name().Namespace()) {
        transproxy->impl()->OnTransportError(elem);
      }
    }
  } else if ((error_type != "continue") && (error_type != "wait")) {
    // We do not set an error if the other side said it is okay to continue
    // (possibly after waiting).  These errors can be ignored.
    SetError(ERROR_RESPONSE);
  }
}

bool Session::OnInitiateMessage(const SessionMessage& msg,
                                MessageError* error) {
  if (!CheckState(STATE_INIT, error))
    return false;

  SessionInitiate init;
  if (!ParseSessionInitiate(msg.protocol, msg.action_elem,
                            GetContentParsers(), GetTransportParsers(),
                            &init, error))
    return false;

  SessionError session_error;
  if (!CreateTransportProxies(init.transports, &session_error)) {
    return BadMessage(buzz::QN_STANZA_NOT_ACCEPTABLE,
                      session_error.text, error);
  }

  set_remote_name(msg.from);
  set_remote_description(new SessionDescription(init.ClearContents(),
                                                init.groups));
  SetState(STATE_RECEIVEDINITIATE);

  // Users of Session may listen to state change and call Reject().
  if (state() != STATE_SENTREJECT) {
    if (!OnRemoteCandidates(init.transports, error))
      return false;
  }
  return true;
}

bool Session::OnAcceptMessage(const SessionMessage& msg, MessageError* error) {
  if (!CheckState(STATE_SENTINITIATE, error))
    return false;

  SessionAccept accept;
  if (!ParseSessionAccept(msg.protocol, msg.action_elem,
                          GetContentParsers(), GetTransportParsers(),
                          &accept, error)) {
    return false;
  }

  // If we get an accept, we can assume the initiate has been
  // received, even if we haven't gotten an IQ response.
  OnInitiateAcked();

  set_remote_description(new SessionDescription(accept.ClearContents(),
                                                accept.groups));
  MaybeEnableMuxingSupport();  // Enable transport channel mux if supported.
  SetState(STATE_RECEIVEDACCEPT);

  // Users of Session may listen to state change and call Reject().
  if (state() != STATE_SENTREJECT) {
    if (!OnRemoteCandidates(accept.transports, error))
      return false;
  }

  return true;
}

bool Session::OnRejectMessage(const SessionMessage& msg, MessageError* error) {
  if (!CheckState(STATE_SENTINITIATE, error))
    return false;

  SetState(STATE_RECEIVEDREJECT);
  return true;
}

bool Session::OnInfoMessage(const SessionMessage& msg) {
  SignalInfoMessage(this, msg.action_elem);
  return true;
}

bool Session::OnTerminateMessage(const SessionMessage& msg,
                                 MessageError* error) {
  SessionTerminate term;
  if (!ParseSessionTerminate(msg.protocol, msg.action_elem, &term, error))
    return false;

  SignalReceivedTerminateReason(this, term.reason);
  if (term.debug_reason != buzz::STR_EMPTY) {
    LOG(LS_VERBOSE) << "Received error on call: " << term.debug_reason;
  }

  SetState(STATE_RECEIVEDTERMINATE);
  return true;
}

bool Session::OnTransportInfoMessage(const SessionMessage& msg,
                                     MessageError* error) {
  TransportInfos tinfos;
  if (!ParseTransportInfos(msg.protocol, msg.action_elem,
                           initiator_description()->contents(),
                           GetTransportParsers(), &tinfos, error))
    return false;

  if (!OnRemoteCandidates(tinfos, error))
    return false;

  return true;
}

bool Session::OnTransportAcceptMessage(const SessionMessage& msg,
                                       MessageError* error) {
  // TODO: Currently here only for compatibility with
  // Gingle 1.1 clients (notably, Google Voice).
  return true;
}

bool Session::OnDescriptionInfoMessage(const SessionMessage& msg,
                              MessageError* error) {
  if (!CheckState(STATE_INPROGRESS, error))
    return false;

  DescriptionInfo description_info;
  if (!ParseDescriptionInfo(msg.protocol, msg.action_elem,
                            GetContentParsers(), GetTransportParsers(),
                            &description_info, error)) {
    return false;
  }

  ContentInfos updated_contents = description_info.ClearContents();

  // TODO: Currently, reflector sends back
  // video stream updates even for an audio-only call, which causes
  // this to fail.  Put this back once reflector is fixed.
  //
  // ContentInfos::iterator it;
  // First, ensure all updates are valid before modifying remote_description_.
  // for (it = updated_contents.begin(); it != updated_contents.end(); ++it) {
  //   if (remote_description()->GetContentByName(it->name) == NULL) {
  //     return false;
  //   }
  // }

  // TODO: We used to replace contents from an update, but
  // that no longer works with partial updates.  We need to figure out
  // a way to merge patial updates into contents.  For now, users of
  // Session should listen to SignalRemoteDescriptionUpdate and handle
  // updates.  They should not expect remote_description to be the
  // latest value.
  //
  // for (it = updated_contents.begin(); it != updated_contents.end(); ++it) {
  //     remote_description()->RemoveContentByName(it->name);
  //     remote_description()->AddContent(it->name, it->type, it->description);
  //   }
  // }

  SignalRemoteDescriptionUpdate(this, updated_contents);
  return true;
}

bool BareJidsEqual(const std::string& name1,
                   const std::string& name2) {
  buzz::Jid jid1(name1);
  buzz::Jid jid2(name2);

  return jid1.IsValid() && jid2.IsValid() && jid1.BareEquals(jid2);
}

bool Session::OnRedirectError(const SessionRedirect& redirect,
                              SessionError* error) {
  MessageError message_error;
  if (!CheckState(STATE_SENTINITIATE, &message_error)) {
    return BadWrite(message_error.text, error);
  }

  if (!BareJidsEqual(remote_name(), redirect.target))
    return BadWrite("Redirection not allowed: must be the same bare jid.",
                    error);

  // When we receive a redirect, we point the session at the new JID
  // and resend the candidates.
  set_remote_name(redirect.target);
  return (SendInitiateMessage(local_description(), error) &&
          ResendAllTransportInfoMessages(error));
}

bool Session::CheckState(State expected, MessageError* error) {
  ASSERT(state() == expected);
  if (state() != expected) {
    return BadMessage(buzz::QN_STANZA_NOT_ALLOWED,
                      "message not allowed in current state",
                      error);
  }
  return true;
}

void Session::SetError(Error error) {
  BaseSession::SetError(error);
  if (error != ERROR_NONE)
    signaling_thread()->Post(this, MSG_ERROR);
}

void Session::OnMessage(talk_base::Message* pmsg) {
  // preserve this because BaseSession::OnMessage may modify it
  State orig_state = state();

  BaseSession::OnMessage(pmsg);

  switch (pmsg->message_id) {
  case MSG_ERROR:
    TerminateWithReason(STR_TERMINATE_ERROR);
    break;

  case MSG_STATE:
    switch (orig_state) {
    case STATE_SENTREJECT:
    case STATE_RECEIVEDREJECT:
      // Assume clean termination.
      Terminate();
      break;

    case STATE_SENTTERMINATE:
    case STATE_RECEIVEDTERMINATE:
      session_manager_->DestroySession(this);
      break;

    default:
      // Explicitly ignoring some states here.
      break;
    }
    break;
  }
}

bool Session::SendInitiateMessage(const SessionDescription* sdesc,
                                  SessionError* error) {
  SessionInitiate init;
  init.contents = sdesc->contents();
  init.transports = GetEmptyTransportInfos(init.contents);
  init.groups = sdesc->groups();
  return SendMessage(ACTION_SESSION_INITIATE, init, error);
}

bool Session::WriteSessionAction(
    SignalingProtocol protocol, const SessionInitiate& init,
    XmlElements* elems, WriteError* error) {
  ContentParserMap content_parsers = GetContentParsers();
  TransportParserMap trans_parsers = GetTransportParsers();

  return WriteSessionInitiate(protocol, init.contents, init.transports,
                              content_parsers, trans_parsers, init.groups,
                              elems, error);
}

bool Session::SendAcceptMessage(const SessionDescription* sdesc,
                                SessionError* error) {
  XmlElements elems;
  if (!WriteSessionAccept(current_protocol_,
                          sdesc->contents(),
                          GetEmptyTransportInfos(sdesc->contents()),
                          GetContentParsers(), GetTransportParsers(),
                          sdesc->groups(), &elems, error)) {
    return false;
  }
  return SendMessage(ACTION_SESSION_ACCEPT, elems, error);
}

bool Session::SendRejectMessage(const std::string& reason,
                                SessionError* error) {
  SessionTerminate term(reason);
  return SendMessage(ACTION_SESSION_REJECT, term, error);
}

bool Session::SendTerminateMessage(const std::string& reason,
                                   SessionError* error) {
  SessionTerminate term(reason);
  return SendMessage(ACTION_SESSION_TERMINATE, term, error);
}

bool Session::WriteSessionAction(SignalingProtocol protocol,
                                 const SessionTerminate& term,
                                 XmlElements* elems, WriteError* error) {
  WriteSessionTerminate(protocol, term, elems);
  return true;
}

bool Session::SendTransportInfoMessage(const TransportInfo& tinfo,
                                       SessionError* error) {
  return SendMessage(ACTION_TRANSPORT_INFO, tinfo, error);
}

bool Session::SendTransportInfoMessage(const TransportProxy* transproxy,
                                       const Candidates& candidates,
                                       SessionError* error) {
  return SendTransportInfoMessage(TransportInfo(transproxy->content_name(),
                                                transproxy->type(),
                                                candidates),
                                  error);
}

bool Session::WriteSessionAction(SignalingProtocol protocol,
                                 const TransportInfo& tinfo,
                                 XmlElements* elems, WriteError* error) {
  TransportInfos tinfos;
  tinfos.push_back(tinfo);
  TransportParserMap parsers = GetTransportParsers();

  return WriteTransportInfos(protocol, tinfos, parsers,
                             elems, error);
}

bool Session::ResendAllTransportInfoMessages(SessionError* error) {
  for (TransportMap::const_iterator iter = transport_proxies().begin();
       iter != transport_proxies().end(); ++iter) {
    TransportProxy* transproxy = iter->second;
    if (transproxy->sent_candidates().size() > 0) {
      if (!SendTransportInfoMessage(
              transproxy, transproxy->sent_candidates(), error)) {
        LOG(LS_ERROR) << "Could not resend transport info messages: "
                      << error->text;
        return false;
      }
      transproxy->ClearSentCandidates();
    }
  }
  return true;
}

bool Session::SendAllUnsentTransportInfoMessages(SessionError* error) {
  for (TransportMap::const_iterator iter = transport_proxies().begin();
       iter != transport_proxies().end(); ++iter) {
    TransportProxy* transproxy = iter->second;
    if (transproxy->unsent_candidates().size() > 0) {
      if (!SendTransportInfoMessage(
              transproxy, transproxy->unsent_candidates(), error)) {
        LOG(LS_ERROR) << "Could not send unsent transport info messages: "
                      << error->text;
        return false;
      }
      transproxy->ClearUnsentCandidates();
    }
  }
  return true;
}

bool Session::SendMessage(ActionType type, const XmlElements& action_elems,
                          SessionError* error) {
  talk_base::scoped_ptr<buzz::XmlElement> stanza(
      new buzz::XmlElement(buzz::QN_IQ));

  SessionMessage msg(current_protocol_, type, id(), initiator_name());
  msg.to = remote_name();
  WriteSessionMessage(msg, action_elems, stanza.get());

  SignalOutgoingMessage(this, stanza.get());
  return true;
}

template <typename Action>
bool Session::SendMessage(ActionType type, const Action& action,
                          SessionError* error) {
  talk_base::scoped_ptr<buzz::XmlElement> stanza(
      new buzz::XmlElement(buzz::QN_IQ));
  if (!WriteActionMessage(type, action, stanza.get(), error))
    return false;

  SignalOutgoingMessage(this, stanza.get());
  return true;
}

template <typename Action>
bool Session::WriteActionMessage(ActionType type, const Action& action,
                                 buzz::XmlElement* stanza,
                                 WriteError* error) {
  if (current_protocol_ == PROTOCOL_HYBRID) {
    if (!WriteActionMessage(PROTOCOL_JINGLE, type, action, stanza, error))
      return false;
    if (!WriteActionMessage(PROTOCOL_GINGLE, type, action, stanza, error))
      return false;
  } else {
    if (!WriteActionMessage(current_protocol_, type, action, stanza, error))
      return false;
  }
  return true;
}

template <typename Action>
bool Session::WriteActionMessage(SignalingProtocol protocol,
                                 ActionType type, const Action& action,
                                 buzz::XmlElement* stanza, WriteError* error) {
  XmlElements action_elems;
  if (!WriteSessionAction(protocol, action, &action_elems, error))
    return false;

  SessionMessage msg(protocol, type, id(), initiator_name());
  msg.to = remote_name();

  WriteSessionMessage(msg, action_elems, stanza);
  return true;
}

void Session::SendAcknowledgementMessage(const buzz::XmlElement* stanza) {
  talk_base::scoped_ptr<buzz::XmlElement> ack(
      new buzz::XmlElement(buzz::QN_IQ));
  ack->SetAttr(buzz::QN_TO, remote_name());
  ack->SetAttr(buzz::QN_ID, stanza->Attr(buzz::QN_ID));
  ack->SetAttr(buzz::QN_TYPE, "result");

  SignalOutgoingMessage(this, ack.get());
}

}  // namespace cricket
