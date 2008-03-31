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
 * Sean Murphy.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Sean Murphy <murph@seanmurph.com>
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

#import "SearchEngineEditor.h"
#import "SearchEngineManager.h"
#import "ExtendedTableView.h"

static NSString *const kSearchEngineEditorDraggedEngineType = @"SearchEngineEditorDraggedEngineType";

@implementation SearchEngineEditor

#pragma mark -

+ (SearchEngineEditor *)sharedSearchEngineEditor
{
  static SearchEngineEditor *sharedSearchEngineEditor = nil;
  if (!sharedSearchEngineEditor) {
    sharedSearchEngineEditor = [[SearchEngineEditor alloc] initWithWindowNibName:@"SearchEngineEditor"];
  }
  return sharedSearchEngineEditor;
}

- (id)initWithWindowNibName:(NSString *)windowNibName
{
  if ((self = [super initWithWindowNibName:windowNibName])) {
    // Even though SearchEngineManager is a globally accessible singleton, store a reference to make
    // our code easier to read as we access the object very frequently.
    mSearchEngineManager = [SearchEngineManager sharedSearchEngineManager];

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(installedSearchEnginesDidChange:)
                                                 name:kInstalledSearchEnginesDidChangeNotification
                                               object:nil];
  }
  return self;
}

- (void)awakeFromNib
{
  // Center the window by default, and if there's any saved frame information
  // it will then move the window to the stored position.
  [[self window] center];
  [[self window] setFrameAutosaveName:@"SearchEngineEditor"];

  [mSearchEnginesTableView registerForDraggedTypes:[NSArray arrayWithObject:kSearchEngineEditorDraggedEngineType]];
  [mSearchEnginesTableView setDeleteAction:@selector(removeSelectedSearchEngines:)];
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [super dealloc];
}

- (void)installedSearchEnginesDidChange:(NSNotification *)notification
{
  [mSearchEnginesTableView reloadData];
}

#pragma mark -
#pragma mark IBActions

- (IBAction)showSearchEngineEditor:(id)sender
{
  [[self window] makeKeyAndOrderFront:sender];
}

- (IBAction)makeSelectedSearchEngineDefault:(id)sender
{
  if ([mSearchEnginesTableView numberOfSelectedRows] != 1)
    return;

  NSString *selectedSearchEngine = [[mSearchEngineManager installedSearchEngineNames] objectAtIndex:[mSearchEnginesTableView selectedRow]];
  [mSearchEngineManager setPreferredSearchEngine:selectedSearchEngine];
}

- (IBAction)removeSelectedSearchEngines:(id)sender
{
  if ([mSearchEnginesTableView numberOfSelectedRows] == 0)
    return;

  // Make sure this won't remove all engines (we need at least one installed).
  if ([[mSearchEnginesTableView selectedRowIndexes] count] == [[mSearchEngineManager installedSearchEngines] count]) {
    NSAlert *alert = [[[NSAlert alloc] init] autorelease];
    [alert addButtonWithTitle:NSLocalizedString(@"OKButtonText", nil)];
    [alert setMessageText:NSLocalizedString(@"RemovingAllEnginesTitle", nil)];
    [alert setInformativeText:NSLocalizedString(@"RemovingAllEnginesMessage", nil)];
    [alert setAlertStyle:NSWarningAlertStyle];
    [alert beginSheetModalForWindow:[self window]
                      modalDelegate:self
                     didEndSelector:NULL
                        contextInfo:NULL];
    return;
  }

  [mSearchEngineManager removeSearchEnginesAtIndexes:[mSearchEnginesTableView selectedRowIndexes]];
  [mSearchEnginesTableView deselectAll:self];
}

- (IBAction)editSelectedSearchEngine:(id)sender
{
  // When programmatically editing, this delegate method is not called automatically.
  BOOL shouldEdit = YES;
  if ([[mSearchEnginesTableView delegate] respondsToSelector:@selector(tableView:shouldEditTableColumn:row:)]) {
    shouldEdit = [[mSearchEnginesTableView delegate] tableView:mSearchEnginesTableView
                                         shouldEditTableColumn:[[mSearchEnginesTableView tableColumns] objectAtIndex:0]
                                                           row:[mSearchEnginesTableView selectedRow]];
  }
  if (shouldEdit && [mSearchEnginesTableView numberOfSelectedRows] == 1)
    [mSearchEnginesTableView editColumn:0 row:[mSearchEnginesTableView selectedRow] withEvent:nil select:YES];
}

