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
 * The Original Code is tab UI for Camino.
 *
 * The Initial Developer of the Original Code is
 * Geoff Beier.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Geoff Beier <me@mollyandgeoff.com>
 *   Aaron Schulman <aschulm@gmail.com>
 *   Desmond Elliott <d.elliott@inf.ed.ac.uk>
 *   Ian Leue <froodian@gmail.com>
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

#import "BrowserTabBarView.h"
#import "BrowserTabView.h"
#import "BrowserTabViewItem.h"
#import "TabButtonView.h"
#import "ImageAdditions.h"

#import "NSArray+Utils.h"
#import "NSMenu+Utils.h"
#import "NSPasteboard+Utils.h"
#import "NSView+Utils.h"

@interface BrowserTabBarView(TabBarViewPrivate)

-(void)layoutButtonsPreservingVisibility:(BOOL)preserveVisibility;
-(void)loadImages;
-(void)drawTabBarBackgroundInRect:(NSRect)rect withActiveTabRect:(NSRect)tabRect;
-(void)drawTabBarBackgroundHiliteRectInRect:(NSRect)rect;
-(TabButtonView*)buttonAtPoint:(NSPoint)clickPoint;
-(void)registerTabButtonsForTracking;
-(void)unregisterTabButtonsForTracking;
-(void)ensureOverflowButtonsInitted;
-(NSRect)tabsRect;
-(NSRect)tabsRectWithOverflow:(BOOL)overflowing;
-(BrowserTabViewItem *)tabViewItemUnderMouse;
-(NSString*)view:(NSView*)view stringForToolTip:(NSToolTipTag)tag point:(NSPoint)point userData:(void*)userData;
-(NSButton*)newOverflowButtonForImageNamed:(NSString*)imageName;
-(void)setLeftMostVisibleTabIndex:(int)index;
-(NSButton*)scrollButtonAtPoint:(NSPoint)clickPoint;
-(BOOL)tabIndexIsVisible:(int)index;
-(void)setOverflowButtonsVisible:(BOOL)visible;
-(float)verticalOriginForButtonWithHeight:(float)height;
-(void)scrollLeft:(id)sender;
-(void)scrollRight:(id)sender;

@end

static const float kTabBarDefaultHeight = 22.0;
static const float kTabBottomPad = 4.0;           // height of the padding below tabs

@implementation BrowserTabBarView

static const float kTabBarMargin = 5.0;           // left/right margin for tab bar
static const float kMinTabWidth = 100.0;          // the smallest tabs that will be drawn
static const float kMaxTabWidth = 175.0;          // the widest tabs that will be drawn

static const int kTabDragThreshold = 3;           // distance a drag must go before we start dnd

static const float kScrollButtonDelay = 0.4;      // how long a button must be held before we start scrolling
static const float kScrollButtonInterval = 0.15;  // time (in seconds) between firing scroll actions

-(id)initWithFrame:(NSRect)frame 
{
  self = [super initWithFrame:frame];
  if (self) {
    mOverflowTabs = NO;
    // initialize to YES so that awakeFromNib: will set the right size; awakeFromNib uses setVisible which
    // will only be effective if visibility changes. initializing to YES causes the right thing to happen even
    // if this view is visible in a nib file.
    mVisible = YES;
    // this will not likely have any result here
    [self rebuildTabBar];
    [self registerForDraggedTypes:[NSArray arrayWithObjects: kCaminoBookmarkListPBoardType,
                                                             kWebURLsWithTitlesPboardType,
                                                             NSStringPboardType,
                                                             NSFilenamesPboardType,
                                                             NSURLPboardType,
                                                             nil]];
  }
  return self;
}

-(void)awakeFromNib
{
  // start off with the tabs hidden, and allow our controller to show or hide as appropriate.
  [self setVisible:NO];
  // this needs to be called again since our tabview should be non-nil now
  [self rebuildTabBar];
}

-(void)dealloc
{
  [mTrackingCells release];
  [mOverflowRightButton release];
  [mOverflowLeftButton release];
  [mOverflowMenuButton release];

  [mBackgroundImage release];
  [mButtonDividerImage release];

  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [super dealloc];
}

