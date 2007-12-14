/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Stuart Morgan
 * Portions created by the Initial Developer are Copyright (C) 2007
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

#import "TabButtonView.h"

#import "ImageAdditions.h"
#import "NSBezierPath+Utils.h"
#import "NSPasteboard+Utils.h"
#import "NSString+Utils.h"

#import "BrowserTabViewItem.h"
#import "BrowserWindowController.h"
#import "BrowserWrapper.h"
#import "RolloverImageButton.h"
#import "TruncatingTextAndImageCell.h"


static const int kTabLeftMargin = 4;
static const int kTabRightMargin = 4;
static const int kTabBottomPad = 4;      // unusable bottom space on the tab
static const int kTabCloseButtonPad = 2; // distance between close button and label
static const int kTabSelectOffset = 1;   // amount to drop everything down when selected

static NSImage* sTabLeft = nil;
static NSImage* sTabRight = nil;
static NSImage* sActiveTabBg = nil;
static NSImage* sTabMouseOverBg = nil;
static NSImage* sTabButtonDividerImage = nil;

@interface TabButtonView (Private)

- (void)repositionSubviews;
- (void)setDragTarget:(BOOL)isDragTarget;
+ (void)loadImages;

@end


@implementation TabButtonView

- (id)initWithFrame:(NSRect)frameRect andTabItem:(BrowserTabViewItem*)tabViewItem
{
  if ((self = [super initWithFrame:frameRect])) {
    mTabViewItem = (BrowserTabViewItem*)tabViewItem;

    mCloseButton = [[RolloverImageButton alloc] initWithFrame:NSMakeRect(0, 0, 16, 16)];
    [mCloseButton setTitle:NSLocalizedString(@"CloseTabButtonTitle", @"")];   // doesn't show, but used for accessibility
    [mCloseButton setImage:[BrowserTabViewItem closeIcon]];
    [mCloseButton setAlternateImage:[BrowserTabViewItem closeIconPressed]];
    [mCloseButton setHoverImage:[BrowserTabViewItem closeIconHover]];
    [mCloseButton setImagePosition:NSImageOnly];
    [mCloseButton setBezelStyle:NSShadowlessSquareBezelStyle];
    [mCloseButton setBordered:NO];
    [mCloseButton setButtonType:NSMomentaryChangeButton];
    [mCloseButton setTarget:mTabViewItem];
    [mCloseButton setAction:@selector(closeTab:)];
    [mCloseButton setAutoresizingMask:NSViewMinXMargin];
    [self addSubview:mCloseButton];

    mLabelCell = [[TruncatingTextAndImageCell alloc] init];
    [mLabelCell setControlSize:NSSmallControlSize];		// doesn't work?
    [mLabelCell setImagePadding:0.0];
    [mLabelCell setImageSpace:2.0];
    [mLabelCell setMaxImageHeight:[mCloseButton frame].size.height];

    mProgressWheel = [[NSProgressIndicator alloc] initWithFrame:NSMakeRect(0, 0, 16, 16)];
    [mProgressWheel setStyle:NSProgressIndicatorSpinningStyle];
    [mProgressWheel setUsesThreadedAnimation:YES];
    [mProgressWheel setDisplayedWhenStopped:NO];
    [mProgressWheel setAutoresizingMask:NSViewMaxXMargin];

    // Don't autoresize subviews since our subview layout isn't a function of
    // just our own frame
    [self setAutoresizesSubviews:NO];
    [self repositionSubviews];

    [self registerForDraggedTypes:[NSArray arrayWithObjects:
                                   kCaminoBookmarkListPBoardType, kWebURLsWithTitlesPboardType,
                                   NSStringPboardType, NSFilenamesPboardType, NSURLPboardType, nil]];
  }
  return self;
}

- (void)dealloc
{
  [self removeTrackingRect];
  [mLabelCell release];
  [mCloseButton release];
  [mProgressWheel removeFromSuperview];
  [mProgressWheel release];
  [super dealloc];
}

#pragma mark -

- (BrowserTabViewItem*)tabViewItem
{
  return mTabViewItem;
}

