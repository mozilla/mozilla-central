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

#include "talk/session/phone/channelmanager.h"

#ifdef HAVE_CONFIG_H
#include <config.h>
#endif

#include <algorithm>

#include "talk/base/common.h"
#include "talk/base/logging.h"
#include "talk/base/sigslotrepeater.h"
#include "talk/base/stringencode.h"
#include "talk/session/phone/dataengine.h"
#include "talk/session/phone/soundclip.h"
#include "talk/session/phone/videocapturer.h"

namespace cricket {

enum {
  MSG_CREATEVOICECHANNEL = 1,
  MSG_DESTROYVOICECHANNEL = 2,
  MSG_SETAUDIOOPTIONS = 3,
  MSG_GETOUTPUTVOLUME = 4,
  MSG_SETOUTPUTVOLUME = 5,
  MSG_SETLOCALMONITOR = 6,
  MSG_SETVOICELOGGING = 7,
  MSG_CREATEVIDEOCHANNEL = 11,
  MSG_DESTROYVIDEOCHANNEL = 12,
  MSG_SETVIDEOOPTIONS = 13,
  MSG_SETLOCALRENDERER = 14,
  MSG_SETDEFAULTVIDEOENCODERCONFIG = 15,
  MSG_SETVIDEOLOGGING = 16,
  MSG_CREATESOUNDCLIP = 17,
  MSG_DESTROYSOUNDCLIP = 18,
  MSG_CAMERASTARTED = 19,
  MSG_SETVIDEOCAPTURE = 20,
  MSG_TERMINATE = 21,
  MSG_REGISTERVIDEOPROCESSOR = 22,
  MSG_UNREGISTERVIDEOPROCESSOR = 23,
  MSG_REGISTERVOICEPROCESSOR = 24,
  MSG_UNREGISTERVOICEPROCESSOR = 25,
  MSG_SETVIDEOCAPTURER = 26,
  MSG_CREATEDATACHANNEL = 27,
  MSG_DESTROYDATACHANNEL = 28,
};

static const int kNotSetOutputVolume = -1;

struct CreationParams : public talk_base::MessageData {
  CreationParams(BaseSession* session, const std::string& content_name,
                 bool rtcp, VoiceChannel* voice_channel)
      : session(session),
        content_name(content_name),
        rtcp(rtcp),
        voice_channel(voice_channel),
        video_channel(NULL),
        data_channel(NULL) {
  }
  BaseSession* session;
  std::string content_name;
  bool rtcp;
  VoiceChannel* voice_channel;
  VideoChannel* video_channel;
  DataChannel* data_channel;
};

struct AudioOptions : public talk_base::MessageData {
  AudioOptions(int o, const Device* in, const Device* out)
      : options(o), in_device(in), out_device(out) {}
  int options;
  const Device* in_device;
  const Device* out_device;
  bool result;
};

struct VolumeLevel : public talk_base::MessageData {
  VolumeLevel() : level(-1), result(false) {}
  explicit VolumeLevel(int l) : level(l), result(false) {}
  int level;
  bool result;
};

struct VideoOptions : public talk_base::MessageData {
  explicit VideoOptions(const Device* d) : cam_device(d), result(false) {}
  const Device* cam_device;
  bool result;
};

struct DefaultVideoEncoderConfig : public talk_base::MessageData {
  explicit DefaultVideoEncoderConfig(const VideoEncoderConfig& c)
      : config(c), result(false) {}
  VideoEncoderConfig config;
  bool result;
};

struct LocalMonitor : public talk_base::MessageData {
  explicit LocalMonitor(bool e) : enable(e), result(false) {}
  bool enable;
  bool result;
};

struct LocalRenderer : public talk_base::MessageData {
  explicit LocalRenderer(VideoRenderer* r) : renderer(r), result(false) {}
  VideoRenderer* renderer;
  bool result;
};

struct Capturer : public talk_base::MessageData {
  Capturer(VideoCapturer* c)
      : capturer(c),
        result(false) {}
  VideoCapturer* capturer;
  bool result;
};

struct LoggingOptions : public talk_base::MessageData {
  explicit LoggingOptions(int lev, const char* f) : level(lev), filter(f) {}
  int level;
  std::string filter;
};

struct CaptureParams : public talk_base::MessageData {
  explicit CaptureParams(bool c) : capture(c), result(CR_FAILURE) {}
  bool capture;
  CaptureResult result;
};

struct VideoProcessorParams : public talk_base::MessageData {
  VideoProcessorParams(uint32 s, VideoProcessor* p)
      : ssrc(s), processor(p), result(false) {}
  uint32 ssrc;
  VideoProcessor* processor;
  bool result;
};

struct VoiceProcessorParams : public talk_base::MessageData {
  VoiceProcessorParams(uint32 c, VoiceProcessor* p, MediaProcessorDirection d)
      : ssrc(c), direction(d), processor(p), result(false) {}
  uint32 ssrc;
  MediaProcessorDirection direction;
  VoiceProcessor* processor;
  bool result;
};

ChannelManager::ChannelManager(talk_base::Thread* worker_thread) {
  Construct(MediaEngineFactory::Create(),
            new DataEngine(),
            cricket::DeviceManagerFactory::Create(),
            worker_thread);
}

ChannelManager::ChannelManager(MediaEngineInterface* me,
                               DataEngineInterface* dme,
                               DeviceManagerInterface* dm,
                               talk_base::Thread* worker_thread) {
  Construct(me, dme, dm, worker_thread);
}

ChannelManager::ChannelManager(MediaEngineInterface* me,
                               DeviceManagerInterface* dm,
                               talk_base::Thread* worker_thread) {
  Construct(me, new DataEngine(), dm, worker_thread);
}

void ChannelManager::Construct(MediaEngineInterface* me,
                               DataEngineInterface* dme,
                               DeviceManagerInterface* dm,
                               talk_base::Thread* worker_thread) {
  media_engine_.reset(me);
  data_media_engine_.reset(dme);
  device_manager_.reset(dm);
  initialized_ = false;
  main_thread_ = talk_base::Thread::Current();
  worker_thread_ = worker_thread;
  audio_in_device_ = DeviceManagerInterface::kDefaultDeviceName;
  audio_out_device_ = DeviceManagerInterface::kDefaultDeviceName;
  audio_options_ = MediaEngineInterface::DEFAULT_AUDIO_OPTIONS;
  audio_output_volume_ = kNotSetOutputVolume;
  local_renderer_ = NULL;
  capturing_ = false;
  monitoring_ = false;

  // Init the device manager immediately, and set up our default video device.
  SignalDevicesChange.repeat(device_manager_->SignalDevicesChange);
  device_manager_->Init();

  // Camera is started asynchronously, request callbacks when startup
  // completes to be able to forward them to the rendering manager.
  media_engine_->SignalVideoCaptureResult.connect(
      this, &ChannelManager::OnVideoCaptureResult);
}

ChannelManager::~ChannelManager() {
  if (initialized_)
    Terminate();
}

int ChannelManager::GetCapabilities() {
  return media_engine_->GetCapabilities() & device_manager_->GetCapabilities();
}

void ChannelManager::GetSupportedAudioCodecs(
    std::vector<AudioCodec>* codecs) const {
  codecs->clear();

  for (std::vector<AudioCodec>::const_iterator it =
           media_engine_->audio_codecs().begin();
      it != media_engine_->audio_codecs().end(); ++it) {
    codecs->push_back(*it);
  }
}

void ChannelManager::GetSupportedVideoCodecs(
    std::vector<VideoCodec>* codecs) const {
  codecs->clear();

  std::vector<VideoCodec>::const_iterator it;
  for (it = media_engine_->video_codecs().begin();
      it != media_engine_->video_codecs().end(); ++it) {
    codecs->push_back(*it);
  }
}

void ChannelManager::GetSupportedDataCodecs(
    std::vector<DataCodec>* codecs) const {
  *codecs = data_media_engine_->data_codecs();
}

bool ChannelManager::Init() {
  ASSERT(!initialized_);
  if (initialized_) {
    return false;
  }

  ASSERT(worker_thread_ != NULL);
  if (worker_thread_ && worker_thread_->started()) {
    if (media_engine_->Init()) {
      initialized_ = true;

      // Now that we're initialized, apply any stored preferences. A preferred
      // device might have been unplugged. In this case, we fallback to the
      // default device but keep the user preferences. The preferences are
      // changed only when the Javascript FE changes them.
      const std::string preferred_audio_in_device = audio_in_device_;
      const std::string preferred_audio_out_device = audio_out_device_;
      const std::string preferred_camera_device = camera_device_;
      Device device;
      if (!device_manager_->GetAudioInputDevice(audio_in_device_, &device)) {
        LOG(LS_WARNING) << "The preferred microphone '" << audio_in_device_
                        << "' is unavailable. Fall back to the default.";
        audio_in_device_ = DeviceManagerInterface::kDefaultDeviceName;
      }
      if (!device_manager_->GetAudioOutputDevice(audio_out_device_, &device)) {
        LOG(LS_WARNING) << "The preferred speaker '" << audio_out_device_
                        << "' is unavailable. Fall back to the default.";
        audio_out_device_ = DeviceManagerInterface::kDefaultDeviceName;
      }
      if (!device_manager_->GetVideoCaptureDevice(camera_device_, &device)) {
        if (!camera_device_.empty()) {
          LOG(LS_WARNING) << "The preferred camera '" << camera_device_
                          << "' is unavailable. Fall back to the default.";
        }
        camera_device_ = DeviceManagerInterface::kDefaultDeviceName;
      }

      if (!SetAudioOptions(audio_in_device_, audio_out_device_,
                           audio_options_)) {
        LOG(LS_WARNING) << "Failed to SetAudioOptions with"
                        << " microphone: " << audio_in_device_
                        << " speaker: " << audio_out_device_
                        << " options: " << audio_options_;
      }

      // If audio_output_volume_ has been set via SetOutputVolume(), set the
      // audio output volume of the engine.
      if (kNotSetOutputVolume != audio_output_volume_ &&
          !SetOutputVolume(audio_output_volume_)) {
        LOG(LS_WARNING) << "Failed to SetOutputVolume to "
                        << audio_output_volume_;
      }
      if (!SetVideoOptions(camera_device_) && !camera_device_.empty()) {
        LOG(LS_WARNING) << "Failed to SetVideoOptions with camera: "
                        << camera_device_;
      }

      // Restore the user preferences.
      audio_in_device_ = preferred_audio_in_device;
      audio_out_device_ = preferred_audio_out_device;
      camera_device_ = preferred_camera_device;

      // Now apply the default video codec that has been set earlier.
      if (default_video_encoder_config_.max_codec.id != 0) {
        SetDefaultVideoEncoderConfig(default_video_encoder_config_);
      }
      // And the local renderer.
      if (local_renderer_) {
        SetLocalRenderer(local_renderer_);
      }
    }
  }
  return initialized_;
}

void ChannelManager::Terminate() {
  ASSERT(initialized_);
  if (!initialized_) {
    return;
  }
  Send(MSG_TERMINATE, NULL);
  media_engine_->Terminate();
  initialized_ = false;
}

void ChannelManager::Terminate_w() {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
    // Need to destroy the voice/video channels
  while (!video_channels_.empty()) {
    DestroyVideoChannel_w(video_channels_.back());
  }
  while (!voice_channels_.empty()) {
    DestroyVoiceChannel_w(voice_channels_.back());
  }
  while (!soundclips_.empty()) {
    DestroySoundclip_w(soundclips_.back());
  }
  if (!SetVideoOptions_w(NULL)) {
    LOG(LS_WARNING) << "failed to delete video capturer";
  }
}

VoiceChannel* ChannelManager::CreateVoiceChannel(
    BaseSession* session, const std::string& content_name, bool rtcp) {
  CreationParams params(session, content_name, rtcp, NULL);
  return (Send(MSG_CREATEVOICECHANNEL, &params)) ? params.voice_channel : NULL;
}

VoiceChannel* ChannelManager::CreateVoiceChannel_w(
    BaseSession* session, const std::string& content_name, bool rtcp) {
  // This is ok to alloc from a thread other than the worker thread
  ASSERT(initialized_);
  VoiceMediaChannel* media_channel = media_engine_->CreateChannel();
  if (media_channel == NULL)
    return NULL;

  VoiceChannel* voice_channel = new VoiceChannel(
      worker_thread_, media_engine_.get(), media_channel,
      session, content_name, rtcp);
  if (!voice_channel->Init()) {
    delete voice_channel;
    return NULL;
  }
  voice_channels_.push_back(voice_channel);
  return voice_channel;
}

void ChannelManager::DestroyVoiceChannel(VoiceChannel* voice_channel) {
  if (voice_channel) {
    talk_base::TypedMessageData<VoiceChannel*> data(voice_channel);
    Send(MSG_DESTROYVOICECHANNEL, &data);
  }
}

void ChannelManager::DestroyVoiceChannel_w(VoiceChannel* voice_channel) {
  // Destroy voice channel.
  ASSERT(initialized_);
  VoiceChannels::iterator it = std::find(voice_channels_.begin(),
      voice_channels_.end(), voice_channel);
  ASSERT(it != voice_channels_.end());
  if (it == voice_channels_.end())
    return;

  voice_channels_.erase(it);
  delete voice_channel;
}

VideoChannel* ChannelManager::CreateVideoChannel(
    BaseSession* session, const std::string& content_name, bool rtcp,
    VoiceChannel* voice_channel) {
  CreationParams params(session, content_name, rtcp, voice_channel);
  return (Send(MSG_CREATEVIDEOCHANNEL, &params)) ? params.video_channel : NULL;
}

VideoChannel* ChannelManager::CreateVideoChannel_w(
    BaseSession* session, const std::string& content_name, bool rtcp,
    VoiceChannel* voice_channel) {
  // This is ok to alloc from a thread other than the worker thread
  ASSERT(initialized_);
  VideoMediaChannel* media_channel =
      // voice_channel can be NULL in case of NullVoiceEngine.
      media_engine_->CreateVideoChannel(voice_channel ?
          voice_channel->media_channel() : NULL);
  if (media_channel == NULL)
    return NULL;

  VideoChannel* video_channel = new VideoChannel(
      worker_thread_, media_engine_.get(), media_channel,
      session, content_name, rtcp, voice_channel);
  if (!video_channel->Init()) {
    delete video_channel;
    return NULL;
  }
  video_channels_.push_back(video_channel);
  return video_channel;
}

void ChannelManager::DestroyVideoChannel(VideoChannel* video_channel) {
  if (video_channel) {
    talk_base::TypedMessageData<VideoChannel*> data(video_channel);
    Send(MSG_DESTROYVIDEOCHANNEL, &data);
  }
}

void ChannelManager::DestroyVideoChannel_w(VideoChannel* video_channel) {
  // Destroy video channel.
  ASSERT(initialized_);
  VideoChannels::iterator it = std::find(video_channels_.begin(),
      video_channels_.end(), video_channel);
  ASSERT(it != video_channels_.end());
  if (it == video_channels_.end())
    return;

  video_channels_.erase(it);
  delete video_channel;
}

DataChannel* ChannelManager::CreateDataChannel(
    BaseSession* session, const std::string& content_name, bool rtcp) {
  CreationParams params(session, content_name, rtcp, NULL);
  return (Send(MSG_CREATEDATACHANNEL, &params)) ? params.data_channel : NULL;
}

DataChannel* ChannelManager::CreateDataChannel_w(
    BaseSession* session, const std::string& content_name, bool rtcp) {
  // This is ok to alloc from a thread other than the worker thread.
  ASSERT(initialized_);
  DataMediaChannel* media_channel = data_media_engine_->CreateChannel();
  DataChannel* data_channel = new DataChannel(
      worker_thread_, media_channel,
      session, content_name, rtcp);
  if (!data_channel->Init()) {
    LOG(LS_WARNING) << "Failed to init data channel.";
    delete data_channel;
    return NULL;
  }
  data_channels_.push_back(data_channel);
  return data_channel;
}

void ChannelManager::DestroyDataChannel(DataChannel* data_channel) {
  if (data_channel) {
    talk_base::TypedMessageData<DataChannel*> data(data_channel);
    Send(MSG_DESTROYDATACHANNEL, &data);
  }
}

void ChannelManager::DestroyDataChannel_w(DataChannel* data_channel) {
  // Destroy data channel.
  ASSERT(initialized_);
  DataChannels::iterator it = std::find(data_channels_.begin(),
      data_channels_.end(), data_channel);
  ASSERT(it != data_channels_.end());
  if (it == data_channels_.end())
    return;

  data_channels_.erase(it);
  delete data_channel;
}

Soundclip* ChannelManager::CreateSoundclip() {
  talk_base::TypedMessageData<Soundclip*> data(NULL);
  Send(MSG_CREATESOUNDCLIP, &data);
  return data.data();
}

Soundclip* ChannelManager::CreateSoundclip_w() {
  ASSERT(initialized_);
  ASSERT(worker_thread_ == talk_base::Thread::Current());

  SoundclipMedia* soundclip_media = media_engine_->CreateSoundclip();
  if (!soundclip_media) {
    return NULL;
  }

  Soundclip* soundclip = new Soundclip(worker_thread_, soundclip_media);
  soundclips_.push_back(soundclip);
  return soundclip;
}

void ChannelManager::DestroySoundclip(Soundclip* soundclip) {
  if (soundclip) {
    talk_base::TypedMessageData<Soundclip*> data(soundclip);
    Send(MSG_DESTROYSOUNDCLIP, &data);
  }
}

void ChannelManager::DestroySoundclip_w(Soundclip* soundclip) {
  // Destroy soundclip.
  ASSERT(initialized_);
  Soundclips::iterator it = std::find(soundclips_.begin(),
      soundclips_.end(), soundclip);
  ASSERT(it != soundclips_.end());
  if (it == soundclips_.end())
    return;

  soundclips_.erase(it);
  delete soundclip;
}

bool ChannelManager::GetAudioOptions(std::string* in_name,
                                     std::string* out_name, int* opts) {
  *in_name = audio_in_device_;
  *out_name = audio_out_device_;
  *opts = audio_options_;
  return true;
}

bool ChannelManager::SetAudioOptions(const std::string& in_name,
                                     const std::string& out_name, int opts) {
  // Get device ids from DeviceManager.
  Device in_dev, out_dev;
  if (!device_manager_->GetAudioInputDevice(in_name, &in_dev)) {
    LOG(LS_WARNING) << "Failed to GetAudioInputDevice: " << in_name;
    return false;
  }
  if (!device_manager_->GetAudioOutputDevice(out_name, &out_dev)) {
    LOG(LS_WARNING) << "Failed to GetAudioOutputDevice: " << out_name;
    return false;
  }

  // If we're initialized, pass the settings to the media engine.
  bool ret = true;
  if (initialized_) {
    AudioOptions options(opts, &in_dev, &out_dev);
    ret = (Send(MSG_SETAUDIOOPTIONS, &options) && options.result);
  }

  // If all worked well, save the values for use in GetAudioOptions.
  if (ret) {
    audio_options_ = opts;
    audio_in_device_ = in_name;
    audio_out_device_ = out_name;
  }
  return ret;
}

bool ChannelManager::SetAudioOptions_w(int opts, const Device* in_dev,
    const Device* out_dev) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);

  // Set audio options
  bool ret = media_engine_->SetAudioOptions(opts);

  // Set the audio devices
  if (ret) {
    ret = media_engine_->SetSoundDevices(in_dev, out_dev);
  }

  return ret;
}