-(void)drawRect:(NSRect)rect 
{
  // determine the frame of the active tab button and fill the rest of the bar in with the background
  TabButtonView* activeTabButton = [(BrowserTabViewItem *)[mTabView selectedTabViewItem] buttonView];
  NSRect activeTabButtonFrame = [activeTabButton superview] ? [activeTabButton frame]
                                                            : NSMakeRect(0, 0, 0, 0);
  [self drawTabBarBackgroundInRect:rect withActiveTabRect:activeTabButtonFrame];

  NSRect tabsRect = [self tabsRect];
  // Draw the leftmost button image divider (right sides are drawn by the buttons themselves).
  // A divider is not needed if the leftmost button is selected.
  if ([mTabView indexOfTabViewItem:[mTabView selectedTabViewItem]] != mLeftMostVisibleTabIndex) {
    [mButtonDividerImage compositeToPoint:NSMakePoint(NSMinX(tabsRect), 0)
                                operation:NSCompositeSourceOver];
  }

  // Draw a divider to the left of the overflow menu button, if it's showing
  if (mOverflowTabs)
    [mButtonDividerImage compositeToPoint:NSMakePoint(NSMaxX(tabsRect) +
                                                      [mOverflowRightButton frame].size.width, 0)
                                operation:NSCompositeSourceOver];

  if (mDragOverBar)
    [self drawTabBarBackgroundHiliteRectInRect:rect];
}

-(void)setFrame:(NSRect)frameRect
{
  [super setFrame:frameRect];
  // tab buttons probably need to be resized if the frame changes
  [self unregisterTabButtonsForTracking];
  [self layoutButtonsPreservingVisibility:YES];
  [self registerTabButtonsForTracking];
}

-(NSMenu*)menuForEvent:(NSEvent*)theEvent
{
  NSPoint clickPoint = [self convertPoint:[theEvent locationInWindow] fromView:nil];
  TabButtonView *clickedTabButton = [self buttonAtPoint:clickPoint];
  return (clickedTabButton) ? [clickedTabButton menu] : [self menu];
}

-(void)mouseDown:(NSEvent*)theEvent
{
  NSPoint clickPoint = [self convertPoint:[theEvent locationInWindow] fromView:nil];
  TabButtonView *clickedTabButton = [self buttonAtPoint:clickPoint];
  NSButton *clickedScrollButton = [self scrollButtonAtPoint:clickPoint];

  if (!clickedScrollButton && [theEvent clickCount] == 2)
    [[NSNotificationCenter defaultCenter] postNotificationName:kTabBarBackgroundDoubleClickedNotification
                                                        object:mTabView];
}

// Returns the scroll button at the specified point, if there is one.
-(NSButton*)scrollButtonAtPoint:(NSPoint)clickPoint
{
  if (NSPointInRect(clickPoint, [mOverflowLeftButton frame]))
    return mOverflowLeftButton;
  if (NSPointInRect(clickPoint, [mOverflowRightButton frame]))
    return mOverflowRightButton;
  if (NSPointInRect(clickPoint, [mOverflowMenuButton frame]))
    return mOverflowMenuButton;
  return nil;
}

// returns the tab at the specified point (in tab bar view coordinates)
-(TabButtonView*)buttonAtPoint:(NSPoint)clickPoint
{
  BrowserTabViewItem *tab = nil;
  NSArray *tabItems = [mTabView tabViewItems];
  NSEnumerator *tabEnumerator = [tabItems objectEnumerator];
  while ((tab = [tabEnumerator nextObject])) {
    TabButtonView *button = [tab buttonView];
    if ([button superview] && NSPointInRect(clickPoint, [button frame]))
      return button;
  }
  return nil;
}

