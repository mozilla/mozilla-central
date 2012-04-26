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

#include <cstdio>
#include <cstring>
#include <time.h>
#include <iomanip>
#include <iostream>
#include <vector>

#include "talk/base/flags.h"
#include "talk/base/logging.h"
#ifdef OSX
#include "talk/base/macsocketserver.h"
#endif
#include "talk/base/pathutils.h"
#include "talk/base/stream.h"
#include "talk/base/ssladapter.h"
#include "talk/base/win32socketserver.h"
#include "talk/examples/login/xmppthread.h"
#include "talk/examples/login/xmppauth.h"
#include "talk/examples/login/xmpppump.h"
#include "talk/examples/call/callclient.h"
#include "talk/examples/call/console.h"
#include "talk/examples/call/mediaenginefactory.h"
#include "talk/p2p/base/constants.h"
#ifdef ANDROID
#include "talk/session/phone/androidmediaengine.h"
#endif
#include "talk/session/phone/mediasessionclient.h"
#include "talk/session/phone/srtpfilter.h"
#include "talk/xmpp/xmppclientsettings.h"

class DebugLog : public sigslot::has_slots<> {
 public:
  DebugLog() :
    debug_input_buf_(NULL), debug_input_len_(0), debug_input_alloc_(0),
    debug_output_buf_(NULL), debug_output_len_(0), debug_output_alloc_(0),
    censor_password_(false)
      {}
  char * debug_input_buf_;
  int debug_input_len_;
  int debug_input_alloc_;
  char * debug_output_buf_;
  int debug_output_len_;
  int debug_output_alloc_;
  bool censor_password_;

  void Input(const char * data, int len) {
    if (debug_input_len_ + len > debug_input_alloc_) {
      char * old_buf = debug_input_buf_;
      debug_input_alloc_ = 4096;
      while (debug_input_alloc_ < debug_input_len_ + len) {
        debug_input_alloc_ *= 2;
      }
      debug_input_buf_ = new char[debug_input_alloc_];
      memcpy(debug_input_buf_, old_buf, debug_input_len_);
      delete[] old_buf;
    }
    memcpy(debug_input_buf_ + debug_input_len_, data, len);
    debug_input_len_ += len;
    DebugPrint(debug_input_buf_, &debug_input_len_, false);
  }

  void Output(const char * data, int len) {
    if (debug_output_len_ + len > debug_output_alloc_) {
      char * old_buf = debug_output_buf_;
      debug_output_alloc_ = 4096;
      while (debug_output_alloc_ < debug_output_len_ + len) {
        debug_output_alloc_ *= 2;
      }
      debug_output_buf_ = new char[debug_output_alloc_];
      memcpy(debug_output_buf_, old_buf, debug_output_len_);
      delete[] old_buf;
    }
    memcpy(debug_output_buf_ + debug_output_len_, data, len);
    debug_output_len_ += len;
    DebugPrint(debug_output_buf_, &debug_output_len_, true);
  }

  static bool IsAuthTag(const char * str, size_t len) {
    if (str[0] == '<' && str[1] == 'a' &&
                         str[2] == 'u' &&
                         str[3] == 't' &&
                         str[4] == 'h' &&
                         str[5] <= ' ') {
      std::string tag(str, len);

      if (tag.find("mechanism") != std::string::npos)
        return true;
    }
    return false;
  }

  void DebugPrint(char * buf, int * plen, bool output) {
    int len = *plen;
    if (len > 0) {
      time_t tim = time(NULL);
      struct tm * now = localtime(&tim);
      char *time_string = asctime(now);
      if (time_string) {
        size_t time_len = strlen(time_string);
        if (time_len > 0) {
          time_string[time_len-1] = 0;    // trim off terminating \n
        }
      }
      LOG(INFO) << (output ? "SEND >>>>>>>>>>>>>>>>" : "RECV <<<<<<<<<<<<<<<<")
                << " : " << time_string;

      bool indent;
      int start = 0, nest = 3;
      for (int i = 0; i < len; i += 1) {
        if (buf[i] == '>') {
          if ((i > 0) && (buf[i-1] == '/')) {
            indent = false;
          } else if ((start + 1 < len) && (buf[start + 1] == '/')) {
            indent = false;
            nest -= 2;
          } else {
            indent = true;
          }

          // Output a tag
          LOG(INFO) << std::setw(nest) << " "
                    << std::string(buf + start, i + 1 - start);

          if (indent)
            nest += 2;

          // Note if it's a PLAIN auth tag
          if (IsAuthTag(buf + start, i + 1 - start)) {
            censor_password_ = true;
          }

          // incr
          start = i + 1;
        }

        if (buf[i] == '<' && start < i) {
          if (censor_password_) {
            LOG(INFO) << std::setw(nest) << " " << "## TEXT REMOVED ##";
            censor_password_ = false;
          } else {
            LOG(INFO) << std::setw(nest) << " "
                      << std::string(buf + start, i - start);
          }
          start = i;
        }
      }
      len = len - start;
      memcpy(buf, buf + start, len);
      *plen = len;
    }
  }
};