bool ChannelManager::GetOutputVolume(int* level) {
  VolumeLevel volume;
  if (!Send(MSG_GETOUTPUTVOLUME, &volume) || !volume.result) {
    return false;
  }

  *level = volume.level;
  return true;
}

bool ChannelManager::GetOutputVolume_w(int* level) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->GetOutputVolume(level);
}

bool ChannelManager::SetOutputVolume(int level) {
  bool ret = level >= 0 && level <= 255;
  if (initialized_) {
    VolumeLevel volume(level);
    ret &= Send(MSG_SETOUTPUTVOLUME, &volume) && volume.result;
  }

  if (ret) {
    audio_output_volume_ = level;
  }

  return ret;
}

bool ChannelManager::SetOutputVolume_w(int level) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->SetOutputVolume(level);
}

bool ChannelManager::GetVideoOptions(std::string* cam_name) {
  if (camera_device_.empty()) {
    // Initialize camera_device_ with default.
    Device device;
    if (!device_manager_->GetVideoCaptureDevice(
        DeviceManagerInterface::kDefaultDeviceName, &device)) {
      LOG(LS_WARNING) << "Device manager can't find default camera: " <<
          DeviceManagerInterface::kDefaultDeviceName;
      return false;
    }
    camera_device_ = device.name;
  }
  *cam_name = camera_device_;
  return true;
}

