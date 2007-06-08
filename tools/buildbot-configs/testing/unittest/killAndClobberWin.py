import subprocess

def killAndClobber():
    print "Killing Firefox..."
    try:
        subprocess.call(["C:\\Utilities\\pskill.exe firefox"])
        subprocess.call(["cmd", "/X", "/C", "rmdir", "/s", "/q", "C:\\slave\\trunk\\mozilla\\objdir"])
    except e, err:
        print err.msg

def main():
    cvsco = open("C:\\slave\\trunk\\cvsco.log")
    lines = cvsco.readlines()
    cvsco.close()
    
    for line in lines:
        if 'U mozilla/testing/tinderbox-configs/firefox/win32/CLOBBER' in line:
            killAndClobber()

if __name__ == "__name__":
    main()
