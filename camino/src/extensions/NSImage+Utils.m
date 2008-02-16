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
 * The Original Code is Chimera code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
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

#import "NSImage+Utils.h"
#import <Cocoa/Cocoa.h>

@implementation NSImage (CaminoImageUtils)

- (void)drawTiledInRect:(NSRect)rect origin:(NSPoint)inOrigin operation:(NSCompositingOperation)inOperation
{
  NSGraphicsContext* gc = [NSGraphicsContext currentContext];
  [gc saveGraphicsState];

  [gc setPatternPhase:inOrigin];

  NSColor* patternColor = [NSColor colorWithPatternImage:self];
  [patternColor set];
  NSRectFillUsingOperation(rect, inOperation);

  [gc restoreGraphicsState];
}

- (NSImage*)imageByApplyingBadge:(NSImage*)badge withAlpha:(float)alpha scale:(float)scale;
{
  if (!badge)
    return self;

  // bad to actually change badge here  
  [badge setScalesWhenResized:YES];
  [badge setSize:NSMakeSize([self size].width * scale,[self size].height * scale)];

  // make a new image, copy over our best rep into it
  NSImage* newImage = [[[NSImage alloc] initWithSize:[self size]] autorelease];
  NSImageRep* imageRep = [[self bestRepresentationForDevice:nil] copy];
  [newImage addRepresentation:imageRep];
  [imageRep release];
  
  [newImage lockFocus];
  [[NSGraphicsContext currentContext] setImageInterpolation:NSImageInterpolationHigh];
  [badge dissolveToPoint:NSMakePoint([self size].width - [badge size].width, 0.0) fraction:alpha];
  [newImage unlockFocus];

  return newImage;
}

+ (NSImage*)dragImageWithIcon:(NSImage*)aIcon title:(NSString*)aTitle {
  if (!aIcon || !aTitle)
    return nil;

  const float kTitleOffset = 2.0f;

  NSDictionary* stringAttrs = [NSDictionary dictionaryWithObjectsAndKeys:
         [[NSColor textColor] colorWithAlphaComponent:0.8], NSForegroundColorAttributeName,
    [NSFont systemFontOfSize:[NSFont smallSystemFontSize]], NSFontAttributeName,
                                                      nil];

  // get the size of the new image we are creating
  NSSize titleSize = [aTitle sizeWithAttributes:stringAttrs];
  NSSize imageSize = NSMakeSize(titleSize.width + [aIcon size].width + kTitleOffset,
                                titleSize.height > [aIcon size].height ? titleSize.height
                                                                       : [aIcon size].height);

  // create the image and lock drawing focus on it
  NSImage* dragImage = [[[NSImage alloc] initWithSize:imageSize] autorelease];
  [dragImage lockFocus];

  // draw the image and title in image with translucency
  NSRect imageRect = NSMakeRect(0, 0, [aIcon size].width, [aIcon size].height);
  [aIcon drawAtPoint:NSMakePoint(0, 0) fromRect:imageRect operation:NSCompositeCopy fraction:0.8];

  [aTitle drawAtPoint:NSMakePoint([aIcon size].width + kTitleOffset, 0.0) withAttributes:stringAttrs];

  [dragImage unlockFocus];
  return dragImage;
}

@end
