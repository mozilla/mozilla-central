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
 *   Simon Fraser <sfraser@netscape.com>
 *   Ian Leue (froodian) <stridey@gmail.com>
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

#import <Carbon/Carbon.h>

#import "NSMenu+Utils.h"


NSString* const NSMenuWillDisplayNotification = @"NSMenuWillDisplayNotification";
NSString* const NSMenuClosedNotification      = @"NSMenuClosedNotification";

// internal API
extern MenuRef _NSGetCarbonMenu(NSMenu* aMenu);

static OSStatus MenuEventHandler(EventHandlerCallRef inHandlerCallRef, EventRef inEvent, void *inUserData)
{
  UInt32 eventKind = GetEventKind(inEvent);
  switch (eventKind)
  {
    case kEventMenuOpening:
    case kEventMenuClosed:
      {
        MenuRef theCarbonMenu;
        OSStatus err = GetEventParameter(inEvent, kEventParamDirectObject, typeMenuRef, NULL, sizeof(MenuRef), NULL, &theCarbonMenu);
        if (err == noErr)
        {
          @try {
            // we can't map from MenuRef to NSMenu, so we have to let receivers of the notification
            // do the test.
            NSString* notificationName = @"";
            if (eventKind == kEventMenuOpening)
              notificationName = NSMenuWillDisplayNotification;
            else if (eventKind == kEventMenuClosed)
              notificationName = NSMenuClosedNotification;
            
            [[NSNotificationCenter defaultCenter] postNotificationName:notificationName
                                                                object:[NSValue valueWithPointer:theCarbonMenu]];
          }
          @catch (id exception) {
            NSLog(@"Caught exception %@", exception);
          }
        }
      }
      break;
  }

  // always let the event propagate  
  return eventNotHandledErr;
}

#pragma mark -

@interface CarbonMenuList : NSObject
{
  NSMutableArray* mList;
}

+ (CarbonMenuList*)instance;
- (id)init;
- (void)dealloc;
- (NSArray*)list;
- (void)setupNotifications;
- (void)menuOpen:(NSNotification*)notification;
- (void)menuClose:(NSNotification*)notification;
@end

@implementation CarbonMenuList

+ (CarbonMenuList*)instance {
  static CarbonMenuList* sInstance;
  if (!sInstance) {
    sInstance = [[self alloc] init];
  }
  return sInstance;
}