-(void)drawTabBarBackgroundInRect:(NSRect)rect withActiveTabRect:(NSRect)tabRect
{
  // draw tab bar background, omitting the selected Tab
  NSRect barFrame = [self bounds];
  NSPoint patternOrigin = [self convertPoint:NSMakePoint(0.0f, 0.0f) toView:[[self window] contentView]];
  NSRect fillRect;

  // first, fill to the left of the active tab
  fillRect = NSMakeRect(barFrame.origin.x, barFrame.origin.y, 
                        (tabRect.origin.x - barFrame.origin.x), barFrame.size.height);
  if (NSIntersectsRect(fillRect, rect)) {
    // make sure we're not drawing to the left or right of the actual rectangle we were asked to draw
    if (fillRect.origin.x < NSMinX(rect)) {
      fillRect.size.width -= NSMinX(rect) - fillRect.origin.x;
      fillRect.origin.x = NSMinX(rect);
    }

    if (NSMaxX(fillRect) > NSMaxX(rect))
      fillRect.size.width -= NSMaxX(fillRect) - NSMaxX(rect);

    [mBackgroundImage drawTiledInRect:fillRect origin:patternOrigin operation:NSCompositeSourceOver];
  }

  // then fill to the right
  fillRect = NSMakeRect(NSMaxX(tabRect), barFrame.origin.y, 
                        (NSMaxX(barFrame) - NSMaxX(tabRect)), barFrame.size.height);
  if (NSIntersectsRect(fillRect,rect)) {
      // make sure we're not drawing to the left or right of the actual rectangle we were asked to draw
      if (fillRect.origin.x < NSMinX(rect)) {
        fillRect.size.width -= NSMinX(rect) - fillRect.origin.x;
        fillRect.origin.x = NSMinX(rect);
      }

      if (NSMaxX(fillRect) > NSMaxX(rect))
        fillRect.size.width -= NSMaxX(fillRect) - NSMaxX(rect);
        
      [mBackgroundImage drawTiledInRect:fillRect origin:patternOrigin operation:NSCompositeSourceOver];
   }
}

-(void)drawDragHiliteInRect:(NSRect)rect
{
  NSRect fillRect;
  NSRect junk;
  NSDivideRect(rect, &junk, &fillRect, kTabBottomPad, NSMinYEdge);

  NSGraphicsContext* gc = [NSGraphicsContext currentContext];
  [gc saveGraphicsState];
  [[[NSColor colorForControlTint:NSDefaultControlTint] colorWithAlphaComponent:0.3] set];
  NSRectFillUsingOperation(fillRect, NSCompositeSourceOver);
  [gc restoreGraphicsState];
}


-(void)drawTabBarBackgroundHiliteRectInRect:(NSRect)rect
{
  NSRect barBounds = [self bounds];

  BrowserTabViewItem* thisTab        = [[mTabView tabViewItems] firstObject];
  TabButtonView*      tabButton      = [thisTab buttonView];
  NSRect              tabButtonFrame = [tabButton frame];

  NSRect junk;
  NSRect backgroundRect;
  NSDivideRect(barBounds, &backgroundRect, &junk, NSMinX(tabButtonFrame), NSMinXEdge);
  if (NSIntersectsRect(backgroundRect, rect))
    [self drawDragHiliteInRect:backgroundRect];

  thisTab         = [[mTabView tabViewItems] lastObject];
  tabButton       = [thisTab buttonView];
  tabButtonFrame  = [tabButton frame];

  NSDivideRect(barBounds, &junk, &backgroundRect, NSMaxX(tabButtonFrame), NSMinXEdge);
  if (!NSIsEmptyRect(backgroundRect) && NSIntersectsRect(backgroundRect, rect))
    [self drawDragHiliteInRect:backgroundRect];
}

-(void)loadImages
{
  if (!mBackgroundImage)
    mBackgroundImage = [[NSImage imageNamed:@"tab_bar_bg"] retain];
  if (!mButtonDividerImage)
    mButtonDividerImage = [[NSImage imageNamed:@"tab_button_divider"] retain];
}

// construct the tab bar based on the current state of mTabView;
// should be called when tabs are first shown.
-(void)rebuildTabBar
{
  [self loadImages];

  [self unregisterTabButtonsForTracking];
  [self layoutButtonsPreservingVisibility:NO];
  [self registerTabButtonsForTracking];
}

- (void)viewWillMoveToWindow:(NSWindow*)window
{
  [self unregisterTabButtonsForTracking];
}

// allows tab button cells to react to mouse events
-(void)registerTabButtonsForTracking
{
  if ([self window] && mVisible) {
    NSArray* tabItems = [mTabView tabViewItems];
    if (mTrackingCells)
      [self unregisterTabButtonsForTracking];
    mTrackingCells = [[NSMutableArray alloc] initWithCapacity:[tabItems count]];
    NSEnumerator* tabEnumerator = [tabItems objectEnumerator];
    
    BrowserTabViewItem* tab = nil;
    while ((tab = [tabEnumerator nextObject])) {
      TabButtonView* tabButton = [tab buttonView];
      if (tabButton) {
        // only track tabs that are visible
        if (![tabButton superview])
          continue;

        [mTrackingCells addObject:tabButton];
        NSRect trackingRect = [tabButton frame];
        // TODO: now that tab are views, they should probably update their
        // own tracking rects as necessary instead.
        [tabButton addTrackingRect];
      }
    }
  }
}

