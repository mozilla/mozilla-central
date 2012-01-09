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

#include "talk/base/natsocketfactory.h"

#include "talk/base/logging.h"
#include "talk/base/natserver.h"
#include "talk/base/virtualsocketserver.h"

namespace talk_base {

// NATSocket
class NATSocket : public AsyncSocket, public sigslot::has_slots<> {
 public:
  explicit NATSocket(NATInternalSocketFactory* sf, int type)
      : sf_(sf), type_(type), async_(true), connected_(false),
        socket_(NULL), buf_(NULL), size_(0) {
  }

  virtual ~NATSocket() {
    delete socket_;
    delete[] buf_;
  }

  virtual SocketAddress GetLocalAddress() const {
    return (socket_) ? socket_->GetLocalAddress() : SocketAddress();
  }

  virtual SocketAddress GetRemoteAddress() const {
    return remote_addr_;  // will be ANY if not connected
  }

  virtual int Bind(const SocketAddress& addr) {
    if (socket_) {  // already bound, bubble up error
      return -1;
    }

    int result;
    socket_ = sf_->CreateInternalSocket(type_, addr, &server_addr_);
    result = (socket_) ? socket_->Bind(addr) : -1;
    if (result >= 0) {
      socket_->SignalConnectEvent.connect(this, &NATSocket::OnConnectEvent);
      socket_->SignalReadEvent.connect(this, &NATSocket::OnReadEvent);
      socket_->SignalWriteEvent.connect(this, &NATSocket::OnWriteEvent);
      socket_->SignalCloseEvent.connect(this, &NATSocket::OnCloseEvent);
    } else {
      server_addr_.Clear();
      delete socket_;
      socket_ = NULL;
    }

    return result;
  }

  virtual int Connect(const SocketAddress& addr) {
    if (!socket_) {  // socket must be bound, for now
      return -1;
    }

    int result = 0;
    if (type_ == SOCK_STREAM) {
      result = socket_->Connect(server_addr_.IsAny() ? addr : server_addr_);
    } else {
      connected_ = true;
    }

    if (result >= 0) {
      remote_addr_ = addr;
    }

    return result;
  }

  virtual int Send(const void *pv, size_t cb) {
    ASSERT(connected_);
    return SendTo(pv, cb, remote_addr_);
  }

  virtual int SendTo(const void *pv, size_t cb, const SocketAddress& addr) {
    ASSERT(!connected_ || addr == remote_addr_);
    if (server_addr_.IsAny() || type_ == SOCK_STREAM) {
      return socket_->SendTo(pv, cb, addr);
    }

    size_t size = cb + addr.Size_();
    scoped_array<char> buf(new char[size]);
    Encode(static_cast<const char*>(pv), cb, buf.get(), size, addr);

    int result = socket_->SendTo(buf.get(), size, server_addr_);
    if (result >= 0) {
      ASSERT(result == static_cast<int>(size));
      result = result - static_cast<int>(addr.Size_());
    }
    return result;
  }

  virtual int Recv(void *pv, size_t cb) {
    SocketAddress addr;
    return RecvFrom(pv, cb, &addr);
  }

  virtual int RecvFrom(void *pv, size_t cb, SocketAddress *paddr) {
    if (server_addr_.IsAny() || type_ == SOCK_STREAM) {
      return socket_->RecvFrom(pv, cb, paddr);
    }

    // Make sure we have enough room to read the requested amount plus the
    // header address.
    SocketAddress remote_addr;
    Grow(cb + remote_addr.Size_());

    // Read the packet from the socket.
    int result = socket_->RecvFrom(buf_, size_, &remote_addr);
    if (result >= 0) {
      ASSERT(remote_addr == server_addr_);

      // TODO: we need better framing so we know how many bytes we can
      // return before we need to read the next address. For UDP, this will be
      // fine as long as the reader always reads everything in the packet.
      ASSERT((size_t)result < size_);

      // Decode the wire packet into the actual results.
      SocketAddress real_remote_addr;
      size_t real_size = cb;
      Decode(buf_, result, pv, &real_size, &real_remote_addr);

      // Make sure this packet should be delivered before returning it.
      if (!connected_ || (real_remote_addr == remote_addr_)) {
        if (paddr)
          *paddr = real_remote_addr;
        result = real_size;
      } else {
        LOG(LS_ERROR) << "Dropping packet from unknown remote address: "
                      << real_remote_addr.ToString();
        result = 0;  // Tell the caller we didn't read anything
      }
    }

    return result;
  }

  virtual int Close() {
    int result = 0;
    if (socket_) {
      result = socket_->Close();
      if (result >= 0) {
        connected_ = false;
        remote_addr_ = SocketAddress();
        delete socket_;
        socket_ = NULL;
      }
    }
    return result;
  }