bool ChannelManager::SetVideoOptions(const std::string& cam_name) {
  Device device;
  bool ret = true;
  if (!device_manager_->GetVideoCaptureDevice(cam_name, &device)) {
    if (!cam_name.empty()) {
      LOG(LS_WARNING) << "Device manager can't find camera: " << cam_name;
    }
    ret = false;
  }

  // If we're running, tell the media engine about it.
  if (initialized_ && ret) {
    VideoOptions options(&device);
    ret = (Send(MSG_SETVIDEOOPTIONS, &options) && options.result);
  }

  // If everything worked, retain the name of the selected camera.
  if (ret) {
    camera_device_ = device.name;
  } else if (camera_device_.empty()) {
    // When video option setting fails, we still want camera_device_ to be in a
    // good state, so we initialize it with default if it's empty.
    Device default_device;
    if (!device_manager_->GetVideoCaptureDevice(
        DeviceManagerInterface::kDefaultDeviceName, &default_device)) {
      LOG(LS_WARNING) << "Device manager can't find default camera: " <<
          DeviceManagerInterface::kDefaultDeviceName;
    }
    camera_device_ = default_device.name;
  }

  return ret;
}

bool ChannelManager::SetVideoOptions_w(const Device* cam_device) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);

  if (!cam_device) {
    video_device_name_.clear();
    media_engine_->SetVideoCapturer(NULL);
    video_capturer_.reset(NULL);
    LOG(LS_INFO) << "Camera set to NULL";
    return true;
  }

  // No need to do anything if the same device is passed more than once.
  if (video_capturer_.get() &&
      (video_capturer_->GetId() == cam_device->id)) {
    // No change, return success.
    return true;
  }
  VideoCapturer* video_capturer = device_manager_->CreateVideoCapturer(
      *cam_device);
  if (!video_capturer) {
    return false;
  }

  // Register the new video_capturer.
  if (!media_engine_->SetVideoCapturer(video_capturer)) {
    delete video_capturer;
    return false;
  }
  // Capturer successfully updated.
  video_capturer_.reset(video_capturer);
  video_device_name_ = cam_device->name;
  return true;
}

