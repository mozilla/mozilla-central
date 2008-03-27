/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is the Mozilla browser.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   william@dell.wisner.name (William Dell Wisner)
 *   josh@mozilla.com (Josh Aas)
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

#import "Tabs.h"

#import "GeckoPrefConstants.h"

@implementation OrgMozillaCaminoPreferenceTabs

- (id)initWithBundle:(NSBundle *)bundle
{
  self = [super initWithBundle:bundle];
  return self;
}

- (void)dealloc
{
  [super dealloc];
}

- (void)mainViewDidLoad
{
  if (!mPrefService)
    return;

  BOOL gotPref;

  [mCheckboxOpenTabsForCommand setState:([self getBooleanPref:kGeckoPrefOpenTabsForMiddleClick
                                                  withSuccess:&gotPref] ? NSOnState : NSOffState)];

  int externalLinksPref = [self getIntPref:kGeckoPrefExternalLoadBehavior withSuccess:&gotPref];
  if (externalLinksPref == kExternalLoadOpensNewWindow)
    [mCheckboxOpenTabsForExternalLinks setState:NSOffState];
  else if (externalLinksPref == kExternalLoadOpensNewTab)
    [mCheckboxOpenTabsForExternalLinks setState:NSOnState];
  else
    [mCheckboxOpenTabsForExternalLinks setState:NSMixedState];

  int swmBehavior = [self getIntPref:kGeckoPrefSingleWindowModeTargetBehavior withSuccess:&gotPref];
  if (swmBehavior == kSingleWindowModeUseNewWindow)
    [mSingleWindowMode setState:NSOffState];
  else if (swmBehavior == kSingleWindowModeUseNewTab)
    [mSingleWindowMode setState:NSOnState];
  else
    [mSingleWindowMode setState:NSMixedState];

  [mCheckboxLoadTabsInBackground setState:([self getBooleanPref:kGeckoPrefOpenTabsInBackground
                                                    withSuccess:&gotPref] ? NSOnState : NSOffState)];
  [mTabBarVisiblity setState:([self getBooleanPref:kGeckoPrefAlwaysShowTabBar withSuccess:&gotPref] ? NSOnState : NSOffState)];
}

- (IBAction)checkboxClicked:(id)sender
{
  if (!mPrefService)
    return;

  if (sender == mCheckboxOpenTabsForCommand)
    [self setPref:kGeckoPrefOpenTabsForMiddleClick toBoolean:([sender state] == NSOnState)];
  else if (sender == mCheckboxOpenTabsForExternalLinks) {
    [sender setAllowsMixedState:NO];
    [self setPref:kGeckoPrefExternalLoadBehavior toInt:([sender state] == NSOnState ? kExternalLoadOpensNewTab
                                                                                    : kExternalLoadOpensNewWindow)];
  }
  else if (sender == mSingleWindowMode) {
    [sender setAllowsMixedState:NO];
    int newState = ([sender state] == NSOnState) ? kSingleWindowModeUseNewTab
                                                 : kSingleWindowModeUseNewWindow;
    [self setPref:kGeckoPrefSingleWindowModeTargetBehavior toInt:newState];
  }

  else if (sender == mCheckboxLoadTabsInBackground)
    [self setPref:kGeckoPrefOpenTabsInBackground toBoolean:([sender state] == NSOnState)];
  else if (sender == mTabBarVisiblity)
    [self setPref:kGeckoPrefAlwaysShowTabBar toBoolean:([sender state] == NSOnState)];
}

@end