// causes tab buttons to stop reacting to mouse events
-(void)unregisterTabButtonsForTracking
{
  if (mTrackingCells) {
    NSEnumerator *tabEnumerator = [mTrackingCells objectEnumerator];
    TabButtonView *tab = nil;
    while ((tab = (TabButtonView*)[tabEnumerator nextObject]))
      [tab removeTrackingRect];
    [mTrackingCells release];
    mTrackingCells = nil;
  }
}

- (void)viewDidMoveToWindow
{
  // setup the tab bar to recieve notifications of key window changes
  NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
  [nc removeObserver:self name:NSWindowDidBecomeKeyNotification object:[self window]];
  [nc removeObserver:self name:NSWindowDidResignKeyNotification object:[self window]];
  if ([self window]) {
    [nc addObserver:self selector:@selector(handleWindowIsKey:)
          name:NSWindowDidBecomeKeyNotification object:[self window]];
    [nc addObserver:self selector:@selector(handleWindowResignKey:)
          name:NSWindowDidResignKeyNotification object:[self window]];
  }
}

- (void)handleWindowIsKey:(NSWindow *)inWindow
{
  // the mouse isn't tracked when the window isn't key, so update the tab hover
  // state manually if the mouse is in a tab
  BrowserTabViewItem *tab = [self tabViewItemUnderMouse];
  if (tab)
    [[tab buttonView] updateHoverState:YES];
}

- (void)handleWindowResignKey:(NSWindow *)inWindow
{
  // the mouse isn't tracked when the window isn't key, so update the tab hover
  // state manually if the mouse is in a tab
  BrowserTabViewItem *tab = [self tabViewItemUnderMouse];
  if (tab)
    [[tab buttonView] updateHoverState:NO];
}
  
// returns the height the tab bar should be if drawn
-(float)tabBarHeight
{
  // this will be constant for now
  return kTabBarDefaultHeight;
}

// finds the tab under the given point (in window coordinates), if any
-(BrowserTabViewItem *)tabViewItemAtPoint:(NSPoint)location
{
  NSPoint mousePointInView = [self convertPoint:location fromView:nil];
  // Don't bother checking each tab's frame if the point isn't in the tab bar
  if (!NSMouseInRect(mousePointInView, [self bounds], NO))
    return nil;
  return [[self buttonAtPoint:mousePointInView] tabViewItem];
}

// finds the tab currently under the mouse, if any
-(BrowserTabViewItem *)tabViewItemUnderMouse
{
  NSPoint mousePointInWindow = [[self window] convertScreenToBase:[NSEvent mouseLocation]];
  return [self tabViewItemAtPoint:mousePointInWindow];
}