- (void)setLabel:(NSString*)label
{
  static NSDictionary* labelAttributes = nil;
  if (!labelAttributes) {
    NSMutableParagraphStyle *labelParagraphStyle = [[[NSMutableParagraphStyle alloc] init] autorelease];
    [labelParagraphStyle setParagraphStyle:[NSParagraphStyle defaultParagraphStyle]];
    [labelParagraphStyle setLineBreakMode:NSLineBreakByTruncatingMiddle];
    [labelParagraphStyle setAlignment:NSNaturalTextAlignment];

    NSFont *labelFont = [NSFont systemFontOfSize:[NSFont smallSystemFontSize]];
    labelAttributes  = [[NSDictionary alloc] initWithObjectsAndKeys:
                        labelFont, NSFontAttributeName,
                        labelParagraphStyle, NSParagraphStyleAttributeName,
                        nil];
  }

  NSAttributedString* labelString = [[[NSAttributedString alloc] initWithString:label
                                                                     attributes:labelAttributes] autorelease];
  [mLabelCell setAttributedStringValue:labelString];
  [self setToolTip:label];
  [self setNeedsDisplayInRect:mLabelRect];
}

- (void)setIcon:(NSImage *)newIcon isDraggable:(BOOL)draggable
{
  [mLabelCell setImage:newIcon];
  [mLabelCell setImageAlpha:(draggable ? 1.0 : 0.6)];
  [self setNeedsDisplayInRect:mLabelRect];
}

- (void)startLoadAnimation
{
  [mLabelCell addProgressIndicator:mProgressWheel];
  [mProgressWheel startAnimation:self];
  [self setNeedsDisplayInRect:mLabelRect];
}

- (void)stopLoadAnimation
{
  [mProgressWheel stopAnimation:self];
  [mLabelCell removeProgressIndicator];
  [self setNeedsDisplayInRect:mLabelRect];
}

-(void)setDrawsDivider:(BOOL)drawsDivider
{
  mNeedsDivider = drawsDivider;
}

- (void)setCloseButtonEnabled:(BOOL)isEnabled
{
  [mCloseButton setEnabled:isEnabled];
}

- (void)setMenu:(NSMenu *)aMenu
{
  // set the tag of every menu item to the tab view item's tag,
  // so that the target of the menu commands know which one they apply to.
  for (int i = 0; i < [aMenu numberOfItems]; i ++)
    [[aMenu itemAtIndex:i] setTag:[mTabViewItem tag]];

  [super setMenu:aMenu];
}

#pragma mark -

- (void)setFrame:(NSRect)frameRect
{
  [super setFrame:frameRect];
  [self repositionSubviews];
  [self setNeedsDisplay:YES];
}

// Note: if the tab drawing system ever changes such that the bar isn't rebuilt
// whenever the active tab changes (thus calling setFrame:), this will need be
// called when the tab is selected or unselected.
- (void)repositionSubviews
{
  const float kTextHeight = 15.0; // XXX this probably shouldn't be hard-coded

  // center based on the larger of the two heights if there's a difference
  NSRect tabRect = [self bounds];
  NSRect buttonRect = [mCloseButton frame];
  float maxHeight = kTextHeight > NSHeight(buttonRect) ? kTextHeight : NSHeight(buttonRect);
  buttonRect.origin = NSMakePoint(kTabLeftMargin,
                                 (int)((NSHeight(tabRect) - kTabBottomPad - maxHeight)/2.0 + kTabBottomPad));
  mLabelRect = NSMakeRect(NSMaxX(buttonRect) + kTabCloseButtonPad,
                          (int)((NSHeight(tabRect) - kTabBottomPad - maxHeight)/2.0 + kTabBottomPad),
                          NSWidth(tabRect) - (NSMaxX(buttonRect) + kTabCloseButtonPad + kTabRightMargin),
                          kTextHeight);

  if ([mTabViewItem tabState] == NSSelectedTab) {
    // move things down a little, to give the impression of being pulled forward
    mLabelRect.origin.y -= kTabSelectOffset;
    buttonRect.origin.y -= kTabSelectOffset;
  }

  [mCloseButton setFrame:buttonRect];
}

