def check_call(*popenargs, **kwargs):
    try:
        from subprocess import check_call
        check_call(*popenargs, **kwargs)
    except ImportError:
        # Python 2.4 doesn't have check_call, so we reimplement it
        from subprocess import call
        def check_call(*popenargs, **kwargs):
            retcode = call(*popenargs, **kwargs)
            if retcode:
                cmd = kwargs.get("args")
                if cmd is None:
                    cmd = popenargs[0]
                raise Exception("Command '%s' returned non-zero exit status %d" % (cmd, retcode))
        check_call(*popenargs, **kwargs)
