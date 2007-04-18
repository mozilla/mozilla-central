function tc_init() {
    var divs = document.getElementsByClassName("testcase-content");
    allStretch = new fx.MultiFadeSize(divs, {height: true, opacity: true, duration: 400});

    allStretch.hideAll();

    testConfigHeight = new fx.Height('test_run_summary', {duration: 400});
    testConfigHeight.toggle();

    allStretch.fxa[0].toggle();
}

function confirmPartialSubmission() {
    msg = "Did you intend to only submit a single test result? (Hint: There is a 'Submit All Results' button at the bottom of the page.)";
   return confirm(msg);
}

function confirmTestRunSelection(testRunUrl) {
    if (confirm("Does your config match that listed in the details and criteria (if any)?")) {
        document.location = testRunUrl;
    }
}

function checkFormContents(f) {
    var criteria = document.getElementsByName('criterion');
    if (checkRadio(criteria,'required criteria')) {
        if (criteria[0].value == 'new') {
            return (
                    checkBuildId(document.getElementById('build_id_new'), false) &&
                    verifySelected(document.getElementById('platform_new'), 'platform') &&
                    verifySelected(document.getElementById('opsys_new'), 'operating system')
                   );
        } else {
            for (var i=0; i<criteria.length; i++) {
                if (criteria[i].checked == true) {
                    var a = new Array;
                    a = criteria[i].value.split('|');
                    return (
                            verifySelected(document.getElementById('platform_'+a[0]), 'platform') &&
                            verifySelected(document.getElementById('opsys_'+a[0]), 'operating system')
                           );                    
                }
            }
        }
    }
    return false;
}

function addRowToTable(tblName,position,buildID,platformID,opsysID) {
  var tbl = document.getElementById(tblName);
  var row = tbl.insertRow(position);
  if (position % 2 == 0) {
    row.setAttribute('class', 'even');
  } else {
    row.setAttribute('class', 'odd');
  }    

  // Radio button cell
  var cellRadioButton = row.insertCell(0);
  cellRadioButton.setAttribute('align', 'center');
  var el = document.createElement('input');
  cellRadioButton.appendChild(el);
  el.setAttribute('type', 'radio');
  el.setAttribute('name', 'criterion');
  el.setAttribute('id', 'criterion');
  if (buildID) {
    el.setAttribute('value', position+'|'+
                             buildID+'|'+
                             platformID+'|'+
                             opsysID
                   );
  } else {
    el.setAttribute('value', 'new');
    el.setAttribute('checked',true)
  }
 
  // Build ID cell
  var cellBuildID = row.insertCell(1);
  cellBuildID.setAttribute('align', 'center');
  if (buildID) {
    cellBuildID.innerHTML = "<strong>" + buildID + "</strong>" +
      "<input type='hidden' name='build_id_" + position +
      "' id='build_id_" + position + "' value='" + buildID + "' />";
  } else {
    var el = document.createElement('input');
    el.setAttribute('type', 'text');
    el.setAttribute('name', 'build_id_new');
    el.setAttribute('id', 'build_id_new');
    el.setAttribute('size', '10');
    if (appBuildID) {
      el.setAttribute('value', appBuildID);
    }
    el.onchange = new Function("if (!checkBuildId(this,true)) { this.value = ''; this.focus(); }");
    cellBuildID.appendChild(el);
  }

  // Platform cell
  var cellPlatform = row.insertCell(2);
  cellPlatform.setAttribute('align', 'center');
  var el = document.createElement('select');
  if (buildID) {
    el.setAttribute('name', 'platform_' + position);
    el.setAttribute('id', 'platform_' + position);
    el.setAttribute('onChange', "changePlatform('_"+position+"')");
  } else {
    el.setAttribute('name', 'platform_new');
    el.setAttribute('id', 'platform_new');
    el.setAttribute('onChange', "changePlatform('_new')");
  }
  el.setAttribute('size', '1');
  el.setAttribute('class', 'select_platform');
  el.options[0] = new Option('-Platform (ID#)-','');
  for(var i=0;i<platforms.length;i+=1) {
    el.options[i+1] = new Option(platforms[i].name+' ('+platforms[i].platform_id+')',platforms[i].platform_id);
  }
  cellPlatform.appendChild(el);

  // Opsys cell
  var cellOpsys = row.insertCell(3);
  cellOpsys.setAttribute('align', 'center');
  var el = document.createElement('select');
  if (buildID) {
    el.setAttribute('name', 'opsys_' + position);
    el.setAttribute('id', 'opsys_' + position);
  } else {
    el.setAttribute('name', 'opsys_new');
    el.setAttribute('id', 'opsys_new');
  }
  el.setAttribute('size', '1');
  el.setAttribute('class', 'select_opsys');
  el.options[0] = new Option('-Operating System (ID#)-','');
  cellOpsys.appendChild(el);

  if (platformID) {
    var platformBox = document.getElementById('platform_' + position);
    platformBox.setAttribute('disabled','true');
    setSelected(platformBox,platformID);
    changePlatform('_'+position);
  }

  if (opsysID) {
    var opsysBox = document.getElementById('opsys_' + position);
    opsysBox.setAttribute('disabled','true');
    setSelected(opsysBox,opsysID);
  }

}

