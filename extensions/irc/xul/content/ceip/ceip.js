function CEIP()
{
    // 'types' is a comma-separated sorted list.
    this.enabled = false;
    this.types = "";
    this.commandNest = 0;
    this.uploadBlock = new Object();

    // Give the user a unique, but random, ID.
    if (!client.prefs["ceip.userid"])
        client.prefs["ceip.userid"] = randomString(32);

    this.update();
    setTimeout(function(self) { self.uploadLogs() }, 1000, this);
}

CEIP.prototype.destroy =
function ceip_destroy()
{
    this.stopLog();
}

CEIP.prototype.notifyUpdate =
function ceip_notifyupdate()
{
    setTimeout(function(self) { self.update() }, 100, this);
}

CEIP.prototype.update =
function ceip_update()
{
    var self = this;
    function updateAndLogTypes(types)
    {
        if (self.enabled && (self.types != types.join(",")))
        {
            self.types = types.join(",");
            self.logEvent({type: "logger", event: "types", list: self.types});
        }
    };

    // Find out which CEIP logging types are enabled.
    var types = new Array();
    var prefs = client.prefManager.listPrefs("ceip.log.");
    for (var i = 0; i < prefs.length; i++)
    {
        if ((typeof client.prefs[prefs[i]] == "boolean") && client.prefs[prefs[i]])
            types.push(prefs[i].substr(9));
    }
    var enabled = (types.sort().length > 0);

    // If we're logging currently, and the types have changed, log that change.
    updateAndLogTypes(types);

    // Start or stop the logging if the overall enabled state has changed.
    if (!this.enabled && enabled)
        this.startLog();
    else if (this.enabled && !enabled)
        this.stopLog();

    // If we're now logging, and the types have changed, log that change.
    // Note that this is done twice to ensure we always have the types logged.
    updateAndLogTypes(types);
}

CEIP.prototype.getLogFolder =
function ceip_getlogfolder()
{
    var logPath = new nsLocalFile(client.prefs["profilePath"]);
    logPath.append("ceip");
    return logPath;
}

CEIP.prototype.getLogFile =
function ceip_getlogfile()
{
    var logFilePath = this.getLogFolder();
    logFilePath.append("current.log");
    return logFilePath;
}

CEIP.prototype.startLog =
function ceip_startlog()
{
    dd("CEIP: LOGGING START");
    this.enabled = true;
    this.logEvent({
        type: "logger",
        event: "start",
        userid: client.prefs["ceip.userid"],
        clientVersion: __cz_version,
        clientVersionSuffix: __cz_suffix
    });

    var self = this;
    var hfn1 = function(e) { return self.hookCommandBefore(e); };
    var hfn2 = function(e) { return self.hookCommandAfter(e); };
    var hfn3 = function(event, cx, popup) { return self.hookMenuOpen(event, cx, popup); };
    var hfn4 = function(event, cx, popup) { return self.hookMenuClose(event, cx, popup); };

    // Set up all of our hooks.
    if (!("beforeHooks" in client.commandManager)) {
        client.commandManager.beforeHooks = new Object();
    }
    if (!("afterHooks" in client.commandManager)) {
        client.commandManager.afterHooks = new Object();
    }
    client.commandManager.beforeHooks["ceip"] = hfn1;
    client.commandManager.afterHooks["ceip"] = hfn2;
    this.commandNest = 0;
    if (client.menuManager.onCallbackPopupShowing)
        throw "Someone beat CEIP to the MenuManager callback!";
    client.menuManager.onCallbackPopupShowing = hfn3;
    client.menuManager.onCallbackPopupHiding = hfn4;
}

CEIP.prototype.stopLog =
function ceip_stoplog()
{
    // Remove all of our hooks.
    if ("beforeHooks" in client.commandManager) {
        delete client.commandManager.beforeHooks["ceip"];
    }
    if ("afterHooks" in client.commandManager) {
        delete client.commandManager.afterHooks["ceip"];
    }
    client.menuManager.onCallbackPopupShowing = null;
    client.menuManager.onCallbackPopupHiding = null;

    this.logEvent({type: "logger", event: "stop"});
    this.enabled = false;
    dd("CEIP: LOGGING STOP");
}

