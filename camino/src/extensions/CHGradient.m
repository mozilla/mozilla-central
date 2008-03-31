/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Camino code.
 *
 * The Initial Developer of the Original Code is
 * Stuart Morgan.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Morgan <stuart.morgan@alumni.case.edu>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#import "CHGradient.h"

// Callback function for CGShadingCreateAxial. Takes the start and end colors
// as an 8-element array in |inInfo| (start RGBA, end RGBA), and the fraction
// of the way through the gradient ([0.0 - 1.0]) as the one entry in |inData|,
// and returns the color for that location as a 4-element array (RGBA) through
// |outData|
static void GradientComputation(void* inInfo, float const* inData, float* outData)
{
  float* startColor = (float*)inInfo;
  float* endColor = startColor + 4;
  float interval = inData[0];
  for (int i = 0; i < 4; ++i)
    outData[i] = (1.0 - interval)*startColor[i] + interval*endColor[i];
}

@implementation CHGradient

- (id)initWithStartingColor:(NSColor*)startingColor
                endingColor:(NSColor*)endingColor
{
  if ((self = [super init])) {
    mStartingColor = [[startingColor colorUsingColorSpaceName:NSDeviceRGBColorSpace] retain];
    mEndingColor = [[endingColor colorUsingColorSpaceName:NSDeviceRGBColorSpace] retain];
  }
  return self;
}

- (void)dealloc
{
  [mStartingColor release];
  [mEndingColor release];
  [super dealloc];
}

- (void)drawInRect:(NSRect)rect angle:(float)angle
{
  float colors[8];
  [mStartingColor getRed:&colors[0] green:&colors[1] blue:&colors[2] alpha:&colors[3]];
  [mEndingColor getRed:&colors[4] green:&colors[5] blue:&colors[6] alpha:&colors[7]];

  CGPoint startPoint, endPoint;
  if (angle < 1.0) {
    startPoint = CGPointMake(NSMinX(rect), NSMinY(rect));
    endPoint = CGPointMake(NSMaxX(rect), NSMinY(rect));
  }
  else if (angle < 91.0) {
    startPoint = CGPointMake(NSMinX(rect), NSMinY(rect));
    endPoint = CGPointMake(NSMinX(rect), NSMaxY(rect));
  }
  else if (angle < 181.0) {
    startPoint = CGPointMake(NSMaxX(rect), NSMinY(rect));
    endPoint = CGPointMake(NSMinX(rect), NSMinY(rect));
  }
  else {
    startPoint = CGPointMake(NSMinX(rect), NSMaxY(rect));
    endPoint = CGPointMake(NSMinX(rect), NSMinY(rect));
  }

  struct CGFunctionCallbacks callbacks = {0, GradientComputation, NULL};
  CGFunctionRef function = CGFunctionCreate(colors, 1, NULL, 4, NULL,
                                            &callbacks);
  
  CGColorSpaceRef colorspace = CGColorSpaceCreateWithName(kCGColorSpaceGenericRGB);
  CGShadingRef shading = CGShadingCreateAxial(colorspace,
                                              startPoint,
                                              endPoint,
                                              function, false, false);
  CGContextRef context = (CGContextRef)[[NSGraphicsContext currentContext] graphicsPort];

  CGContextSaveGState(context);
  CGContextClipToRect(context, CGRectMake(rect.origin.x, rect.origin.y,
                                          rect.size.width, rect.size.height));
  CGContextDrawShading(context, shading);
  CGContextRestoreGState(context);

  CGShadingRelease(shading);
  CGColorSpaceRelease(colorspace);
  CGFunctionRelease(function);
}

@end