// Computes sizes and positions of the currently visible tabs.
// If |preserveVisibility| is YES, then the currently selected tab is forced to
// remain visible in the new layout if it was previously. If it is NO, then the
// tab may or may not stay visible in the new layout.
-(void)layoutButtonsPreservingVisibility:(BOOL)preserveVisibility
{
  // before changing anything, get information about the current state
  BrowserTabViewItem* selectedTab = (BrowserTabViewItem*)[mTabView selectedTabViewItem];
  int selectedTabIndex = selectedTab ? [mTabView indexOfTabViewItem:selectedTab]
                                     : -1;
  // if we aren't currently overflowing, or we were asked to preserve the
  // visibility of the current tab, make sure the current tab stays visible.
  BOOL keepCurrentTabVisible = !mOverflowTabs ||
                               (preserveVisibility && [self tabIndexIsVisible:selectedTabIndex]);

  int numberOfTabs = [mTabView numberOfTabViewItems];

  // check to see whether or not the tabs will fit without the overflows
  float widthOfATab = floor(NSWidth([self tabsRectWithOverflow:NO]) / numberOfTabs);
  mOverflowTabs = widthOfATab < kMinTabWidth;

  if (mOverflowTabs) {
    float widthOfTabBar = NSWidth([self tabsRect]);
    mNumberOfVisibleTabs = (int)floor(widthOfTabBar / kMinTabWidth);
    widthOfATab = floor(widthOfTabBar / mNumberOfVisibleTabs);
    if (mNumberOfVisibleTabs + mLeftMostVisibleTabIndex > numberOfTabs)
      [self setLeftMostVisibleTabIndex:(numberOfTabs - mNumberOfVisibleTabs)];
    if (keepCurrentTabVisible && selectedTab)
      [self scrollTabIndexToVisible:selectedTabIndex];
  }
  else {
    mLeftMostVisibleTabIndex = 0;
    mNumberOfVisibleTabs = numberOfTabs;
    widthOfATab = (widthOfATab > kMaxTabWidth ? kMaxTabWidth : widthOfATab);
  }

  [self removeAllSubviews];
  [self setOverflowButtonsVisible:mOverflowTabs];

  NSRect tabsRect = [self tabsRect];
  float extraWidth = 0.0;
  if (widthOfATab < kMaxTabWidth)
    extraWidth = NSWidth(tabsRect) - widthOfATab * mNumberOfVisibleTabs;
  float nextTabXOrigin  = NSMinX(tabsRect);
  for (int i = 0; i < numberOfTabs; i++) {
    TabButtonView* tabButton = [(BrowserTabViewItem*)[mTabView tabViewItemAtIndex:i] buttonView];

    // Don't do anything with offscreen tabs
    if (i < mLeftMostVisibleTabIndex || i >= mLeftMostVisibleTabIndex + mNumberOfVisibleTabs)
      continue;

    [self addSubview:tabButton];
    NSRect tabRect = NSMakeRect(nextTabXOrigin, 0, widthOfATab, [self tabBarHeight]);
    // spread the extra width from rounding tab sizes over the leftmost tabs.
    if (extraWidth > 0.5) {
      extraWidth -= 1.0;
      tabRect.size.width += 1.0;
    }
    [tabButton setFrame:tabRect];
    [tabButton setDrawsDivider:YES];
    nextTabXOrigin += NSWidth(tabRect);
  }

  if (selectedTab) {
    [[selectedTab buttonView] setDrawsDivider:NO];
    if (selectedTabIndex >= 1 && [self tabIndexIsVisible:selectedTabIndex])
      [[(BrowserTabViewItem*)[mTabView tabViewItemAtIndex:(selectedTabIndex - 1)] buttonView] setDrawsDivider:NO];
  }

  [self setNeedsDisplay:YES];
}

// Determines whether or not the specified tab index is in the currently visible
// tab bar.
-(BOOL)tabIndexIsVisible:(int)tabIndex
{
  return (mLeftMostVisibleTabIndex <= tabIndex && tabIndex < mNumberOfVisibleTabs + mLeftMostVisibleTabIndex);
}

// A helper method that returns an NSButton ready for use as one of our overflow buttons
-(NSButton*)newOverflowButtonForImageNamed:(NSString*)imageName
{
  NSImage* buttonImage = [NSImage imageNamed:imageName];
  NSButton* button = [[NSButton alloc] initWithFrame:NSMakeRect(0, 0, [buttonImage size].width, [buttonImage size].height)];
  [button setImage:buttonImage];
  [button setImagePosition:NSImageOnly];
  [button setBezelStyle:NSShadowlessSquareBezelStyle];
  [button setButtonType:NSToggleButton];
  [button setBordered:NO];
  [button setTarget:self];
  return button;
}

-(void)ensureOverflowButtonsInitted
{
  if (!mOverflowLeftButton) {
    mOverflowLeftButton = [self newOverflowButtonForImageNamed:@"tab_scroll_button_left"];
    [[mOverflowLeftButton cell] setContinuous:YES];
    [mOverflowLeftButton setPeriodicDelay:kScrollButtonDelay interval:kScrollButtonInterval];
    [mOverflowLeftButton setAction:@selector(scrollLeft:)];
  }
  if (!mOverflowRightButton) {
    mOverflowRightButton = [self newOverflowButtonForImageNamed:@"tab_scroll_button_right"];
    [[mOverflowRightButton cell] setContinuous:YES];
    [mOverflowRightButton setPeriodicDelay:kScrollButtonDelay interval:kScrollButtonInterval];
    [mOverflowRightButton setAction:@selector(scrollRight:)];
  }
  if (!mOverflowMenuButton) {
    mOverflowMenuButton = [self newOverflowButtonForImageNamed:@"tab_menu_button"];
    [mOverflowMenuButton setAction:@selector(showOverflowMenu:)];
    [mOverflowMenuButton sendActionOn:NSLeftMouseDownMask];
  }
}