CEIP.prototype.logEvent =
function ceip_logevent(data)
{
    const NORMAL_FILE_TYPE = Components.interfaces.nsIFile.NORMAL_FILE_TYPE;

    // Don't log anything we're not meant to. We always log 'logger' events.
    if ((data.type != "logger") && !client.prefs["ceip.log." + data.type])
        return;

    var logFile = this.getLogFile();
    if (!logFile.exists()) {
        logFile.create(NORMAL_FILE_TYPE, 0600);
        this.writeLogLine("<events>");
    }

    var line = "  <event";
    data.time = Number(new Date());
    for (var prop in data) {
        if (prop.match(/[^-_a-z0-9]/i)) {
            // Skip anything that's not a valid name for our log.
            continue;
        }
        line += " " + prop + '="';
        line += encodeForXMLAttribute(String(data[prop])) + '"';
    }
    line += "/>";
    this.writeLogLine(line);

    // We want to return if we're:
    //   a) currently switching logs.
    //   b) haven't filled up the current log file.
    if (("changeOver" in this) || (logFile.fileSize < client.prefs["ceip.uploadSize"])) {
        return;
    }

    this.changeOver = true;
    this.stopLog();
    this.writeLogLine("</events>");

    try
    {
        // Move current log to a unique filename before resuming logging.
        var oldFile = this.getLogFile();
        var newFile = this.getLogFile();
        newFile.leafName = Number(new Date()) + ".xml";
        newFile.createUnique(NORMAL_FILE_TYPE, 0600);
        oldFile.moveTo(null, newFile.leafName);

        this.startLog();
    }
    catch (ex)
    {
        this.logEvent({type: "logger", event: "error", method: "logEvent",
                       error: formatException(ex)});
        this.logEvent({type: "logger", event: "start"});
    }
    delete this.changeOver;

    setTimeout(function(self) { self.uploadLogs() }, 1000, this);
}

CEIP.prototype.writeLogLine =
function ceip_writelogline(line)
{
    dd("CEIP: " + line);
    var logFile = new LocalFile(this.getLogFile(), ">>");
    logFile.write(line + client.lineEnd);
    try
    {
        logFile.close();
    }
    catch (ex)
    {}
}

CEIP.prototype.uploadLogs =
function ceip_uploadlogs()
{
    const nsILocalFile = Components.interfaces.nsILocalFile;

    try
    {
        var logPath = this.getLogFolder();
        var enumerator = logPath.directoryEntries;
        var re = new RegExp("^\\d+\\.xml", "i");

        while (enumerator.hasMoreElements())
        {
            var file = enumerator.getNext().QueryInterface(nsILocalFile);
            if (re.test(file.leafName))
                this.uploadLog(file);
        }
    }
    catch(ex)
    {
        this.logEvent({type: "logger", event: "error", method: "uploadLogs",
                       error: formatException(ex)});
    }
}

CEIP.prototype.uploadLog =
function ceip_uploadlog(file)
{
    var self = this;

    function uploadLogDone()
    {
        var rpl = request.responseText;
        var ary;

        if (!/^RESULT OK$/m.test(rpl))
        {
            ary = rpl.match(/^RESULT FAILED: (.*)$/m);
            var err = ary && ary[1] ? ary[1] : request.status + " " +
                                               request.statusText;
            self.logEvent({type: "logger", event: "upload", result: "failed",
                           error: err});
            addStatusMessage(getMsg(MSG_CEIP_UPLOAD_FAILED, [file.leafName,
                                                             err]));
            return;
        }

        ary = rpl.match(/^ID ([\w.]+)$/m);
        self.logEvent({type: "logger", event: "upload", result: "ok",
                       key: ary[1]});
        addStatusMessage(getMsg(MSG_CEIP_UPLOAD_OK, file.leafName));

        try
        {
            file.remove(false);
        }
        catch(ex)
        {
            self.logEvent({type: "logger", event: "error",
                           method: "uploadLogDone",
                           error: formatException(ex)});
        }
    };

    function uploadLogError()
    {
        var err = request.status + " " + request.statusText;
        self.logEvent({type: "logger", event: "upload", result: "failed",
                       error: err});
        addStatusMessage(getMsg(MSG_CEIP_UPLOAD_FAILED, [file.leafName, err]));
    };

    try
    {
        // Make sure each file is only uploaded once per session.
        if (file.leafName in this.uploadBlock)
            return;
        this.uploadBlock[file.leafName] = true;

        // Create URL for sending data.
        var uploadUrl = client.prefs["ceip.uploadUrl"];
        uploadUrl += "?uid=" + client.prefs["ceip.userid"];
        uploadUrl += "&fid=" + file.leafName;

        // Read in file in chunks (FIXME: why?) into string for uploading.
        var data = "";
        var chunkSize = 10240;
        var readLog = new LocalFile(file, "<");
        while (readLog.inputStream.available() > chunkSize)
            data += readLog.read(chunkSize);
        data += readLog.read(readLog.inputStream.available());
        readLog.close();

        // Upload file using a simple POST request to the configured URL.
        var request = new XMLHttpRequest();
        request.onload = uploadLogDone;
        request.onerror = uploadLogError;
        request.open("POST", uploadUrl);
        request.send(data);
    }
    catch(ex)
    {
        var err = formatException(ex);
        this.logEvent({type: "logger", event: "error", method: "uploadLog",
                       error: err});
        addStatusMessage(getMsg(MSG_CEIP_UPLOAD_FAILED, [file.leafName, err]));
    }
}