- (IBAction)restoreDefaultSearchEngines:(id)sender
{
  // Since this will remove all existing engines, ask the user for confirmation
  NSAlert *restoreDefaultSearchEnginesAlert = [[[NSAlert alloc] init] autorelease];
  [restoreDefaultSearchEnginesAlert addButtonWithTitle:NSLocalizedString(@"RestoreDefaultEnginesActionButton", nil)];
  NSButton* dontRestoreButton = [restoreDefaultSearchEnginesAlert addButtonWithTitle:NSLocalizedString(@"DontRestoreDefaultEnginesActionButton", nil)];
  [dontRestoreButton setKeyEquivalent:@"\e"]; // escape
  [restoreDefaultSearchEnginesAlert setMessageText:NSLocalizedString(@"RestoreDefaultEnginesTitle", nil)];
  [restoreDefaultSearchEnginesAlert setInformativeText:NSLocalizedString(@"RestoreDefaultEnginesMessage", nil)];
  [restoreDefaultSearchEnginesAlert setAlertStyle:NSWarningAlertStyle];
  [restoreDefaultSearchEnginesAlert beginSheetModalForWindow:[self window]
                                               modalDelegate:self
                                              didEndSelector:@selector(restoreDefaultEnginesAlertDidEnd:returnCode:contextInfo:)
                                                 contextInfo:NULL];
}

- (void)restoreDefaultEnginesAlertDidEnd:(NSAlert *)alert returnCode:(int)returnCode contextInfo:(void *)contextInfo
{
  if (returnCode == NSAlertFirstButtonReturn)
    [mSearchEngineManager revertToDefaultSearchEngines];
}

#pragma mark -
#pragma mark NSTableDataSource/Delegate Methods

- (int)numberOfRowsInTableView:(NSTableView *)aTableView
{
  return [[mSearchEngineManager installedSearchEngines] count];
}

- (id)tableView:(NSTableView *)aTableView objectValueForTableColumn:(NSTableColumn *)aTableColumn row:(int)rowIndex
{
  return [[[mSearchEngineManager installedSearchEngines] objectAtIndex:rowIndex] valueForKey:[aTableColumn identifier]];
}

- (void)tableView:(NSTableView *)aTableView setObjectValue:(id)anObject forTableColumn:(NSTableColumn *)aTableColumn row:(int)rowIndex
{
  // Check if the name was actually modified.
  if ([[[mSearchEngineManager installedSearchEngineNames] objectAtIndex:rowIndex] isEqual:anObject])
    return;

  // Check for a blank name.
  if ([anObject isEqual:@""])
    return;

  // Check if the new name already exists.
  if ([[mSearchEngineManager installedSearchEngineNames] containsObject:anObject]) {
    NSAlert *alert = [[[NSAlert alloc] init] autorelease];
    [alert addButtonWithTitle:NSLocalizedString(@"OKButtonText", nil)];
    [alert setMessageText:NSLocalizedString(@"EngineNameAlreadyExistsTitle", nil)];
    [alert setInformativeText:[NSString stringWithFormat:NSLocalizedString(@"EngineNameAlreadyExistsMessage", nil), anObject]];
    [alert setAlertStyle:NSWarningAlertStyle];
    [alert beginSheetModalForWindow:[self window]
                      modalDelegate:self
                     didEndSelector:NULL
                        contextInfo:NULL];
    return;
  }

  [mSearchEngineManager renameSearchEngineAtIndex:rowIndex to:anObject];
}

- (void)tableView:(NSTableView *)aTableView willDisplayCell:(id)aCell forTableColumn:(NSTableColumn *)aTableColumn row:(int)rowIndex
{
  // Customize the appearance of the preferred search engine.
  if ([[aCell stringValue] isEqualToString:[mSearchEngineManager preferredSearchEngine]]) {
    NSFont *boldCellFont = [[NSFontManager sharedFontManager] convertFont:[aCell font] toHaveTrait:NSBoldFontMask];
    [aCell setFont:boldCellFont];
  }
  else {
    NSFont *nonBoldCellFont = [[NSFontManager sharedFontManager] convertFont:[aCell font] toNotHaveTrait:NSBoldFontMask];
    [aCell setFont:nonBoldCellFont];
  }
}

