/*
 * libjingle
 * Copyright 2012, Google Inc.
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


#include <string>

#include "talk/app/webrtc/audiotrack.h"
#include "talk/app/webrtc/mediastream.h"
#include "talk/app/webrtc/mediastreamsignaling.h"
#include "talk/app/webrtc/streamcollectionimpl.h"
#include "talk/app/webrtc/videotrack.h"
#include "talk/base/gunit.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/thread.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/sessiondescription.h"

static const char kStreams[][8] = {"stream1", "stream2"};
static const char kAudioTracks[][8] = {"audio_1", "audio_2"};
static const char kVideoTracks[][8] = {"video_1", "video_2"};

using webrtc::IceCandidateInterface;
using webrtc::MediaStreamInterface;
using webrtc::SessionDescriptionInterface;

using webrtc::StreamCollection;
using webrtc::StreamCollectionInterface;

// Reference SDP with a MediaStream with label "stream1" and audio track with
// label "audio_1" and a video track with label "video_1;
static const char kSdpString1[] =
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=\r\n"
    "t=0 0\r\n"
    "m=audio 1 RTP/AVPF 103\r\n"
    "a=mid:audio\r\n"
    "a=rtpmap:103 ISAC/16000\r\n"
    "a=ssrc:1 cname:stream1\r\n"
    "a=ssrc:1 mslabel:stream1\r\n"
    "a=ssrc:1 label:audio_1\r\n"
    "m=video 1 RTP/AVPF 120\r\n"
    "a=mid:video\r\n"
    "a=rtpmap:120 VP8/90000\r\n"
    "a=ssrc:2 cname:stream1\r\n"
    "a=ssrc:2 mslabel:stream1\r\n"
    "a=ssrc:2 label:video_1\r\n";

// Reference SDP with two MediaStreams with label "stream1" and "stream2. Each
// MediaStreams have one audio track and one video track.
static const char kSdpString2[] =
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=\r\n"
    "t=0 0\r\n"
    "m=audio 1 RTP/AVPF 103\r\n"
    "a=mid:audio\r\n"
    "a=rtpmap:103 ISAC/16000\r\n"
    "a=ssrc:1 cname:stream1\r\n"
    "a=ssrc:1 mslabel:stream1\r\n"
    "a=ssrc:1 label:audio_1\r\n"
    "a=ssrc:3 cname:stream2\r\n"
    "a=ssrc:3 mslabel:stream2\r\n"
    "a=ssrc:3 label:audio_2\r\n"
    "m=video 1 RTP/AVPF 120\r\n"
    "a=mid:video\r\n"
    "a=rtpmap:120 VP8/0\r\n"
    "a=ssrc:2 cname:stream1\r\n"
    "a=ssrc:2 mslabel:stream1\r\n"
    "a=ssrc:2 label:video_1\r\n"
    "a=ssrc:4 cname:stream2\r\n"
    "a=ssrc:4 mslabel:stream2\r\n"
    "a=ssrc:4 label:video_2\r\n";

// Create a collection of streams.
// CreateStreamCollection(1) creates a collection that
// correspond to kSdpString1.
// CreateStreamCollection(2) correspond to kSdpString2.
static talk_base::scoped_refptr<StreamCollection>
CreateStreamCollection(int number_of_streams) {
  talk_base::scoped_refptr<StreamCollection> local_collection(
      StreamCollection::Create());

  for (int i = 0; i < number_of_streams; ++i) {
    talk_base::scoped_refptr<webrtc::LocalMediaStreamInterface> stream(
        webrtc::MediaStream::Create(kStreams[i]));

    // Add a local audio track.
    talk_base::scoped_refptr<webrtc::LocalAudioTrackInterface>
    audio_track(webrtc::AudioTrack::CreateLocal(kAudioTracks[i], NULL));
    stream->AddTrack(audio_track);

    // Add a local video track.
    talk_base::scoped_refptr<webrtc::LocalVideoTrackInterface>
    video_track(webrtc::VideoTrack::CreateLocal(kVideoTracks[i], NULL));
    stream->AddTrack(video_track);

    local_collection->AddStream(stream);
  }
  return local_collection;
}

// Verifies that |options| contain all tracks in |collection| if |hints| allow
// them.
static void VerifyMediaOptions(StreamCollectionInterface* collection,
                               const webrtc::MediaHints hints,
                               const cricket::MediaSessionOptions& options) {
  EXPECT_EQ(hints.has_audio(), options.has_audio);
  EXPECT_EQ(hints.has_video(), options.has_video);

  if (!collection)
    return;

  size_t stream_index = 0;
  for (size_t i = 0; i < collection->count(); ++i) {
    MediaStreamInterface* stream = collection->at(i);
    ASSERT_GE(options.streams.size(), stream->audio_tracks()->count());
    for (size_t j = 0; j < stream->audio_tracks()->count(); ++j) {
      webrtc::AudioTrackInterface* audio = stream->audio_tracks()->at(j);
      EXPECT_EQ(options.streams[stream_index].sync_label, stream->label());
      EXPECT_EQ(options.streams[stream_index++].name, audio->label());
    }
    ASSERT_GE(options.streams.size(), stream->audio_tracks()->count());
    for (size_t j = 0; j < stream->video_tracks()->count(); ++j) {
      webrtc::VideoTrackInterface* video = stream->video_tracks()->at(j);
      EXPECT_EQ(options.streams[stream_index].sync_label, stream->label());
      EXPECT_EQ(options.streams[stream_index++].name, video->label());
    }
  }
}

static bool CompareStreamCollections(StreamCollectionInterface* s1,
                                     StreamCollectionInterface* s2) {
  if (s1 == NULL || s2 == NULL || s1->count() != s2->count())
    return false;

  for (size_t i = 0; i != s1->count(); ++i) {
    if (s1->at(i)->label() != s2->at(i)->label())
      return false;
    webrtc::AudioTracks* audio_tracks1 = s1->at(i)->audio_tracks();
    webrtc::AudioTracks* audio_tracks2 = s2->at(i)->audio_tracks();
    webrtc::VideoTracks* video_tracks1 = s1->at(i)->video_tracks();
    webrtc::VideoTracks* video_tracks2 = s2->at(i)->video_tracks();

    if (audio_tracks1->count() != audio_tracks2->count())
      return false;
    for (size_t j = 0; j != audio_tracks1->count(); ++j) {
       if (audio_tracks1->at(j)->label() != audio_tracks2->at(j)->label())
         return false;
    }
    if (video_tracks1->count() != video_tracks2->count())
      return false;
    for (size_t j = 0; j != video_tracks1->count(); ++j) {
       if (video_tracks1->at(j)->label() != video_tracks2->at(j)->label())
         return false;
    }
  }
  return true;
}

// MockRemoteStreamObserver implements functions for listening to
// callbacks about added and removed remote MediaStreams.
class MockRemoteStreamObserver : public webrtc::RemoteMediaStreamObserver {
 public:
  MockRemoteStreamObserver()
      : remote_media_streams_(StreamCollection::Create()) {
  }

  virtual ~MockRemoteStreamObserver() {
  }

  // New remote stream have been discovered.
  virtual void OnAddStream(MediaStreamInterface* remote_stream) {
    EXPECT_EQ(MediaStreamInterface::kLive, remote_stream->ready_state());
    remote_media_streams_->AddStream(remote_stream);
  }

  // Remote stream is no longer available.
  virtual void OnRemoveStream(MediaStreamInterface* remote_stream) {
    EXPECT_EQ(MediaStreamInterface::kEnded, remote_stream->ready_state());
    remote_media_streams_->RemoveStream(remote_stream);
  }

  MediaStreamInterface* RemoteStream(const std::string& label) {
    return remote_media_streams_->find(label);
  }

  StreamCollectionInterface* remote_streams() const {
    return remote_media_streams_;
  }

 private:
  talk_base::scoped_refptr<StreamCollection> remote_media_streams_;
};

class MediaStreamSignalingForTest : public webrtc::MediaStreamSignaling {
 public:
  explicit MediaStreamSignalingForTest(MockRemoteStreamObserver* observer)
      : webrtc::MediaStreamSignaling(talk_base::Thread::Current(), observer) {
  };
  using webrtc::MediaStreamSignaling::SetLocalStreams;
  using webrtc::MediaStreamSignaling::GetMediaSessionOptions;
  using webrtc::MediaStreamSignaling::UpdateRemoteStreams;
  using webrtc::MediaStreamSignaling::remote_streams;
};

class MediaStreamSignalingTest: public testing::Test {
 protected:
  virtual void SetUp() {
    observer_.reset(new MockRemoteStreamObserver());
    signaling_.reset(new MediaStreamSignalingForTest(observer_.get()));
  }

  talk_base::scoped_ptr<MockRemoteStreamObserver> observer_;
  talk_base::scoped_ptr<MediaStreamSignalingForTest> signaling_;

  void TestGetMediaSessionOptions(const webrtc::MediaHints& hints,
                                  StreamCollectionInterface* streams) {
    signaling_->SetLocalStreams(streams);
    cricket::MediaSessionOptions options =
        signaling_->GetMediaSessionOptions(hints);
    VerifyMediaOptions(streams, hints, options);
  }
};

TEST_F(MediaStreamSignalingTest, AudioVideoHints) {
  webrtc::MediaHints hints;
  talk_base::scoped_refptr<StreamCollection> local_streams(
      CreateStreamCollection(1));
  TestGetMediaSessionOptions(hints, local_streams.get());
}

TEST_F(MediaStreamSignalingTest, AudioHints) {
  webrtc::MediaHints hints(true, false);
  // Don't use all MediaStreams so we only create offer based on hints without
  // sending streams.
  TestGetMediaSessionOptions(hints, NULL);
}

TEST_F(MediaStreamSignalingTest, VideoHints) {
  webrtc::MediaHints hints(false, true);
  // Don't use all MediaStreams so we only create offer based on hints without
  // sending streams.
  TestGetMediaSessionOptions(hints, NULL);
}

TEST_F(MediaStreamSignalingTest, UpdateRemoteStreams) {
  SessionDescriptionInterface* desc = webrtc::CreateSessionDescription(
      kSdpString1);
  EXPECT_TRUE(desc != NULL);
  signaling_->UpdateRemoteStreams(desc);

  talk_base::scoped_refptr<StreamCollection> reference(
      CreateStreamCollection(1));
  EXPECT_TRUE(CompareStreamCollections(signaling_->remote_streams(),
                                       reference.get()));
  EXPECT_TRUE(CompareStreamCollections(observer_->remote_streams(),
                                       reference.get()));

  // Update the remote streams.
  SessionDescriptionInterface* update_desc =
      webrtc::CreateSessionDescription(kSdpString2);
  EXPECT_TRUE(update_desc != NULL);
  signaling_->UpdateRemoteStreams(update_desc);

  talk_base::scoped_refptr<StreamCollection> reference2(
      CreateStreamCollection(2));
  EXPECT_TRUE(CompareStreamCollections(signaling_->remote_streams(),
                                       reference2.get()));
  EXPECT_TRUE(CompareStreamCollections(observer_->remote_streams(),
                                       reference2.get()));
}