- (void)drawRect:(NSRect)rect
{
  if (!(sTabLeft && sTabRight && sActiveTabBg && sTabMouseOverBg && sTabButtonDividerImage))
    [TabButtonView loadImages];

  NSRect tabRect = [self bounds];

  if (mNeedsDivider) {
    tabRect.size.width -= [sTabButtonDividerImage size].width;
    NSPoint dividerOrigin = NSMakePoint(NSMaxX(tabRect), 0);
    [sTabButtonDividerImage compositeToPoint:dividerOrigin
                                   operation:NSCompositeSourceOver];
  }

  NSPoint patternOrigin = [self convertPoint:NSMakePoint(0, 0) toView:[[self window] contentView]];
  if ([mTabViewItem tabState] == NSSelectedTab) {
    // XXX would it be better to maintain a CGContext and do a real gradient here?
    // it sounds heavier, but I haven't tested to be sure. This looks just as nice so long as
    // the tabbar height is fixed.
    NSRect bgRect = tabRect;
    bgRect.origin.x += [sTabLeft size].width;
    bgRect.size.width -= ([sTabRight size].width + [sTabLeft size].width);
    [sActiveTabBg drawTiledInRect:tabRect origin:patternOrigin operation:NSCompositeSourceOver];
    [sTabLeft compositeToPoint:tabRect.origin operation:NSCompositeSourceOver];
    [sTabRight compositeToPoint:NSMakePoint(NSMaxX(bgRect), bgRect.origin.y) operation:NSCompositeSourceOver];
  } else if (mMouseWithin && !mIsDragTarget && [[self window] isKeyWindow]) {
    [sTabMouseOverBg drawTiledInRect:tabRect origin:patternOrigin operation:NSCompositeSourceOver];
  }
  // TODO: Make this look nicer
  if (mIsDragTarget) {
    NSRect dropFrame = tabRect;
    dropFrame.origin.y += kTabBottomPad;
    dropFrame.size.height -= kTabBottomPad;
    NSBezierPath* dropTargetOutline = [NSBezierPath bezierPathWithRoundCorneredRect:dropFrame
                                                                       cornerRadius:2.0f];
    [[[NSColor colorForControlTint:NSDefaultControlTint] colorWithAlphaComponent:0.5] set];
    [dropTargetOutline fill];
  }

  [mLabelCell drawInteriorWithFrame:mLabelRect inView:self];
}

#pragma mark -

- (void)viewWillMoveToWindow:(NSWindow*)window
{
  [self removeTrackingRect];
  [super viewWillMoveToWindow:window];
}

-(void)addTrackingRect
{
  if (mTrackingTag)
    [self removeTrackingRect];

  NSPoint mouseLocation = [[self window] convertScreenToBase:[NSEvent mouseLocation]];
  mouseLocation = [self convertPoint:mouseLocation fromView:nil];
  mMouseWithin = NSPointInRect(mouseLocation, [self bounds]);
  mTrackingTag = [self addTrackingRect:[self bounds]
                                  owner:self
                               userData:nil
                           assumeInside:mMouseWithin];
  if (mMouseWithin)
    [mCloseButton setTrackingEnabled:YES];
}

-(void)removeTrackingRect
{
  if (mTrackingTag)
    [self removeTrackingRect:mTrackingTag];
  mTrackingTag = 0;
  [mCloseButton setTrackingEnabled:NO];
}

-(void)updateHoverState:(BOOL)isHovered
{
  [mCloseButton setTrackingEnabled:isHovered];
  mMouseWithin = isHovered;
  [self setNeedsDisplay:YES];
}

- (void)mouseEntered:(NSEvent *)theEvent
{
  mMouseWithin = YES;
  // only act on the mouseEntered if the we are active or accept the first mouse click
  if ([[self window] isKeyWindow] || [self acceptsFirstMouse:theEvent]) {
    [mCloseButton setTrackingEnabled:YES];
    [self setNeedsDisplay:YES];
    // calling displayIfNeeded prevents the "lag" observed when displaying rollover events
    [self displayIfNeeded];
  }
}

- (void)mouseExited:(NSEvent*)theEvent
{
  mMouseWithin = NO;
  // only act on the mouseExited if the we are active or accept the first mouse click
  if ([[self window] isKeyWindow] || [self acceptsFirstMouse:theEvent]) {
    [mCloseButton setTrackingEnabled:NO];
	  [self setNeedsDisplay:YES];
    // calling displayIfNeeded prevents the "lag" observed when displaying rollover events
    [self displayIfNeeded];
  }
}

#pragma mark -

- (void)setDragTarget:(BOOL)isDragTarget
{
  mMouseWithin = isDragTarget;

  if (mIsDragTarget != isDragTarget) {
    mIsDragTarget = isDragTarget;
    [self setNeedsDisplay:YES];
    [self displayIfNeeded];
  }
}

- (BOOL)shouldAcceptDragFrom:(id)sender
{
  if ((sender == self) || (sender == mTabViewItem))
    return NO;

  NSWindowController *windowController = [[[mTabViewItem view] window] windowController];
  if ([windowController isMemberOfClass:[BrowserWindowController class]]) {
    if (sender == [(BrowserWindowController *)windowController proxyIconView])
      return NO;
  }

  return YES;
}

