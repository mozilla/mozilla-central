/*
 * libjingle
 * Copyright 2004--2011, Google Inc.
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

#include "talk/session/phone/mediamessages.h"

#include <string>
#include <vector>

#include "talk/base/gunit.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/constants.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/xmllite/xmlelement.h"

// Unit tests for mediamessages.cc.

namespace cricket {

namespace {

static const char kViewVideoNoneXml[] =
    "<view xmlns='google:jingle'"
    "  name='video1'"
    "  type='none'"
    "/>";

static const char kNotifyEmptyXml[] =
    "<notify xmlns='google:jingle'"
    "  name='video1'"
    "/>";

class MediaMessagesTest : public testing::Test {
 public:
  // CreateMediaSessionDescription uses a static variable cricket::NS_JINGLE_RTP
  // defined in another file and cannot be used to initialize another static
  // variable (http://www.parashift.com/c++-faq-lite/ctors.html#faq-10.14)
  MediaMessagesTest()
      : remote_description_(CreateMediaSessionDescription("audio1", "video1")) {
  }

 protected:
  static std::string ViewVideoStaticVgaXml(const std::string& ssrc) {
      return "<view xmlns='google:jingle'"
             "  name='video1'"
             "  type='static'"
             "  ssrc='" + ssrc + "'"
             ">"
             "<params"
             "    width='640'"
             "    height='480'"
             "    framerate='30'"
             "    preference='0'"
             "  />"
             "</view>";
  }

  static std::string NotifyAddXml(const std::string& content_name,
                                  const std::string& nick,
                                  const std::string& name,
                                  const std::string& ssrc) {
    return "<notify xmlns='google:jingle'"
           "  name='" + content_name + "'"
           ">"
           "  <source"
           "    nick='" + nick + "'"
           "    name='" + name + "'"
           "  >"
           "    <ssrc>" + ssrc + "</ssrc>"
           "  </source>"
           "</notify>";
  }

  static std::string NotifyTwoSourceXml(const std::string& name,
                                        const std::string& nick1,
                                        const std::string& ssrc1,
                                        const std::string& nick2,
                                        const std::string& ssrc2) {
    return "<notify xmlns='google:jingle'"
           "  name='" + name + "'"
           ">"
           "  <source"
           "    nick='" + nick1 + "'"
           "  >"
           "    <ssrc>" + ssrc1 + "</ssrc>"
           "  </source>"
           "  <source"
           "    nick='" + nick2 + "'"
           "  >"
           "    <ssrc>" + ssrc2 + "</ssrc>"
           "  </source>"
           "</notify>";
  }

  static std::string NotifyImplicitRemoveXml(const std::string& content_name,
                                             const std::string& nick) {
    return "<notify xmlns='google:jingle'"
           "  name='" + content_name + "'"
           ">"
           "  <source"
           "    nick='" + nick + "'"
           "  >"
           "  </source>"
           "</notify>";
  }

  static cricket::StreamParams CreateStream(const std::string& nick,
                                            const std::string& name,
                                            uint32 ssrc1,
                                            uint32 ssrc2,
                                            const std::string& semantics,
                                            const std::string& type,
                                            const std::string& display) {
    StreamParams stream;
    stream.nick = nick;
    stream.name = name;
    stream.ssrcs.push_back(ssrc1);
    stream.ssrcs.push_back(ssrc2);
    stream.ssrc_groups.push_back(
        cricket::SsrcGroup(semantics, stream.ssrcs));
    stream.type = type;
    stream.display = display;
    return stream;
  }

  static std::string StreamsXml(const std::string& stream1,
                               const std::string& stream2) {
    return "<streams xmlns='google:jingle'>"
           + stream1
           + stream2 +
           "</streams>";
  }


  static std::string StreamXml(const std::string& nick,
                               const std::string& name,
                               const std::string& ssrc1,
                               const std::string& ssrc2,
                               const std::string& semantics,
                               const std::string& type,
                               const std::string& display) {
    return "<stream"
           " nick='" + nick + "'"
           " name='" + name + "'"
           " type='" + type + "'"
           " display='" + display + "'"
           ">"
           "<ssrc>" + ssrc1 + "</ssrc>"
           "<ssrc>" + ssrc2 + "</ssrc>"
           "<ssrc-group"
           "  semantics='" + semantics + "'"
           ">"
           "<ssrc>" + ssrc1 + "</ssrc>"
           "<ssrc>" + ssrc2 + "</ssrc>"
           "</ssrc-group>"
           "</stream>";
  }

  static cricket::SessionDescription* CreateMediaSessionDescription(
      const std::string& audio_content_name,
      const std::string& video_content_name) {
    cricket::SessionDescription* desc = new cricket::SessionDescription();
    desc->AddContent(audio_content_name, cricket::NS_JINGLE_RTP,
                     new cricket::AudioContentDescription());
    desc->AddContent(video_content_name, cricket::NS_JINGLE_RTP,
                     new cricket::VideoContentDescription());
    return desc;
  }

  talk_base::scoped_ptr<cricket::SessionDescription> remote_description_;
};

}  // anonymous namespace

// Test serializing/deserializing an empty <view> message.
TEST_F(MediaMessagesTest, ViewNoneToFromXml) {
  talk_base::scoped_ptr<buzz::XmlElement> expected_view_elem(
      buzz::XmlElement::ForStr(kViewVideoNoneXml));

  cricket::ViewRequest view_request;
  cricket::XmlElements actual_view_elems;
  cricket::WriteError error;

  EXPECT_FALSE(cricket::IsJingleViewRequest(actual_view_elems));
  ASSERT_TRUE(cricket::WriteJingleViewRequest(
      "video1", view_request, &actual_view_elems, &error));

  ASSERT_EQ(1U, actual_view_elems.size());
  EXPECT_EQ(expected_view_elem->Str(), actual_view_elems[0]->Str());

  cricket::ParseError parse_error;
  EXPECT_TRUE(cricket::IsJingleViewRequest(actual_view_elems));
  ASSERT_TRUE(cricket::ParseJingleViewRequest(
      actual_view_elems, &view_request, &parse_error));
  EXPECT_EQ(0U, view_request.static_video_views.size());
}

// Test serializing/deserializing an a simple vga <view> message.
TEST_F(MediaMessagesTest, ViewVgaToFromXml) {
  talk_base::scoped_ptr<buzz::XmlElement> expected_view_elem1(
      buzz::XmlElement::ForStr(ViewVideoStaticVgaXml("1234")));
  talk_base::scoped_ptr<buzz::XmlElement> expected_view_elem2(
      buzz::XmlElement::ForStr(ViewVideoStaticVgaXml("2468")));

  cricket::ViewRequest view_request;
  cricket::XmlElements actual_view_elems;
  cricket::WriteError error;

  view_request.static_video_views.push_back(
      cricket::StaticVideoView(1234, 640, 480, 30));
  view_request.static_video_views.push_back(
      cricket::StaticVideoView(2468, 640, 480, 30));

  ASSERT_TRUE(cricket::WriteJingleViewRequest(
      "video1", view_request, &actual_view_elems, &error));

  ASSERT_EQ(2U, actual_view_elems.size());
  EXPECT_EQ(expected_view_elem1->Str(), actual_view_elems[0]->Str());
  EXPECT_EQ(expected_view_elem2->Str(), actual_view_elems[1]->Str());

  view_request.static_video_views.clear();
  cricket::ParseError parse_error;
  EXPECT_TRUE(cricket::IsJingleViewRequest(actual_view_elems));
  ASSERT_TRUE(cricket::ParseJingleViewRequest(
      actual_view_elems, &view_request, &parse_error));
  EXPECT_EQ(2U, view_request.static_video_views.size());
  EXPECT_EQ(1234U, view_request.static_video_views[0].ssrc);
  EXPECT_EQ(640, view_request.static_video_views[0].width);
  EXPECT_EQ(480, view_request.static_video_views[0].height);
  EXPECT_EQ(30, view_request.static_video_views[0].framerate);
  EXPECT_EQ(2468U, view_request.static_video_views[1].ssrc);
}

// Test deserializing bad view XML.
TEST_F(MediaMessagesTest, ParseBadViewXml) {
  talk_base::scoped_ptr<buzz::XmlElement> view_elem(
      buzz::XmlElement::ForStr(ViewVideoStaticVgaXml("not-an-ssrc")));
  XmlElements view_elems;
  view_elems.push_back(view_elem.get());

  cricket::ViewRequest view_request;
  cricket::ParseError parse_error;
  ASSERT_FALSE(cricket::ParseJingleViewRequest(
      view_elems, &view_request, &parse_error));
}

// Test serializing/deserializing an empty session-info message.
TEST_F(MediaMessagesTest, NotifyFromEmptyXml) {
  talk_base::scoped_ptr<buzz::XmlElement> action_elem(
      new buzz::XmlElement(cricket::QN_JINGLE));
  EXPECT_FALSE(cricket::IsSourcesNotify(action_elem.get()));
}

// Test serializing/deserializing an empty <notify> message.
TEST_F(MediaMessagesTest, NotifyEmptyFromXml) {
  talk_base::scoped_ptr<buzz::XmlElement> action_elem(
      new buzz::XmlElement(cricket::QN_JINGLE));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(kNotifyEmptyXml));

  cricket::MediaSources sources;
  cricket::ParseError error;

  EXPECT_TRUE(cricket::IsSourcesNotify(action_elem.get()));
  ASSERT_TRUE(cricket::ParseSourcesNotify(action_elem.get(),
                                          remote_description_.get(),
                                          &sources, &error));

  EXPECT_EQ(0U, sources.audio().size());
  EXPECT_EQ(0U, sources.video().size());
}

// Test serializing/deserializing a complex <notify> message.
TEST_F(MediaMessagesTest, NotifyFromXml) {
  talk_base::scoped_ptr<buzz::XmlElement> action_elem(
      new buzz::XmlElement(cricket::QN_JINGLE));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyAddXml(
          "video1", "Joe", "Facetime", "1234")));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyAddXml(
          "video1", "Bob", "Microsoft Word", "2468")));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyAddXml(
          "video1", "Bob", "", "3692")));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyImplicitRemoveXml(
          "audio1", "Joe")));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyAddXml(
          "audio1", "Bob", "", "3692")));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyTwoSourceXml(
          "video1", "Joe", "1234", "Bob", "2468")));

  cricket::MediaSources sources;
  cricket::ParseError error;

  EXPECT_TRUE(cricket::IsSourcesNotify(action_elem.get()));
  ASSERT_TRUE(cricket::ParseSourcesNotify(action_elem.get(),
                                          remote_description_.get(),
                                          &sources, &error));

  ASSERT_EQ(5U, sources.video().size());
  ASSERT_EQ(2U, sources.audio().size());

  EXPECT_EQ("Joe", sources.video()[0].nick);
  EXPECT_EQ("Facetime", sources.video()[0].name);
  EXPECT_EQ(1234U, sources.video()[0].ssrc);
  EXPECT_TRUE(sources.video()[0].ssrc_set);
  EXPECT_FALSE(sources.video()[0].removed);

  EXPECT_EQ("Bob", sources.video()[1].nick);
  EXPECT_EQ("Microsoft Word", sources.video()[1].name);
  EXPECT_EQ(2468U, sources.video()[1].ssrc);
  EXPECT_TRUE(sources.video()[1].ssrc_set);
  EXPECT_FALSE(sources.video()[0].removed);

  EXPECT_EQ("Bob", sources.video()[2].nick);
  EXPECT_EQ(3692U, sources.video()[2].ssrc);
  EXPECT_TRUE(sources.video()[2].ssrc_set);
  EXPECT_EQ("", sources.video()[2].name);
  EXPECT_FALSE(sources.video()[0].removed);

  EXPECT_EQ("Joe", sources.video()[3].nick);
  EXPECT_EQ(1234U, sources.video()[3].ssrc);

  EXPECT_EQ("Bob", sources.video()[4].nick);
  EXPECT_EQ(2468U, sources.video()[4].ssrc);

  EXPECT_EQ("Joe", sources.audio()[0].nick);
  EXPECT_FALSE(sources.audio()[0].ssrc_set);
  EXPECT_FALSE(sources.video()[0].removed);
}

// Test serializing/deserializing a malformed <notify> message.
TEST_F(MediaMessagesTest, NotifyFromBadXml) {
  MediaSources sources;
  ParseError error;

  // Bad ssrc
  talk_base::scoped_ptr<buzz::XmlElement> action_elem(
      new buzz::XmlElement(cricket::QN_JINGLE));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyAddXml("video1", "Joe", "", "XYZ")));
  EXPECT_TRUE(cricket::IsSourcesNotify(action_elem.get()));
  EXPECT_FALSE(cricket::ParseSourcesNotify(
      action_elem.get(), remote_description_.get(), &sources, &error));

  // Bad nick
  action_elem.reset(new buzz::XmlElement(cricket::QN_JINGLE));
  action_elem->AddElement(
      buzz::XmlElement::ForStr(NotifyAddXml("video1", "", "", "1234")));
  EXPECT_TRUE(cricket::IsSourcesNotify(action_elem.get()));
  EXPECT_FALSE(cricket::ParseSourcesNotify(
      action_elem.get(), remote_description_.get(), &sources, &error));
}

// Test serializing/deserializing typical streams xml.
TEST_F(MediaMessagesTest, StreamsToFromXml) {
  talk_base::scoped_ptr<buzz::XmlElement> expected_streams_elem(
      buzz::XmlElement::ForStr(
          StreamsXml(
              StreamXml("nick1", "name1", "101", "102",
                        "semantics1", "type1", "display1"),
              StreamXml("nick2", "name2", "201", "202",
                        "semantics2", "type2", "display2"))));

  std::vector<cricket::StreamParams> expected_streams;
  expected_streams.push_back(CreateStream("nick1", "name1", 101U, 102U,
                                          "semantics1", "type1", "display1"));
  expected_streams.push_back(CreateStream("nick2", "name2", 201U, 202U,
                                          "semantics2", "type2", "display2"));

  talk_base::scoped_ptr<buzz::XmlElement> actual_desc_elem(
      new buzz::XmlElement(QN_JINGLE_RTP_CONTENT));
  cricket::WriteJingleStreams(expected_streams, actual_desc_elem.get());

  const buzz::XmlElement* actual_streams_elem =
      actual_desc_elem->FirstNamed(QN_JINGLE_DRAFT_STREAMS);
  ASSERT_TRUE(actual_streams_elem != NULL);
  EXPECT_EQ(expected_streams_elem->Str(), actual_streams_elem->Str());

  talk_base::scoped_ptr<buzz::XmlElement> expected_desc_elem(
      new buzz::XmlElement(QN_JINGLE_RTP_CONTENT));
  expected_desc_elem->AddElement(new buzz::XmlElement(
      *expected_streams_elem));
  std::vector<cricket::StreamParams> actual_streams;
  cricket::ParseError parse_error;

  EXPECT_TRUE(cricket::HasJingleStreams(expected_desc_elem.get()));
  ASSERT_TRUE(cricket::ParseJingleStreams(
      expected_desc_elem.get(), &actual_streams, &parse_error));
  EXPECT_EQ(2U, actual_streams.size());
  EXPECT_EQ(expected_streams[0], actual_streams[0]);
  EXPECT_EQ(expected_streams[1], actual_streams[1]);
}

// Test deserializing bad streams xml.
TEST_F(MediaMessagesTest, StreamsFromBadXml) {
  talk_base::scoped_ptr<buzz::XmlElement> streams_elem(
      buzz::XmlElement::ForStr(
          StreamsXml(
              StreamXml("nick1", "name1", "101", "not-an-ssrc",
                        "semantics1", "type1", "display1"),
              StreamXml("nick2", "name2", "202", "not-an-ssrc",
                        "semantics2", "type2", "display2"))));
  talk_base::scoped_ptr<buzz::XmlElement> desc_elem(
      new buzz::XmlElement(QN_JINGLE_RTP_CONTENT));
  desc_elem->AddElement(new buzz::XmlElement(*streams_elem));

  std::vector<cricket::StreamParams> actual_streams;
  cricket::ParseError parse_error;
  ASSERT_FALSE(cricket::ParseJingleStreams(
      desc_elem.get(), &actual_streams, &parse_error));
}

}  // namespace cricket