  virtual int Listen(int backlog) {
    return socket_->Listen(backlog);
  }
  virtual AsyncSocket* Accept(SocketAddress *paddr) {
    return socket_->Accept(paddr);
  }
  virtual int GetError() const {
    return socket_->GetError();
  }
  virtual void SetError(int error) {
    socket_->SetError(error);
  }
  virtual ConnState GetState() const {
    return connected_ ? CS_CONNECTED : CS_CLOSED;
  }
  virtual int EstimateMTU(uint16* mtu) {
    return socket_->EstimateMTU(mtu);
  }
  virtual int GetOption(Option opt, int* value) {
    return socket_->GetOption(opt, value);
  }
  virtual int SetOption(Option opt, int value) {
    return socket_->SetOption(opt, value);
  }

  void OnConnectEvent(AsyncSocket* socket) {
    // If we're NATed, we need to send a request with the real addr to use.
    ASSERT(socket == socket_);
    if (server_addr_.IsAny()) {
      connected_ = true;
      SignalConnectEvent(this);
    } else {
      SendConnectRequest();
    }
  }
  void OnReadEvent(AsyncSocket* socket) {
    // If we're NATed, we need to process the connect reply.
    ASSERT(socket == socket_);
    if (type_ == SOCK_STREAM && !server_addr_.IsAny() && !connected_) {
      HandleConnectReply();
    } else {
      SignalReadEvent(this);
    }
  }
  void OnWriteEvent(AsyncSocket* socket) {
    ASSERT(socket == socket_);
    SignalWriteEvent(this);
  }
  void OnCloseEvent(AsyncSocket* socket, int error) {
    ASSERT(socket == socket_);
    SignalCloseEvent(this, error);
  }

 private:
  // Makes sure the buffer is at least the given size.
  void Grow(size_t new_size) {
    if (size_ < new_size) {
      delete[] buf_;
      size_ = new_size;
      buf_ = new char[size_];
    }
  }

  // Sends the destination address to the server to tell it to connect.
  void SendConnectRequest() {
    char buf[256];
    remote_addr_.Write_(buf, ARRAY_SIZE(buf));
    socket_->Send(buf, remote_addr_.Size_());
  }

  // Handles the byte sent back from the server and fires the appropriate event.
  void HandleConnectReply() {
    char code;
    socket_->Recv(&code, sizeof(code));
    if (code == 0) {
      SignalConnectEvent(this);
    } else {
      Close();
      SignalCloseEvent(this, code);
    }
  }

  // Encodes the given data and intended remote address into a packet to send
  // to the NAT server.
  static void Encode(const char* data, size_t data_size, char* buf,
                     size_t buf_size, const SocketAddress& remote_addr) {
    ASSERT(buf_size == data_size + remote_addr.Size_());
    remote_addr.Write_(buf, static_cast<int>(buf_size));
    std::memcpy(buf + remote_addr.Size_(), data, data_size);
  }

  // Decodes the given packet from the NAT server into the actual remote
  // address and data.
  static void Decode(const char* data, size_t data_size, void* buf,
                     size_t* buf_size, SocketAddress* remote_addr) {
    ASSERT(data_size >= remote_addr->Size_());
    ASSERT(data_size <= *buf_size + remote_addr->Size_());
    remote_addr->Read_(data, static_cast<int>(data_size));
    *buf_size = data_size - remote_addr->Size_();
    std::memcpy(buf, data + remote_addr->Size_(), *buf_size);
  }

