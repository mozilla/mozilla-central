import subprocess

def killAndClobber():
    print "Killing Firefox..."
    try:
        subprocess.call("C:\\Utilities\\pskill.exe firefox")
        subprocess.call(["C:\\Windows\\System32\\cmd.exe", "/X", "/C", "rmdir", "/s", "/q", "C:\\slave\\trunk_2k3\\mozilla\\objdir"])
    except Exception, err:
        print str(err)

def main():
    cvsco = open("C:\\slave\\trunk_2k3\\cvsco.log")
    lines = cvsco.readlines()
    cvsco.close()
    
    if 'U mozilla/tools/tinderbox-configs/firefox/win32/CLOBBER\n' in lines:
        killAndClobber()

if __name__ == "__main__":
    main()