static DebugLog debug_log_;
static const int DEFAULT_PORT = 5222;

#ifdef ANDROID
static std::vector<cricket::AudioCodec> codecs;
static const cricket::AudioCodec ISAC(103, "ISAC", 40000, 16000, 1, 0);

cricket::MediaEngine *AndroidMediaEngineFactory() {
    cricket::FakeMediaEngine *engine = new cricket::FakeMediaEngine();

    codecs.push_back(ISAC);
    engine->SetAudioCodecs(codecs);
    return engine;
}
#endif

// TODO: Move this into Console.
void Print(const char* chars) {
  printf("%s", chars);
  fflush(stdout);
}

int main(int argc, char **argv) {
  // This app has three threads. The main thread will run the XMPP client,
  // which will print to the screen in its own thread. A second thread
  // will get input from the console, parse it, and pass the appropriate
  // message back to the XMPP client's thread. A third thread is used
  // by MediaSessionClient as its worker thread.

  // define options
  DEFINE_bool(a, false, "Turn on auto accept.");
  DEFINE_bool(d, false, "Turn on debugging.");
  DEFINE_string(protocol, "hybrid",
      "Initial signaling protocol to use: jingle, gingle, or hybrid.");
  DEFINE_string(secure, "enable",
      "Disable or enable encryption: disable, enable, require.");
  DEFINE_string(tls, "enable",
      "Disable or enable tls: disable, enable, require.");
  DEFINE_bool(allowplain, false, "Allow plain authentication");
  DEFINE_bool(testserver, false, "Use test server");
  DEFINE_int(portallocator, 0, "Filter out unwanted connection types.");
  DEFINE_string(filterhost, NULL, "Filter out the host from all candidates.");
  DEFINE_string(pmuc, "groupchat.google.com", "The persistant muc domain.");
  DEFINE_string(s, "talk.google.com", "The connection server to use.");
  DEFINE_string(capsnode, "http://code.google.com/p/libjingle/call",
                "Caps node: A URI identifying the app.");
  DEFINE_string(capsver, "0.6",
                "Caps ver: A string identifying the version of the app.");
  DEFINE_string(voiceinput, NULL, "RTP dump file for voice input.");
  DEFINE_string(voiceoutput, NULL, "RTP dump file for voice output.");
  DEFINE_string(videoinput, NULL, "RTP dump file for video input.");
  DEFINE_string(videooutput, NULL, "RTP dump file for video output.");
  DEFINE_bool(render, true, "Renders the video.");
  DEFINE_bool(datachannel, false, "Enable an RTP data channel.");
  DEFINE_bool(debugsrtp, false, "Enable debugging for srtp.");
  DEFINE_bool(help, false, "Prints this message");

  // parse options
  FlagList::SetFlagsFromCommandLine(&argc, argv, true);
  if (FLAG_help) {
    FlagList::Print(NULL, false);
    return 0;
  }

  bool auto_accept = FLAG_a;
  bool debug = FLAG_d;
  std::string protocol = FLAG_protocol;
  bool test_server = FLAG_testserver;
  bool allow_plain = FLAG_allowplain;
  std::string tls = FLAG_tls;
  int32 portallocator_flags = FLAG_portallocator;
  std::string pmuc_domain = FLAG_pmuc;
  std::string server = FLAG_s;
  std::string secure = FLAG_secure;
  std::string caps_node = FLAG_capsnode;
  std::string caps_ver = FLAG_capsver;
  bool debugsrtp = FLAG_debugsrtp;
  bool render = FLAG_render;
  bool data_channel_enabled = FLAG_datachannel;

  if (debugsrtp) {
    cricket::EnableSrtpDebugging();
  }

  cricket::SignalingProtocol initial_protocol = cricket::PROTOCOL_HYBRID;
  if (protocol == "jingle") {
    initial_protocol = cricket::PROTOCOL_JINGLE;
  } else if (protocol == "gingle") {
    initial_protocol = cricket::PROTOCOL_GINGLE;
  } else if (protocol == "hybrid") {
    initial_protocol = cricket::PROTOCOL_HYBRID;
  } else {
    Print("Invalid protocol.  Must be jingle, gingle, or hybrid.\n");
    return 1;
  }

  cricket::SecureMediaPolicy secure_policy = cricket::SEC_ENABLED;
  if (secure == "disable") {
    secure_policy = cricket::SEC_DISABLED;
  } else if (secure == "enable") {
    secure_policy = cricket::SEC_ENABLED;
  } else if (secure == "require") {
    secure_policy = cricket::SEC_REQUIRED;
  } else {
    Print("Invalid encryption.  Must be enable, disable, or require.\n");
    return 1;
  }

  // parse username and password, if present
  buzz::Jid jid;
  std::string username;
  talk_base::InsecureCryptStringImpl pass;
  if (argc > 1) {
    username = argv[1];
    if (argc > 2) {
      pass.password() = argv[2];
    }
  }

  if (debug)
    talk_base::LogMessage::LogToDebug(talk_base::LS_VERBOSE);

  if (username.empty()) {
    Print("JID: ");
    std::cin >> username;
  }
  if (username.find('@') == std::string::npos) {
    username.append("@localhost");
  }
  jid = buzz::Jid(username);
  if (!jid.IsValid() || jid.node() == "") {
    Print("Invalid JID. JIDs should be in the form user@domain\n");
    return 1;
  }
  if (pass.password().empty() && !test_server) {
    Console::SetEcho(false);
    Print("Password: ");
    std::cin >> pass.password();
    Console::SetEcho(true);
    Print("\n");
  }

  buzz::XmppClientSettings xcs;
  xcs.set_user(jid.node());
  xcs.set_resource("call");
  xcs.set_host(jid.domain());
  xcs.set_allow_plain(allow_plain);

  if(tls == "disable") {
    xcs.set_use_tls(buzz::TLS_DISABLED);
  } else if (tls == "enable") {
    xcs.set_use_tls(buzz::TLS_ENABLED);
  } else if (tls == "require") {
    xcs.set_use_tls(buzz::TLS_REQUIRED);
  } else {
    Print("Invalid TLS option, must be enable, disable, or require.\n");
    return 1;
  }

  if (test_server) {
    pass.password() = jid.node();
    xcs.set_allow_plain(true);
    xcs.set_use_tls(buzz::TLS_DISABLED);
    xcs.set_test_server_domain("google.com");
  }
  xcs.set_pass(talk_base::CryptString(pass));

  std::string host;
  int port;

  int colon = server.find(':');
  if (colon == -1) {
    host = server;
    port = DEFAULT_PORT;
  } else {
    host = server.substr(0, colon);
    port = atoi(server.substr(colon + 1).c_str());
  }

  xcs.set_server(talk_base::SocketAddress(host, port));
  Print(("Logging in to " + server + " as " + jid.Str() + "\n").c_str());

  talk_base::InitializeSSL();

#ifdef ANDROID
  InitAndroidMediaEngineFactory(AndroidMediaEngineFactory);
#endif

#if WIN32
  // Need to pump messages on our main thread on Windows.
  talk_base::Win32Thread w32_thread;
  talk_base::ThreadManager::Instance()->SetCurrentThread(&w32_thread);
#endif
  talk_base::Thread* main_thread = talk_base::Thread::Current();
#ifdef OSX
  talk_base::MacCarbonAppSocketServer ss;
  talk_base::SocketServerScope ss_scope(&ss);
#endif

  XmppPump pump;
  CallClient *client = new CallClient(pump.client(), caps_node, caps_ver);

  if (FLAG_voiceinput || FLAG_voiceoutput ||
      FLAG_videoinput || FLAG_videooutput) {
    // If any dump file is specified, we use a FileMediaEngine.
    cricket::MediaEngineInterface* engine =
        MediaEngineFactory::CreateFileMediaEngine(
            FLAG_voiceinput, FLAG_voiceoutput,
            FLAG_videoinput, FLAG_videooutput);
    client->SetMediaEngine(engine);
  }

  Console *console = new Console(main_thread, client);
  client->SetConsole(console);
  client->SetAutoAccept(auto_accept);
  client->SetPmucDomain(pmuc_domain);
  client->SetPortAllocatorFlags(portallocator_flags);
  client->SetAllowLocalIps(true);
  client->SetInitialProtocol(initial_protocol);
  client->SetSecurePolicy(secure_policy);
  client->SetRender(render);
  client->SetDataChannelEnabled(data_channel_enabled);
  console->Start();

  if (debug) {
    pump.client()->SignalLogInput.connect(&debug_log_, &DebugLog::Input);
    pump.client()->SignalLogOutput.connect(&debug_log_, &DebugLog::Output);
  }

  pump.DoLogin(xcs, new XmppSocket(buzz::TLS_REQUIRED), NULL);
  main_thread->Run();
  pump.DoDisconnect();

  console->Stop();
  delete console;
  delete client;

  return 0;
}