  NATInternalSocketFactory* sf_;
  int type_;
  bool async_;
  bool connected_;
  SocketAddress remote_addr_;
  SocketAddress server_addr_;  // address of the NAT server
  AsyncSocket* socket_;
  char* buf_;
  size_t size_;
};

// NATSocketFactory
NATSocketFactory::NATSocketFactory(SocketFactory* factory,
                                   const SocketAddress& nat_addr)
    : factory_(factory), nat_addr_(nat_addr) {
}

Socket* NATSocketFactory::CreateSocket(int type) {
  return new NATSocket(this, type);
}

AsyncSocket* NATSocketFactory::CreateAsyncSocket(int type) {
  return new NATSocket(this, type);
}

AsyncSocket* NATSocketFactory::CreateInternalSocket(int type,
    const SocketAddress& local_addr, SocketAddress* nat_addr) {
  *nat_addr = nat_addr_;
  return factory_->CreateAsyncSocket(type);
}

// NATSocketServer
NATSocketServer::NATSocketServer(SocketServer* server)
    : server_(server), msg_queue_(NULL) {
}

NATSocketServer::Translator* NATSocketServer::GetTranslator(
    const SocketAddress& ext_ip) {
  return nats_.Get(ext_ip);
}

NATSocketServer::Translator* NATSocketServer::AddTranslator(
    const SocketAddress& ext_ip, const SocketAddress& int_ip, NATType type) {
  // Fail if a translator already exists with this extternal address.
  if (nats_.Get(ext_ip))
    return NULL;

  return nats_.Add(ext_ip, new Translator(this, type, int_ip, server_, ext_ip));
}

void NATSocketServer::RemoveTranslator(
    const SocketAddress& ext_ip) {
  nats_.Remove(ext_ip);
}

Socket* NATSocketServer::CreateSocket(int type) {
  return new NATSocket(this, type);
}

AsyncSocket* NATSocketServer::CreateAsyncSocket(int type) {
  return new NATSocket(this, type);
}

AsyncSocket* NATSocketServer::CreateInternalSocket(int type,
    const SocketAddress& local_addr, SocketAddress* nat_addr) {
  AsyncSocket* socket = NULL;
  Translator* nat = nats_.FindClient(local_addr);
  if (nat) {
    socket = nat->internal_factory()->CreateAsyncSocket(type);
    *nat_addr = (type == SOCK_STREAM) ?
        nat->internal_tcp_address() : nat->internal_address();
  } else {
    socket = server_->CreateAsyncSocket(type);
  }
  return socket;
}

// NATSocketServer::Translator
NATSocketServer::Translator::Translator(
    NATSocketServer* server, NATType type, const SocketAddress& int_ip,
    SocketFactory* ext_factory, const SocketAddress& ext_ip)
    : server_(server) {
  // Create a new private network, and a NATServer running on the private
  // network that bridges to the external network. Also tell the private
  // network to use the same message queue as us.
  VirtualSocketServer* internal_server = new VirtualSocketServer(server_);
  internal_server->SetMessageQueue(server_->queue());
  internal_factory_.reset(internal_server);
  nat_server_.reset(new NATServer(type, internal_server, int_ip,
                                  ext_factory, ext_ip));
}


NATSocketServer::Translator* NATSocketServer::Translator::GetTranslator(
    const SocketAddress& ext_ip) {
  return nats_.Get(ext_ip);
}

NATSocketServer::Translator* NATSocketServer::Translator::AddTranslator(
    const SocketAddress& ext_ip, const SocketAddress& int_ip, NATType type) {
  // Fail if a translator already exists with this extternal address.
  if (nats_.Get(ext_ip))
    return NULL;

  AddClient(ext_ip);
  return nats_.Add(ext_ip,
                   new Translator(server_, type, int_ip, server_, ext_ip));
}
void NATSocketServer::Translator::RemoveTranslator(
    const SocketAddress& ext_ip) {
  nats_.Remove(ext_ip);
  RemoveClient(ext_ip);
}

bool NATSocketServer::Translator::AddClient(
    const SocketAddress& int_ip) {
  // Fail if a client already exists with this internal address.
  if (clients_.find(int_ip) != clients_.end())
    return false;

  clients_.insert(int_ip);
  return true;
}

void NATSocketServer::Translator::RemoveClient(
    const SocketAddress& int_ip) {
  std::set<SocketAddress>::iterator it = clients_.find(int_ip);
  if (it != clients_.end()) {
    clients_.erase(it);
  }
}

NATSocketServer::Translator* NATSocketServer::Translator::FindClient(
    const SocketAddress& int_ip) {
  // See if we have the requested IP, or any of our children do.
  return (clients_.find(int_ip) != clients_.end()) ?
      this : nats_.FindClient(int_ip);
}

// NATSocketServer::TranslatorMap
NATSocketServer::TranslatorMap::~TranslatorMap() {
  for (TranslatorMap::iterator it = begin(); it != end(); ++it) {
    delete it->second;
  }
}

NATSocketServer::Translator* NATSocketServer::TranslatorMap::Get(
    const SocketAddress& ext_ip) {
  TranslatorMap::iterator it = find(ext_ip);
  return (it != end()) ? it->second : NULL;
}

NATSocketServer::Translator* NATSocketServer::TranslatorMap::Add(
    const SocketAddress& ext_ip, Translator* nat) {
  (*this)[ext_ip] = nat;
  return nat;
}

void NATSocketServer::TranslatorMap::Remove(
    const SocketAddress& ext_ip) {
  TranslatorMap::iterator it = find(ext_ip);
  if (it != end()) {
    delete it->second;
    erase(it);
  }
}

NATSocketServer::Translator* NATSocketServer::TranslatorMap::FindClient(
    const SocketAddress& int_ip) {
  Translator* nat = NULL;
  for (TranslatorMap::iterator it = begin(); it != end() && !nat; ++it) {
    nat = it->second->FindClient(int_ip);
  }
  return nat;
}

}  // namespace talk_base
