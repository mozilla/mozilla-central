#ifndef GFX_2D_GLUE_H
#define GFX_2D_GLUE_H


#include "gfxRect.h"
#include "mozilla/gfx/Rect.h"

namespace mozilla {
namespace gfx {
class DrawTarget;
class SourceSurface;
class ScaledFont;
}
}

namespace mozilla {
namespace gfx {

inline Rect ToRect(const gfxRect &aRect)
{
  return Rect(Float(aRect.x), Float(aRect.y),
              Float(aRect.width), Float(aRect.height));
}

inline gfxRect GFXRect(const Rect &aRect)
{
  return gfxRect(aRect.x, aRect.y, aRect.width, aRect.height);
}

inline gfxASurface::gfxImageFormat SurfaceFormatToImageFormat(SurfaceFormat aFormat)
{
  switch (aFormat) {
  case FORMAT_B8G8R8A8:
    return gfxASurface::ImageFormatARGB32;
  case FORMAT_B8G8R8X8:
    return gfxASurface::ImageFormatRGB24;
  case FORMAT_R5G6B5:
    return gfxASurface::ImageFormatRGB16_565;
  case FORMAT_A8:
    return gfxASurface::ImageFormatA8;
  default:
    return gfxASurface::ImageFormatUnknown;
  }
}

inline gfxASurface::gfxContentType ContentForFormat(const SurfaceFormat &aFormat)
{
  switch (aFormat) {
  case FORMAT_B8G8R8X8:
    return gfxASurface::CONTENT_COLOR;
  case FORMAT_A8:
    return gfxASurface::CONTENT_ALPHA;
  default:
    return gfxASurface::CONTENT_COLOR_ALPHA;
  }
}

}
}

#endif