bool ChannelManager::SetDefaultVideoEncoderConfig(const VideoEncoderConfig& c) {
  bool ret = true;
  if (initialized_) {
    DefaultVideoEncoderConfig config(c);
    ret = Send(MSG_SETDEFAULTVIDEOENCODERCONFIG, &config) && config.result;
  }
  if (ret) {
    default_video_encoder_config_ = c;
  }
  return ret;
}

bool ChannelManager::SetDefaultVideoEncoderConfig_w(
    const VideoEncoderConfig& c) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->SetDefaultVideoEncoderConfig(c);
}

bool ChannelManager::SetLocalMonitor(bool enable) {
  LocalMonitor monitor(enable);
  bool ret = Send(MSG_SETLOCALMONITOR, &monitor) && monitor.result;
  if (ret) {
    monitoring_ = enable;
  }
  return ret;
}

bool ChannelManager::SetLocalMonitor_w(bool enable) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->SetLocalMonitor(enable);
}

bool ChannelManager::SetLocalRenderer(VideoRenderer* renderer) {
  bool ret = true;
  if (initialized_) {
    LocalRenderer local(renderer);
    ret = (Send(MSG_SETLOCALRENDERER, &local) && local.result);
  }
  if (ret) {
    local_renderer_ = renderer;
  }
  return ret;
}