CEIP.prototype.getCurrentViewType =
function ceip_getcurrentviewtype()
{
    try
    {
        if (client.currentObject && ("unicodeName" in client.currentObject))
            return client.currentObject.TYPE;
    }
    catch (ex) {}
    return MSG_UNKNOWN;
}

CEIP.prototype.getEventViewType =
function ceip_geteventviewtype(e)
{
    try
    {
        if (("sourceObject" in e) && e.sourceObject)
            return e.sourceObject.TYPE;
    }
    catch (ex) {}
    return MSG_UNKNOWN;
}

CEIP.prototype.isCommandIgnored =
function ceip_iscommandignored(e)
{
    return (e.command.name == "create-tab-for-view") ||
           (e.command.name == "set-current-view") ||
           (e.command.name == "focus-input") ||
           (e.command.name == "say") ||
           (e.command.name == "me") ||
           (e.command.name == "msg") ||
           (e.command.name == "describe");
}

CEIP.prototype.hookCommandBefore =
function ceip_hookcommandbefore(e)
{
    try
    {
        if (this.isCommandIgnored(e))
            return;

        this.commandNest++;

        var data = {type: "command", viewType: this.getEventViewType(e),
                    command: e.command.name};

        if (typeof e.command.func == "string")
            data.alias = true;
        if (("source" in e) && (typeof e.source == "string"))
            data.interactive = e.source;
        else if (e.isInteractive)
            data.interactive = true;
        if (this.commandNest > 1)
            data.nest = (this.commandNest - 1);

        this.logEvent(data);
    }
    catch (ex)
    {
        this.logEvent({type: "logger", event: "error",
                       method: "hookCommandBefore",
                       error: formatException(ex)});
    }
}

CEIP.prototype.hookCommandAfter =
function ceip_hookcommandafter(e)
{
    try
    {
        if (this.isCommandIgnored(e))
            return;

        this.commandNest--;
    }
    catch (ex)
    {
        this.logEvent({type: "logger", event: "error",
                       method: "hookCommandAfter",
                       error: formatException(ex)});
    }
}

CEIP.prototype.hookMenuOpen =
function ceip_hookmenuopen(event, cx, popup)
{
    try
    {
        this.logEvent({type: "menu", viewType: this.getCurrentViewType(),
                       event: "open", name: popup.getAttribute("menuName")});
    }
    catch(ex)
    {
        this.logEvent({type: "logger", event: "error",
                       method: "hookMenuOpen",
                       error: formatException(ex)});
    }
}

CEIP.prototype.hookMenuClose =
function ceip_hookmenuclose(event, cx, popup)
{
    try
    {
        this.logEvent({type: "menu", viewType: this.getCurrentViewType(),
                       event: "close", name: popup.getAttribute("menuName")});
    }
    catch(ex)
    {
        this.logEvent({type: "logger", event: "error",
                       method: "hookMenuClose",
                       error: formatException(ex)});
    }
}