- (BOOL)tableView:(NSTableView *)aTableView writeRows:(NSArray *)rows toPasteboard:(NSPasteboard *)pboard
{
  // Store which rows are being dragged onto the pasteboard.
  [pboard declareTypes:[NSArray arrayWithObject:kSearchEngineEditorDraggedEngineType] owner:self];

  // 10.4+ Note: Using the new NSTableDataSource dragging method |tableView:writeRowWithIndexes:toPasteboard:|
  // can eliminate this manual index set population.
  NSMutableIndexSet *draggedRowIndexSet = [NSMutableIndexSet indexSet];
  NSEnumerator *draggedRowEnumerator = [rows objectEnumerator];
  NSNumber *currentRow = nil;
  while ((currentRow = [draggedRowEnumerator nextObject]))
    [draggedRowIndexSet addIndex:[currentRow unsignedIntValue]];

  NSData *draggedRowData = [NSKeyedArchiver archivedDataWithRootObject:draggedRowIndexSet];
  return [pboard setData:draggedRowData forType:kSearchEngineEditorDraggedEngineType];
}

- (NSDragOperation)tableView:(NSTableView *)aTableView validateDrop:(id <NSDraggingInfo>)info proposedRow:(int)dropRow proposedDropOperation:(NSTableViewDropOperation)operation
{
  if (operation == NSTableViewDropAbove &&
      [[info draggingPasteboard] availableTypeFromArray:[NSArray arrayWithObject:kSearchEngineEditorDraggedEngineType]])
  {
    return NSDragOperationMove;
  }
  return NSDragOperationNone;
}

- (BOOL)tableView:(NSTableView *)aTableView acceptDrop:(id <NSDraggingInfo>)info row:(int)dropRow dropOperation:(NSTableViewDropOperation)operation
{
  if (![[info draggingPasteboard] availableTypeFromArray:[NSArray arrayWithObject:kSearchEngineEditorDraggedEngineType]])
    return NO;

  NSIndexSet *draggedRowIndexes = [NSKeyedUnarchiver unarchiveObjectWithData:[[info draggingPasteboard] dataForType:kSearchEngineEditorDraggedEngineType]];

  // Since the table view will not properly select the moved engines at their new locations,
  // grab onto the first moving engine now so we can locate and base a selection from it later.
  id firstMovingEngine = [[mSearchEngineManager installedSearchEngines] objectAtIndex:[draggedRowIndexes firstIndex]];

  [mSearchEngineManager moveSearchEnginesAtIndexes:draggedRowIndexes toIndex:dropRow];

  // Select the moved engines by figuring out where the first engine actually
  // ended up and use it as the anchor of our new selection.
  unsigned indexOfFirstMovingEngine = [[mSearchEngineManager installedSearchEngines] indexOfObject:firstMovingEngine];
  NSIndexSet *movedEngineIndexes = [NSIndexSet indexSetWithIndexesInRange:NSMakeRange(indexOfFirstMovingEngine,
                                                                                      [draggedRowIndexes count])];
  [mSearchEnginesTableView selectRowIndexes:movedEngineIndexes byExtendingSelection:NO];
  return YES;
}

#pragma mark -

- (BOOL)validateMenuItem:(NSMenuItem*)menuItem
{
  if ([menuItem action] == @selector(removeSelectedSearchEngines:))
    return ([mSearchEnginesTableView numberOfSelectedRows] > 0);

  if ([menuItem action] == @selector(makeSelectedSearchEngineDefault:)) {
    if ([mSearchEnginesTableView numberOfSelectedRows] == 1) {
      // Disable if the selected engine is already default.
      NSString *currentlySelectedEngine = [[mSearchEngineManager installedSearchEngineNames] objectAtIndex:[mSearchEnginesTableView selectedRow]];
      return (![currentlySelectedEngine isEqualToString:[mSearchEngineManager preferredSearchEngine]]);
    }
    return NO;
  }

  if ([menuItem action] == @selector(editSelectedSearchEngine:))
    return ([mSearchEnginesTableView numberOfSelectedRows] == 1);

  return YES;
}

@end