bool ChannelManager::SetLocalRenderer_w(VideoRenderer* renderer) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->SetLocalRenderer(renderer);
}

bool ChannelManager::SetVideoCapturer(VideoCapturer* capturer) {
  bool ret = true;
  if (initialized_) {
    Capturer capture(capturer);
    ret = (Send(MSG_SETVIDEOCAPTURER, &capture) && capture.result);
  }
  return ret;
}

bool ChannelManager::SetVideoCapturer_w(VideoCapturer* capturer) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->SetVideoCapturer(capturer);
}

CaptureResult ChannelManager::SetVideoCapture(bool capture) {
  bool ret;
  CaptureParams capture_params(capture);
  ret = (Send(MSG_SETVIDEOCAPTURE, &capture_params) &&
         (capture_params.result != CR_FAILURE));
  if (ret) {
    capturing_ = capture;
  }
  return capture_params.result;
}

CaptureResult ChannelManager::SetVideoCapture_w(bool capture) {
  ASSERT(worker_thread_ == talk_base::Thread::Current());
  ASSERT(initialized_);
  return media_engine_->SetVideoCapture(capture);
}

void ChannelManager::SetVoiceLogging(int level, const char* filter) {
  SetMediaLogging(false, level, filter);
}

void ChannelManager::SetVideoLogging(int level, const char* filter) {
  SetMediaLogging(true, level, filter);
}