function getBuildId() {
    if (navigator.buildID && appBuildID == "0000000000") {
        appBuildID=navigator.buildID;
    } else if (appBuildID == "0000000000") {
        try {
            netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
            var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
            if(appInfo.appBuildID) {
                appBuildID = appInfo.appBuildID;
            }
        } catch (e) {
            // Cascade to the next lookup method.
        }
    } 
}

function resetCriteria() {
  var criteria = document.getElementsByName('criterion');
  var suffix = '';
  if (criteria[0].value == 'new') {
    suffix='_new';
    if (appBuildID && appBuildID != "0000000000") {
      document.getElementById('build_id_new').value = appBuildID ;
    } else {
      document.getElementById('build_id_new').value = "" ;
    }
  }
  
  for (var i=0; i<criteria.length; i++) {    
    if (suffix != '_new') {
      var a = new Array;
      a = criteria[i].value.split('|');
      suffix='_'+a[0];
    }
    // If the opsys is disabled, we don't have to reset this row because the
    // will not have changed anything.
    var platformBox = document.getElementById('platform'+suffix);
    var opsysBox = document.getElementById('opsys'+suffix);
    if (opsysBox.disabled == true) {
      continue;
    }

    if (platformBox.disabled == false) {
      setSelected(platformBox,'');
    }
    
    changePlatform(suffix);
    setSelected(opsysBox,'');
  }
}

var buildIDHelpTitle = 'How do I determine the build ID?';
var buildIDHelpText = '<p>The build ID is a 10-digit number that identifies a Mozilla product build down to the date and hour of the build. By supplying the full, correct build ID, you will be making the job of the Mozilla QA team <em>much</em> easier. There are several different ways to determine the build ID of the build you are testing.</p><ol><li><b>Manually</b>: Provided you have installed Talkback, this is the fail-safe method, and allows you to submit the build ID for products other than the one currently being used to submit the results. The Mozilla Quality Assurance wiki has instructions on <a target="external_link_from_litmus" href="http://wiki.mozilla.org/MozillaQualityAssurance:Build_Ids">how to manually verify the build ID</a>.</li><li><b>Nightly Tester Tools</b>: Available for both Firefox and Thunderbird,  the Nightly Tester Tools extension adds a number of useful features for testing Mozilla products. This includes a handy display of the build ID of the running build in the title bar. You can download this extension from <a target="external_link_from_litmus" href="https://addons.mozilla.org/search.php?q=Nightly+Tester+Tools">addons.mozilla.org</a>.</li><li><b>Automatic detection</b>: Litmus has JavaScript code built-in to automatically detect the build ID of the current build, but it relies on <a target="external_link_from_litmus" href="http://www.mozilla.org/projects/security/components/signed-scripts.html#codebase">JavaScript codebase principals</a> to do so. To enable codebase principals, testers must add this line to the prefs.js file in their Mozilla user profile dir, or simply edit the pref directly in <a target="external_link_from_litmus" href="http://kb.mozillazine.org/About:config">about:config</a>:<br/><br/><b><code>user_pref("signed.applets.codebase_principal_support", true);</code></b><br/><br/><b>NOTE</b>: this will only be useful if you are submitting results for the currently running version of Firefox. If you are concerned about the security issues of enabling codebase support, you can <a target="external_link_from_litmus" href="http://www.mozilla.org/projects/security/components/signed-scripts.html#codebase">read more about codebase principals here</a>.</li></ol>';
var appBuildID = "0000000000";


