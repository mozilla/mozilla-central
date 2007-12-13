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
 * The Original Code is a Cocoa keyboard-equivalent-processing fake view.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Mark Mentovai <mark@moxienet.com> (Original Author)
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

#import "KeyEquivView.h"

@implementation KeyEquivView

+ (KeyEquivView*)kevWithKeyEquivalent:(NSString*)keyEquivalent
            keyEquivalentModifierMask:(unsigned int)keyEquivalentModifierMask
                               target:(id)target
                               action:(SEL)action {
  return [[[KeyEquivView alloc] initWithKeyEquivalent:keyEquivalent
                            keyEquivalentModifierMask:keyEquivalentModifierMask
                                               target:target 
                                               action:action] autorelease];
}

- (id)initWithKeyEquivalent:(NSString*)keyEquivalent
  keyEquivalentModifierMask:(unsigned int)keyEquivalentModifierMask
                     target:(id)target
                     action:(SEL)action {
  if ((self = [super initWithFrame:NSMakeRect(0, 0, 0, 0)])) {
    mKeyEquivalent = [keyEquivalent retain];
    mKeyEquivalentModifierMask = keyEquivalentModifierMask;
    mTarget = target;
    mAction = action;
  }
  return self;
}

- (void)dealloc {
  [mKeyEquivalent release];
  [super dealloc];
}

- (NSString*)keyEquivalent {
  return mKeyEquivalent;
}

- (void)setKeyEquivalent:(NSString*)keyEquivalent {
  [mKeyEquivalent release];
  mKeyEquivalent = keyEquivalent;
}

- (unsigned int)keyEquivalentModifierMask {
  return mKeyEquivalentModifierMask;
}

- (void)setKeyEquivalentModifierMask:(unsigned int)keyEquivalentModifierMask {
  mKeyEquivalentModifierMask = keyEquivalentModifierMask;
}

- (id)target {
  return mTarget;
}

- (void)setTarget:(id)target {
  mTarget = target;
}

- (SEL)action {
  return mAction;
}

- (void)setAction:(SEL)action {
  mAction = action;
}

- (BOOL)performKeyEquivalent:(NSEvent *)event {
  BOOL performed = [super performKeyEquivalent:event];

  if (!performed) {
    NSString* character = [event charactersIgnoringModifiers];
    unsigned int modifier = [event modifierFlags];

    if ((modifier & NSDeviceIndependentModifierFlagsMask) == mKeyEquivalentModifierMask &&
        [character isEqualToString:mKeyEquivalent]) {
        [mTarget performSelector:mAction withObject:self];
      performed = YES;
    }
  }

  return performed;
}

@end