void ChannelManager::SetMediaLogging(bool video, int level,
                                     const char* filter) {
  // Can be called before initialization; in this case, the worker function
  // is simply called on the main thread.
  if (initialized_) {
    LoggingOptions options(level, filter);
    Send((video) ? MSG_SETVIDEOLOGGING : MSG_SETVOICELOGGING, &options);
  } else {
    SetMediaLogging_w(video, level, filter);
  }
}

void ChannelManager::SetMediaLogging_w(bool video, int level,
                                       const char* filter) {
  // Can be called before initialization
  ASSERT(worker_thread_ == talk_base::Thread::Current() || !initialized_);
  if (video) {
    media_engine_->SetVideoLogging(level, filter);
  } else {
    media_engine_->SetVoiceLogging(level, filter);
  }
}

// TODO: For now pass this request through the mediaengine to the
// voice and video engines to do the real work. Once the capturer refactoring
// is done, we will access the capturer using the ssrc (similar to how the
// renderer is accessed today) and register with it directly.
bool ChannelManager::RegisterVideoProcessor(uint32 ssrc,
                                            VideoProcessor* processor) {
  VideoProcessorParams processor_params(ssrc, processor);
  return (Send(MSG_REGISTERVIDEOPROCESSOR, &processor_params) &&
      processor_params.result);
}
bool ChannelManager::RegisterVideoProcessor_w(uint32 ssrc,
                                              VideoProcessor* processor) {
  return media_engine_->RegisterVideoProcessor(processor);
}