-(void)setOverflowButtonsVisible:(BOOL)visible
{
  if (visible) {
    [self ensureOverflowButtonsInitted];

    NSRect rect = [self tabsRect];

    [mOverflowLeftButton setFrameOrigin:NSMakePoint(0, kTabBottomPad)];
    [mOverflowLeftButton setEnabled:(mLeftMostVisibleTabIndex != 0)];
    [self addSubview:mOverflowLeftButton];

    [mOverflowRightButton setFrameOrigin:NSMakePoint(NSMaxX(rect), kTabBottomPad)];
    [mOverflowRightButton setEnabled:(mLeftMostVisibleTabIndex + mNumberOfVisibleTabs != [mTabView numberOfTabViewItems])];
    [self addSubview:mOverflowRightButton];

    [mOverflowMenuButton setFrameOrigin:NSMakePoint(NSMaxX(rect) +
                                                    [mOverflowRightButton frame].size.width +
                                                    [mButtonDividerImage size].width,
                                                    kTabBottomPad)];
    [self addSubview:mOverflowMenuButton];
  }
  else {
    [mOverflowLeftButton removeFromSuperview];
    [mOverflowRightButton removeFromSuperview];
    [mOverflowMenuButton removeFromSuperview];
  }
}

- (void)showOverflowMenu:(id)sender
{
  NSMenu* overflowMenu = [[[NSMenu alloc] init] autorelease];
  int numberOfTabs = [mTabView numberOfTabViewItems];

  for (int i = 0; i < numberOfTabs; i++)
    [overflowMenu addItem:[(BrowserTabViewItem*)[mTabView tabViewItemAtIndex:i] menuItem]];

  // Insert the separators from right to left, so we don't mess up the index numbers as we go
  if (mLeftMostVisibleTabIndex + mNumberOfVisibleTabs < numberOfTabs)
    [overflowMenu insertItem:[NSMenuItem separatorItem] atIndex:(mLeftMostVisibleTabIndex + mNumberOfVisibleTabs)];
  if (mLeftMostVisibleTabIndex > 0)
    [overflowMenu insertItem:[NSMenuItem separatorItem] atIndex:mLeftMostVisibleTabIndex];

  NSPopUpButtonCell* popupCell = [[[NSPopUpButtonCell alloc] initTextCell:@"" pullsDown:NO] autorelease];
  [popupCell setAltersStateOfSelectedItem:YES];
  [popupCell setMenu:overflowMenu];
  [popupCell trackMouse:[NSApp currentEvent] inRect:[sender bounds] ofView:sender untilMouseUp:YES];
}

-(void)scrollWheel:(NSEvent*)theEvent {
  // Treat vertical scrolling as horizontal (with down == right), since there's
  // no other meaning for the tab bar, and many mice are vertical-only.
  float scrollIncrement = 0.0;
  if ([theEvent deltaX])
    scrollIncrement = -[theEvent deltaX];
  else if ([theEvent deltaY])
    scrollIncrement = -[theEvent deltaY];

  // We don't use the accellation; just scroll one tab per event.
  if (scrollIncrement > 0.0)
    [self scrollRight:nil];
  else if (scrollIncrement < 0.0)
    [self scrollLeft:nil];
}

-(void)scrollLeft:(id)aSender
{
  int numberOfTabsToScroll = 1;
  // We can safely scroll up to the number of tabs hidden to the left
  int tabsHiddenToTheLeft = mLeftMostVisibleTabIndex;

  // If option's down and we're being called from a button-click
  if (([[NSApp currentEvent] modifierFlags] & NSAlternateKeyMask) && [aSender isKindOfClass:[NSButton class]])
    // Scroll up to a window's width (if possible)
    numberOfTabsToScroll = MIN(tabsHiddenToTheLeft, mNumberOfVisibleTabs);

  if (tabsHiddenToTheLeft > 0)
    [self setLeftMostVisibleTabIndex:(mLeftMostVisibleTabIndex - numberOfTabsToScroll)];
}

