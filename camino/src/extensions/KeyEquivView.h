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

#ifndef KeyEquivView_h__
#define KeyEquivView_h__

#import <Cocoa/Cocoa.h>

@interface KeyEquivView : NSView
{
  NSString* mKeyEquivalent;
  unsigned int mKeyEquivalentModifierMask;
  id mTarget;  // weak
  SEL mAction;
}

// Convenience
+ (KeyEquivView*)kevWithKeyEquivalent:(NSString*)keyEquivalent
            keyEquivalentModifierMask:(unsigned int)keyEquivalentModifierMask
                               target:(id)target
                               action:(SEL)action;

// Constructors and destructors
- (id)initWithKeyEquivalent:(NSString*)keyEquivalent
  keyEquivalentModifierMask:(unsigned int)keyEquivalentModifierMask
                     target:(id)target
                     action:(SEL)action;
- (void)dealloc;

// Accessors and mutators
- (NSString*)keyEquivalent;
- (void)setKeyEquivalent:(NSString*)keyEquivalent;
- (unsigned int)keyEquivalentModifierMask;
- (void)setKeyEquivalentModifierMask:(unsigned int)keyEquivalentModifierMask;
- (id)target;
- (void)setTarget:(id)target;
- (SEL)action;
- (void)setAction:(SEL)action;

// Action
//
// performKeyEquivalent: first calls the superclass' performKeyEquivalent:
// selector, to try to pass the event to any view descendants, although it
// would be pretty weird to add descendants to this view.
//
// If no descendants handle the event, the event's keypress and modifier mask
// will be compared to the stored key equivalent character and modifiers.  If
// they match, [target action:self] will be invoked.
//
// If performKeyEquivalent: is able to find anything to process the event,
// either via the superclass or by invoking the stored object's selector,
// it returns YES.  If nothing handles the event, returns NO.
- (BOOL)performKeyEquivalent:(NSEvent*)event;

@end

#endif  // KeyEquivView_h__