bool ChannelManager::UnregisterVideoProcessor(uint32 ssrc,
                                              VideoProcessor* processor) {
  VideoProcessorParams processor_params(ssrc, processor);
  return (Send(MSG_UNREGISTERVIDEOPROCESSOR, &processor_params) &&
      processor_params.result);
}
bool ChannelManager::UnregisterVideoProcessor_w(uint32 ssrc,
                                                VideoProcessor* processor) {
  return media_engine_->UnregisterVideoProcessor(processor);
}

bool ChannelManager::RegisterVoiceProcessor(
    uint32 ssrc,
    VoiceProcessor* processor,
    MediaProcessorDirection direction) {
  VoiceProcessorParams processor_params(ssrc, processor, direction);
  return (Send(MSG_REGISTERVOICEPROCESSOR, &processor_params) &&
      processor_params.result);
}
bool ChannelManager::RegisterVoiceProcessor_w(
    uint32 ssrc,
    VoiceProcessor* processor,
    MediaProcessorDirection direction) {
  return media_engine_->RegisterVoiceProcessor(ssrc, processor, direction);
}

bool ChannelManager::UnregisterVoiceProcessor(
    uint32 ssrc,
    VoiceProcessor* processor,
    MediaProcessorDirection direction) {
  VoiceProcessorParams processor_params(ssrc, processor, direction);
  return (Send(MSG_UNREGISTERVOICEPROCESSOR, &processor_params) &&
      processor_params.result);
}
bool ChannelManager::UnregisterVoiceProcessor_w(
    uint32 ssrc,
    VoiceProcessor* processor,
    MediaProcessorDirection direction) {
  return media_engine_->UnregisterVoiceProcessor(ssrc, processor, direction);
}

bool ChannelManager::Send(uint32 id, talk_base::MessageData* data) {
  if (!worker_thread_ || !initialized_) return false;
  worker_thread_->Send(this, id, data);
  return true;
}

void ChannelManager::OnVideoCaptureResult(VideoCapturer* capturer,
                                          CaptureResult result) {
  // TODO: Check capturer and signal failure only for camera video, not
  // screencast.
  capturing_ = result == CR_SUCCESS;
  main_thread_->Post(this, MSG_CAMERASTARTED,
                     new talk_base::TypedMessageData<CaptureResult>(result));
}