-(void)scrollRight:(id)aSender
{
  int numberOfTabsToScroll = 1;
  // We can safely scroll up to the the number of tabs hidden to the right
  int tabsHiddenToTheRight = [mTabView numberOfTabViewItems] - (mLeftMostVisibleTabIndex + mNumberOfVisibleTabs);
  
  // If option's down and we're being called from a button-click
  if (([[NSApp currentEvent] modifierFlags] & NSAlternateKeyMask) && [aSender isKindOfClass:[NSButton class]])
    // Scroll up to a window's width (if possible)
    numberOfTabsToScroll = MIN(tabsHiddenToTheRight, mNumberOfVisibleTabs);

  if (tabsHiddenToTheRight > 0)
    [self setLeftMostVisibleTabIndex:(mLeftMostVisibleTabIndex + numberOfTabsToScroll)];
}

// Scrolls the tab bar to make index visible
-(void)scrollTabIndexToVisible:(int)index
{
  // if it's to the left of screen, make it leftmost
  if (index < mLeftMostVisibleTabIndex)
    [self setLeftMostVisibleTabIndex:index];
  // if it's to the right of screen, make it rightmost
  else if (index >= mLeftMostVisibleTabIndex + mNumberOfVisibleTabs)
    [self setLeftMostVisibleTabIndex:(index - mNumberOfVisibleTabs + 1)];
}

// Sets the left most visible tab index to the value specified and rebuilds the 
// tab bar. Should not be called before performing necessary sanity checks.
-(void)setLeftMostVisibleTabIndex:(int)index
{
  if (index != mLeftMostVisibleTabIndex) {
    mLeftMostVisibleTabIndex = index;
    [self rebuildTabBar];
  }
}

// returns an NSRect of the area where tabs may currently be drawn
- (NSRect)tabsRect
{
  return [self tabsRectWithOverflow:mOverflowTabs];
}

// returns an NSRect of the available area to draw tabs with or without overflowing
-(NSRect)tabsRectWithOverflow:(BOOL)overflowing
{
  NSRect rect = [self frame];

  if (overflowing) {
    // Makes sure the buttons exist before getting their frame information.
    [self ensureOverflowButtonsInitted];

    float overflowLeftButtonWidth = [mOverflowLeftButton frame].size.width;
    rect.origin.x += overflowLeftButtonWidth;
    rect.size.width -= overflowLeftButtonWidth +
                       [mOverflowRightButton frame].size.width +
                       [mButtonDividerImage size].width +
                       [mOverflowMenuButton frame].size.width;
  }
  // If there aren't overflows, give ourselves a little margin around the tabs
  // to make them look nicer.
  else {
    rect.origin.x += kTabBarMargin;
    rect.size.width -= 2 * kTabBarMargin;
  }

  return rect;
}

-(BOOL)isVisible
{
  return mVisible;
}

// show or hide tabs- should be called if this view will be hidden, to give it a chance to register or
// unregister tracking rects as appropriate.
//
// Does not actually remove the view from the hierarchy; simply hides it.
-(void)setVisible:(BOOL)show
{
  // only change anything if the new state is different from the current state
  if (show && !mVisible) {
    mVisible = show;
    NSRect newFrame = [self frame];
    newFrame.size.height = [self tabBarHeight];
    [self setFrame:newFrame];
    [self rebuildTabBar];
    // set up tracking rects
    [self registerTabButtonsForTracking];
  } else if (!show && mVisible) { // being hidden
    mVisible = show;
    NSRect newFrame = [self frame];
    newFrame.size.height = 0.0;
    [self setFrame:newFrame];
    // destroy tracking rects
    [self unregisterTabButtonsForTracking];
  }
}
    
#pragma mark -

// NSDraggingDestination destination methods
-(unsigned int)draggingEntered:(id <NSDraggingInfo>)sender
{
  mDragOverBar = YES;
  [self setNeedsDisplay:YES];

  if ([sender draggingSourceOperationMask] & NSDragOperationCopy)
    return NSDragOperationCopy;

  return NSDragOperationGeneric;
}

-(void)draggingExited:(id <NSDraggingInfo>)sender
{
  mDragOverBar = NO;
  [self setNeedsDisplay:YES];
}

-(BOOL)prepareForDragOperation:(id <NSDraggingInfo>)sender
{
  return [mTabView prepareForDragOperation:sender];
}

-(BOOL)performDragOperation:(id <NSDraggingInfo>)sender
{
  mDragOverBar = NO;
  [self setNeedsDisplay:YES];

  return [mTabView performDragOperation:sender];
}

@end
