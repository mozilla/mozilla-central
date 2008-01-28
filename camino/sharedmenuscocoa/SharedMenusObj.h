/* SharedMenusObj */

/* More Info - please contact Alco Blom at : alco@url-manager.com */

/* Object to use to support Shared Menus in Cocoa applications

    makes use of source code Copyright (c) 1991-2000 UserLand Software, Inc.,
    see included file 'MenuSharing.h'

    Description:
        this object makes your application a Menu Sharing Client
        
    How to use in your code:
        on application launch time:
            sharedMenusObj = [[SharedMenusObj alloc] init];
            
        on application quit time:
            [sharedMenusObj dealloc];
    
    Note:
        when no Menu Server is present in the user's system, this object
        does essentially nothing.
                
    How to use in your project:
        a) add the SharedMenusCocoa.framework to your project
        b) make sure you add the framework to the Copy Files section
        (in the end the framework should be in your bundle in /Contents/Frameworks)
        c) BTW: the SharedMenusCocoa.framework is in the build folder of this project
        
    Pitfalls:
        the SharedMenusObj install a Carbon Event Handler for:
        
        EventTypeSpec commandSpec = {kEventClassCommand, kEventCommandProcess};
        
        if your application already has an event handler installed for this
        event type, you can still use SharedMenus, but you need to adapt
        this source code. In that case, you must not install the Carbon event
        handler in SharedMenusObj and just act on command ID == 'SHMN'
        in your event handler and call SharedMenuHit right there;
        
    Extra:
        if you have the time, it would be nice to have a preference in your
        application named 'At Startup Disable Shared Menus'. Default should be: OFF.
        when it is ON, however, you should not create the sharedMenusObj.

    FTP: source of project (a ProjectBuilder project):
        ftp://ftp.url-manager.com/pub/SharedMenusCocoa.sit.bin
        
*/

#import <Cocoa/Cocoa.h>

@interface SharedMenusObj : NSObject
{
    NSTimer *timer;
    BOOL existsMenuServer;
    BOOL installedCommandHandler;
}
- (void)myStartSharedMenusTimer;
- (void)myStopSharedMenusTimer;
- (void)myCheckSharedMenus:(id)sender;
- (void)myInitSharedMenus;
- (void)myDisposeSharedMenus;
@end