void ChannelManager::OnMessage(talk_base::Message* message) {
  talk_base::MessageData* data = message->pdata;
  switch (message->message_id) {
    case MSG_CREATEVOICECHANNEL: {
      CreationParams* p = static_cast<CreationParams*>(data);
      p->voice_channel =
          CreateVoiceChannel_w(p->session, p->content_name, p->rtcp);
      break;
    }
    case MSG_DESTROYVOICECHANNEL: {
      VoiceChannel* p = static_cast<talk_base::TypedMessageData<VoiceChannel*>*>
          (data)->data();
      DestroyVoiceChannel_w(p);
      break;
    }
    case MSG_CREATEVIDEOCHANNEL: {
      CreationParams* p = static_cast<CreationParams*>(data);
      p->video_channel = CreateVideoChannel_w(p->session, p->content_name,
                                              p->rtcp, p->voice_channel);
      break;
    }
    case MSG_DESTROYVIDEOCHANNEL: {
      VideoChannel* p = static_cast<talk_base::TypedMessageData<VideoChannel*>*>
          (data)->data();
      DestroyVideoChannel_w(p);
      break;
    }
    case MSG_CREATEDATACHANNEL: {
      CreationParams* p = static_cast<CreationParams*>(data);
      p->data_channel =
          CreateDataChannel_w(p->session, p->content_name, p->rtcp);
      break;
    }
    case MSG_DESTROYDATACHANNEL: {
      DataChannel* p = static_cast<talk_base::TypedMessageData<DataChannel*>*>
          (data)->data();
      DestroyDataChannel_w(p);
      break;
    }
    case MSG_CREATESOUNDCLIP: {
      talk_base::TypedMessageData<Soundclip*> *p =
          static_cast<talk_base::TypedMessageData<Soundclip*>*>(data);
      p->data() = CreateSoundclip_w();
      break;
    }
    case MSG_DESTROYSOUNDCLIP: {
      talk_base::TypedMessageData<Soundclip*> *p =
          static_cast<talk_base::TypedMessageData<Soundclip*>*>(data);
      DestroySoundclip_w(p->data());
      break;
    }
    case MSG_SETAUDIOOPTIONS: {
      AudioOptions* p = static_cast<AudioOptions*>(data);
      p->result = SetAudioOptions_w(p->options,
                                    p->in_device, p->out_device);
      break;
    }
    case MSG_GETOUTPUTVOLUME: {
      VolumeLevel* p = static_cast<VolumeLevel*>(data);
      p->result = GetOutputVolume_w(&p->level);
      break;
    }
    case MSG_SETOUTPUTVOLUME: {
      VolumeLevel* p = static_cast<VolumeLevel*>(data);
      p->result = SetOutputVolume_w(p->level);
      break;
    }
    case MSG_SETLOCALMONITOR: {
      LocalMonitor* p = static_cast<LocalMonitor*>(data);
      p->result = SetLocalMonitor_w(p->enable);
      break;
    }
    case MSG_SETVIDEOOPTIONS: {
      VideoOptions* p = static_cast<VideoOptions*>(data);
      p->result = SetVideoOptions_w(p->cam_device);
      break;
    }
    case MSG_SETDEFAULTVIDEOENCODERCONFIG: {
      DefaultVideoEncoderConfig* p =
          static_cast<DefaultVideoEncoderConfig*>(data);
      p->result = SetDefaultVideoEncoderConfig_w(p->config);
      break;
    }
    case MSG_SETLOCALRENDERER: {
      LocalRenderer* p = static_cast<LocalRenderer*>(data);
      p->result = SetLocalRenderer_w(p->renderer);
      break;
    }
    case MSG_SETVIDEOCAPTURER: {
      Capturer* p = static_cast<Capturer*>(data);
      p->result = SetVideoCapturer_w(p->capturer);
      break;
    }
    case MSG_SETVIDEOCAPTURE: {
      CaptureParams* p = static_cast<CaptureParams*>(data);
      p->result = SetVideoCapture_w(p->capture);
      break;
    }
    case MSG_SETVOICELOGGING:
    case MSG_SETVIDEOLOGGING: {
      LoggingOptions* p = static_cast<LoggingOptions*>(data);
      bool video = (message->message_id == MSG_SETVIDEOLOGGING);
      SetMediaLogging_w(video, p->level, p->filter.c_str());
      break;
    }
    case MSG_CAMERASTARTED: {
      talk_base::TypedMessageData<CaptureResult>* data =
          static_cast<talk_base::TypedMessageData<CaptureResult>*>(
              message->pdata);
      SignalVideoCaptureResult(data->data());
      delete data;
      break;
    }
    case MSG_TERMINATE: {
      Terminate_w();
      break;
    }
    case MSG_REGISTERVIDEOPROCESSOR: {
      VideoProcessorParams* data =
          static_cast<VideoProcessorParams*>(message->pdata);
      data->result = RegisterVideoProcessor_w(data->ssrc, data->processor);
      break;
    }
    case MSG_UNREGISTERVIDEOPROCESSOR: {
      VideoProcessorParams* data =
          static_cast<VideoProcessorParams*>(message->pdata);
      data->result = UnregisterVideoProcessor_w(data->ssrc, data->processor);
      break;
    }
    case MSG_REGISTERVOICEPROCESSOR: {
      VoiceProcessorParams* data =
          static_cast<VoiceProcessorParams*>(message->pdata);
      data->result = RegisterVoiceProcessor_w(data->ssrc,
                                              data->processor,
                                              data->direction);
      break;
    }
    case MSG_UNREGISTERVOICEPROCESSOR: {
      VoiceProcessorParams* data =
          static_cast<VoiceProcessorParams*>(message->pdata);
      data->result = UnregisterVoiceProcessor_w(data->ssrc,
                                              data->processor,
                                              data->direction);
      break;
    }
  }
}

static void GetDeviceNames(const std::vector<Device>& devs,
                           std::vector<std::string>* names) {
  names->clear();
  for (size_t i = 0; i < devs.size(); ++i) {
    names->push_back(devs[i].name);
  }
}

bool ChannelManager::GetAudioInputDevices(std::vector<std::string>* names) {
  names->clear();
  std::vector<Device> devs;
  bool ret = device_manager_->GetAudioInputDevices(&devs);
  if (ret)
    GetDeviceNames(devs, names);

  return ret;
}

bool ChannelManager::GetAudioOutputDevices(std::vector<std::string>* names) {
  names->clear();
  std::vector<Device> devs;
  bool ret = device_manager_->GetAudioOutputDevices(&devs);
  if (ret)
    GetDeviceNames(devs, names);

  return ret;
}

bool ChannelManager::GetVideoCaptureDevices(std::vector<std::string>* names) {
  names->clear();
  std::vector<Device> devs;
  bool ret = device_manager_->GetVideoCaptureDevices(&devs);
  if (ret)
    GetDeviceNames(devs, names);

  return ret;
}

}  // namespace cricket
