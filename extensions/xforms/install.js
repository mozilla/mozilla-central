// Using space required numbers as of 2007-07-16.  I'm sure that the number
// will only go up from here.  But for now, as good a guess as any.
var version = "0.8.0.3";
var srChrome = 534;
var srComponents = 910;

// this function verifies disk space in kilobytes
function verifyDiskSpace(dirPath, spaceRequired)
{
  var spaceAvailable;

  // Get the available disk space on the given path
  spaceAvailable = fileGetDiskSpaceAvailable(dirPath);

  // Convert the available disk space into kilobytes
  spaceAvailable = parseInt(spaceAvailable / 1024);

  // do the verification
  if(spaceAvailable < spaceRequired)
  {
    logComment("Insufficient disk space: " + dirPath);
    logComment("  required : " + spaceRequired + " K");
    logComment("  available: " + spaceAvailable + " K");
    return(false);
  }

  return(true);
}

var err = initInstall("Mozilla XForms", "XForms", version);
logComment("initInstall: " + err);

var fProgram = getFolder("Program");
if (verifyDiskSpace(fProgram, srChrome + srComponents))
{
  err = addDirectory("", version, "components", fProgram, "components", true);
  logComment("addDirectory components: " + err);
  err = addDirectory("", version, "chrome", fProgram, "chrome", true);
  logComment("addDirectory chrome: " + err);

  registerChrome(PACKAGE | DELAYED_CHROME, getFolder("Chrome", "xforms.jar"),
                 "content/xforms/");
  registerChrome(LOCALE | DELAYED_CHROME, getFolder("Chrome", "xforms.jar"),
                 "locale/en-US/xforms/");
  registerChrome(SKIN | DELAYED_CHROME, getFolder("Chrome", "xforms.jar"),
                 "skin/xforms/");

  if (err == SUCCESS)
  {
    err = performInstall();
    logComment("performInstall() returned: " + err);
  }
  else
  {
    cancelInstall();
    logComment("cancelInstall() due to error: "+err);
  }
}
else
  cancelInstall(INSUFFICIENT_DISK_SPACE);