- (id)init {
  if ((self = [super init])) {
    // 16 slots is more than enough, as it's really only possible to wind up
    // with as many open menus as the maximum submenu depth.  Even if the
    // capacity here lowballs it, the array will expand dynamically.
    mList = [[NSMutableArray alloc] initWithCapacity:16];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [mList release];
  [super dealloc];
}

- (NSArray*)list {
  return mList;
}

- (void)setupNotifications {
  NSNotificationCenter* notificationCenter = [NSNotificationCenter defaultCenter];
  [notificationCenter addObserver:self
                         selector:@selector(menuOpen:)
                             name:NSMenuWillDisplayNotification
                           object:nil];
  [notificationCenter addObserver:self
                         selector:@selector(menuClose:)
                             name:NSMenuClosedNotification
                           object:nil];
}

- (void)menuOpen:(NSNotification*)notification {
  NSValue* value = [notification object];
  if (![mList containsObject:value]) {
    [mList addObject:value];
  }
}

- (void)menuClose:(NSNotification*)notification {
  [mList removeObject:[notification object]];
}

@end


@implementation NSMenu(ChimeraMenuUtils)

+ (void)setupMenuWillDisplayNotifications
{
  static BOOL sInstalled = NO;
  
  if (!sInstalled)
  {
    const EventTypeSpec menuEventList[] = {
      { kEventClassMenu, kEventMenuOpening },
      { kEventClassMenu, kEventMenuClosed  }
    };

    InstallApplicationEventHandler(NewEventHandlerUPP(MenuEventHandler), 
                                   GetEventTypeCount(menuEventList),
                                   menuEventList, (void*)self, NULL);
    sInstalled = YES;
  }

  [[CarbonMenuList instance] setupNotifications];
}

+ (void)cancelAllTracking {
  // This method uses Carbon functions to do its dirty work, which seems to
  // work.  It's no hackier than the other Carbon MenuRef action that the
  // rest of this class uses.  There isn't really a good Cocoa substitute for
  // CancelMenuTracking.  In Leopard, there's -[NSMenu cancelMenuTracking],
  // but that doesn't seem to work to stop menu tracking when a sheet is
  // about to be displayed.  Perhaps that's because it tries to fade the
  // menu out, as CancelMenuTracking would do with |false| as its second
  // argument.  (That doesn't work either.)

  // Stop tracking the menu bar.  Even though the CarbonMenuList contains
  // the menu bar's submenus, it doesn't contain the menu bar itself, and
  // CancelMenuTracking will only stop tracking if called with the same
  // MenuRef used for MenuSelect.  For menu bar pull-down menu tracking,
  // that's the menu bar.
  MenuRef rootMenu = AcquireRootMenu();
  CancelMenuTracking(rootMenu, true, 0);
  DisposeMenu(rootMenu);

  // Stop tracking other types of menus, like pop-ups and contextual menus.
  NSArray* list = [[CarbonMenuList instance] list];
  for (unsigned int index = 0; index < [list count]; ++index) {
    MenuRef menuRef = [(NSValue*)[list objectAtIndex:index] pointerValue];
    CancelMenuTracking(menuRef, true, 0);
  }
}

- (void)checkItemWithTag:(int)tag uncheckingOtherItems:(BOOL)uncheckOthers
{
  if (uncheckOthers)
  {
    NSEnumerator* itemsEnum = [[self itemArray] objectEnumerator];
    NSMenuItem* curItem;
    while ((curItem = (NSMenuItem*)[itemsEnum nextObject]))
      [curItem setState:NSOffState];
  }
  [[self itemWithTag:tag] setState:NSOnState];
}

- (void)checkItemWithTag:(int)unmaskedTag inGroupWithMask:(int)tagMask
{
  NSEnumerator* itemsEnum = [[self itemArray] objectEnumerator];
  NSMenuItem* curItem;
  while ((curItem = (NSMenuItem*)[itemsEnum nextObject]))
  {
    int itemTag = [curItem tag];
    if ((itemTag & tagMask) == tagMask)
    {
      int rawTag = (itemTag & ~tagMask);
      [curItem setState:(rawTag == unmaskedTag) ? NSOnState : NSOffState];
    }
  }
}

- (NSMenuItem*)firstCheckedItem
{
  NSEnumerator* itemsEnumerator = [[self itemArray] objectEnumerator];
  NSMenuItem* currentItem;
  while ((currentItem = [itemsEnumerator nextObject])) {
    if ([currentItem state] == NSOnState)
      return currentItem;
  }
  return nil;
}

- (void)setAllItemsEnabled:(BOOL)inEnable startingWithItemAtIndex:(int)inFirstItem includingSubmenus:(BOOL)includeSubmenus
{
  NSArray* menuItems = [self itemArray];

  unsigned int i;
  for (i = inFirstItem; i < [menuItems count]; i ++)
  {
    NSMenuItem* curItem = [self itemAtIndex:i];
    [curItem setEnabled:inEnable];
    if (includeSubmenus && [curItem hasSubmenu])
    {
      [[curItem submenu] setAllItemsEnabled:inEnable startingWithItemAtIndex:0 includingSubmenus:includeSubmenus];
    }
  }
}

- (NSMenuItem*)itemWithTarget:(id)anObject andAction:(SEL)actionSelector
{
  int itemIndex = [self indexOfItemWithTarget:anObject andAction:actionSelector];
  return (itemIndex == -1) ? (NSMenuItem*)nil : [self itemAtIndex:itemIndex];
}

- (void)removeItemsAfterItem:(NSMenuItem*)inItem
{
  int firstItemToRemoveIndex = 0;

  if (inItem)
    firstItemToRemoveIndex = [self indexOfItem:inItem] + 1;

  [self removeItemsFromIndex:firstItemToRemoveIndex];
}

- (void)removeItemsFromIndex:(int)inItemIndex
{
  if (inItemIndex < 0)
    inItemIndex = 0;

  while ([self numberOfItems] > inItemIndex)
    [self removeItemAtIndex:inItemIndex];
}

- (void)removeAllItemsWithTag:(int)tagToRemove
{
  NSEnumerator* reverseItemEnumerator = [[self itemArray] reverseObjectEnumerator];
  NSMenuItem* menuItem = nil;
  while ((menuItem = [reverseItemEnumerator nextObject])) {
    if ([menuItem tag] == tagToRemove)
      [self removeItem:menuItem];
  }
}

// because there's no way to map back from a MenuRef to a Cocoa NSMenu, we have
// to let receivers of the notification do the test by calling this method.
- (BOOL)isTargetOfMenuDisplayNotification:(id)inObject
{
  return ([inObject pointerValue] == _NSGetCarbonMenu(self));
}

- (int)addCommandKeyAlternatesForMenuItem:(NSMenuItem *)inMenuItem
{
  // Find the item we are adding alternates for. Since this is generally used
  // when building a menu, check the last item first as an optimization.
  int itemIndex = [self numberOfItems] - 1;
  if (![[self itemAtIndex:itemIndex] isEqual:inMenuItem])
    itemIndex = [self indexOfItem:inMenuItem];
  if (itemIndex == -1)
    return 0;

  [inMenuItem setKeyEquivalentModifierMask:0]; // Needed since by default NSMenuItems have NSCommandKeyMask

  NSString* title = [inMenuItem title];
  SEL action = [inMenuItem action];
  id target = [inMenuItem target];
  id representedObject = [inMenuItem representedObject];
  NSImage* image = [inMenuItem image];

  NSMenuItem* altMenuItem = [[NSMenuItem alloc] initAlternateWithTitle:title
                                                                action:action
                                                                target:target
                                                             modifiers:NSCommandKeyMask];
  [altMenuItem setRepresentedObject:representedObject];
  [altMenuItem setImage:image];
  [self insertItem:altMenuItem atIndex:(itemIndex + 1)];
  [altMenuItem release];

  altMenuItem = [[NSMenuItem alloc] initAlternateWithTitle:title
                                                    action:action
                                                    target:target
                                                 modifiers:(NSCommandKeyMask | NSShiftKeyMask)];
  [altMenuItem setRepresentedObject:representedObject];
  [altMenuItem setImage:image];
  [self insertItem:altMenuItem atIndex:(itemIndex + 2)];
  [altMenuItem release];

  return 2;
}

@end


@implementation NSMenuItem(ChimeraMenuItemUtils)

- (id)initAlternateWithTitle:(NSString *)title action:(SEL)action target:(id)target modifiers:(int)modifiers
{
  if ((self = [self initWithTitle:title action:action keyEquivalent:@""])) {
    [self setTarget:target];
    [self setKeyEquivalentModifierMask:modifiers];
    [self setAlternate:YES];
  }

  return self;
}

+ (NSMenuItem *)alternateMenuItemWithTitle:(NSString *)title action:(SEL)action target:(id)target modifiers:(int)modifiers
{
  return [[[NSMenuItem alloc] initAlternateWithTitle:title action:action target:target modifiers:modifiers] autorelease];
}

- (int)tagRemovingMask:(int)tagMask
{
  return ([self tag] & ~tagMask);
}

- (void)takeStateFromItem:(NSMenuItem*)inItem
{
  [self setTitle:[inItem title]];
  [self setEnabled:[inItem isEnabled]];
}

@end
