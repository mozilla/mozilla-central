#import "SharedMenusObj.h"

extern pascal Boolean CheckSharedMenus (short);
extern pascal Boolean InitSharedMenusSimple (void);
extern pascal Boolean DisposeSharedMenus (void);

extern OSStatus InstallCarbonSharedMenusHandler();
extern void RemoveCarbonSharedMenusHandler();

@implementation SharedMenusObj

/*
    GetWebPageName is a utility function to get the window title of
    the front browser window. It is used by the Add Bookmark dialog
    of URL Manager Pro
*/

NSString* GetWebPageName() {
    NSWindow* windowRef = [NSApp mainWindow];
    if (windowRef != nil) {
        return [windowRef title];
    }

    return nil;
}

-(id)init
{
    if (self = [super init]) {
    
        existsMenuServer = NO;
        installedCommandHandler = NO;
        
        [self myInitSharedMenus];
        
        if (existsMenuServer)
            [self myStartSharedMenusTimer];
            
    }
    return self;
}

- (void)myInitSharedMenus
{
   existsMenuServer = InitSharedMenusSimple();
}

- (void)myStartSharedMenusTimer
{
    OSStatus err;
    
    timer = [[NSTimer scheduledTimerWithTimeInterval:1 target:self selector:@selector(myCheckSharedMenus:)
            userInfo:nil repeats:YES] retain];
    
    err = InstallCarbonSharedMenusHandler();
    if (err == noErr)
        installedCommandHandler = YES;
}

- (void)myStopSharedMenusTimer
{
    if (installedCommandHandler)
        RemoveCarbonSharedMenusHandler();
    
    [timer invalidate];
    [timer release];
}

- (void)myCheckSharedMenus:(id)sender
{
    CheckSharedMenus (0);
}

- (void)myDisposeSharedMenus
{
   DisposeSharedMenus();
}

- (void)dealloc
{
    if (existsMenuServer) {
        [self myStopSharedMenusTimer];
        [self myDisposeSharedMenus];
    }
    
    [super dealloc];
}
@end