// NSDraggingDestination destination methods
- (unsigned int)draggingEntered:(id <NSDraggingInfo>)sender
{
  if (![self shouldAcceptDragFrom:[sender draggingSource]])
    return NSDragOperationNone;

  [self setDragTarget:YES];
  return NSDragOperationGeneric;
}

- (void)draggingExited:(id <NSDraggingInfo>)sender
{
  [self setDragTarget:NO];
}

- (BOOL)prepareForDragOperation:(id <NSDraggingInfo>)sender
{
  return YES;
}

- (BOOL)performDragOperation:(id <NSDraggingInfo>)sender
{
  [self setDragTarget:NO];

  if (![self shouldAcceptDragFrom:[sender draggingSource]])
    return NO;

  // let the tab view handle it
  return [[mTabViewItem tabView] performDragOperation:sender];
}

#pragma mark -

- (unsigned int)draggingSourceOperationMaskForLocal:(BOOL)isLocal
{
  if (isLocal)
    return (NSDragOperationGeneric | NSDragOperationCopy);

  return (NSDragOperationGeneric | NSDragOperationCopy | NSDragOperationLink);
}

#pragma mark -

- (void)mouseDown:(NSEvent *)theEvent
{
  NSRect  iconRect   = [self convertRect:[mLabelCell imageFrame] fromView:nil];
  NSPoint localPoint = [self convertPoint:[theEvent locationInWindow] fromView:nil];

  // Don't select the tab when the click is on the icon, so that background
  // tabs are draggable.
  if (NSPointInRect(localPoint, iconRect) && [mTabViewItem draggable]) {
    mSelectTabOnMouseUp = YES;
    return;
  }

  mSelectTabOnMouseUp = NO;
  [[NSNotificationCenter defaultCenter] postNotificationName:kTabWillChangeNotifcation object:mTabViewItem];
  [[mTabViewItem tabView] selectTabViewItem:mTabViewItem];
}

- (void)mouseUp:(NSEvent *)theEvent
{
  if (mSelectTabOnMouseUp) {
    [[NSNotificationCenter defaultCenter] postNotificationName:kTabWillChangeNotifcation object:mTabViewItem];
    [[mTabViewItem tabView] selectTabViewItem:mTabViewItem];
    mSelectTabOnMouseUp = NO;
  }
}

- (void)mouseDragged:(NSEvent*)theEvent
{
  NSRect  iconRect   = [self convertRect:[mLabelCell imageFrame] fromView:nil];//NSMakeRect(0, 0, 16, 16);
  NSPoint localPoint = [self convertPoint:[theEvent locationInWindow] fromView:nil];

  if (!NSPointInRect(localPoint, iconRect) || ![mTabViewItem draggable])
    return;

  // only initiate the drag if the original mousedown was in the right place...
  // implied by mSelectTabOnMouseUp
  if (mSelectTabOnMouseUp) {
    mSelectTabOnMouseUp = NO;

    BrowserWrapper* browserView = (BrowserWrapper*)[mTabViewItem view];

    NSString     *url = [browserView currentURI];
    NSString     *title = [mLabelCell stringValue];
    NSString     *cleanedTitle = [title stringByReplacingCharactersInSet:[NSCharacterSet controlCharacterSet] withString:@" "];

    NSPasteboard *pboard = [NSPasteboard pasteboardWithName:NSDragPboard];
    [pboard declareURLPasteboardWithAdditionalTypes:[NSArray array] owner:self];
    [pboard setDataForURL:url title:cleanedTitle];

    NSPoint dragOrigin = [self frame].origin;
    dragOrigin.y += [self frame].size.height;

    [self dragImage:[NSImage dragImageWithIcon:[mLabelCell image] title:title]
                 at:iconRect.origin
             offset:NSMakeSize(0.0, 0.0)
              event:theEvent
         pasteboard:pboard
             source:self
          slideBack:YES];
  }
}

- (BOOL)mouseDownCanMoveWindow
{
  return NO;
}

#pragma mark -

+(void)loadImages
{
  if (!sTabLeft)
      sTabLeft             = [[NSImage imageNamed:@"tab_left_side"] retain];
  if (!sTabRight)
    sTabRight              = [[NSImage imageNamed:@"tab_right_side"] retain];
  if (!sActiveTabBg)
    sActiveTabBg           = [[NSImage imageNamed:@"tab_active_bg"] retain];
  if (!sTabMouseOverBg)
    sTabMouseOverBg        = [[NSImage imageNamed:@"tab_hover"] retain];
  if (!sTabButtonDividerImage)
    sTabButtonDividerImage = [[NSImage imageNamed:@"tab_button_divider"] retain];
}

@end
