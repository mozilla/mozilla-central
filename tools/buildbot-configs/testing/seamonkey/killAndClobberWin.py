import os, subprocess, sys, getopt

def usage():
    print "killAndClobberWin.py [--help] [--platform=?] [--slave_name=?] [--branch=?]"
    print "    Defaults:"
    print "        platform:  <none>"
    print "        slaveName: slave"
    print "        branch:    trunk"

def rmdirRecursive(dir):
    """This is a replacement for shutil.rmtree that works better under
    windows. Thanks to Bear at the OSAF for the code."""
    if not os.path.exists(dir):
        return

    if os.path.islink(dir):
        os.remove(dir)
        return

    # Verify the directory is read/write/execute for the current user
    os.chmod(dir, 0700)

    for name in os.listdir(dir):
        full_name = os.path.join(dir, name)
        # on Windows, if we don't have write permission we can't remove
        # the file/directory either, so turn that on
        if os.name == 'nt':
            if not os.access(full_name, os.W_OK):
                # I think this is now redundant, but I don't have an NT
                # machine to test on, so I'm going to leave it in place
                # -warner
                os.chmod(full_name, 0600)

        if os.path.isdir(full_name):
            rmdirRecursive(full_name)
        else:
            os.chmod(full_name, 0700)
            os.remove(full_name)
    os.rmdir(dir)

def killAndClobber(slaveName, branchDir):
    print "Killing SeaMonkey..."
    mozDir = os.path.join('C:\\', 
                          slaveName,
                          branchDir,
                          'mozilla')
    try:
        # This may be redundant if the pskill on sh.exe succeeds, but we
        # want to be sure.
        subprocess.call("D:\\PsTools\\pskill.exe -t sh.exe")
        subprocess.call("D:\\PsTools\\pskill.exe -t make.exe")
        subprocess.call("D:\\PsTools\\pskill.exe -t seamonkey.eye")
        rmdirRecursive(mozDir);
    except Exception, err:
        print str(err)

def main(argv):
    
    try:
        opts, args = getopt.getopt(argv,
                                   "hp:s:b:d",
                                   ["help",
                                    "platform=",
                                    "slaveName=",
                                    "branch="])
    except getopt.GetoptError:
        usage()
	sys.exit(2)

    platform = ""
    slaveName = "slave"
    branch = "trunk"
    branchDir = "trunk"

    for opt,arg in opts:
        if opt in ("-h", "--help"):
            usage()
	    sys.exit()
        elif opt in ("-p", "--platform"):
            platform = arg
        elif opt in ("-s", "--slaveName"):
            slaveName = arg
        elif opt in ("-b", "--branch"):
            branch = arg
    
    if platform != "":
        branchDir = branch + "_" + platform

    logDir = os.path.join('D:\\builds\\',
                          slaveName,
                          branchDir,
                          'logs')
    tboxClobberLog = os.path.join(logDir, 'tbox-CLOBBER-cvsco.log')
    buildbotClobberLog = os.path.join(logDir, 'buildbot-CLOBBER-cvsco.log')

    tboxCvsCo = open(tboxClobberLog)
    tboxLines = tboxCvsCo.readlines()
    tboxCvsCo.close()
    buildbotCvsCo = open(buildbotClobberLog)
    buildbotLines = buildbotCvsCo.readlines()
    buildbotCvsCo.close()

    if 'U tinderbox-configs/CLOBBER\n' in tboxLines or 'U buildbot-configs/CLOBBER\n' in buildbotLines:
        killAndClobber(slaveName, branchDir)
    else:
        print "No clobber required"

if __name__ == "__main__":
    main(sys.argv[1:])

