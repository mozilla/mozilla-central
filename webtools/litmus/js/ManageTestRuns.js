var test_run;
var filter_req;

var showAllTestRuns = function(err) {
  // if they cancelled, then just don't change anything:
  if (err instanceof CancelledError) { return }
  toggleMessage('none');

  var testbox = document.getElementById("test_run_id");
  for (var i=0; i<testbox.options.length; i++) {
    var option = testbox.options[i];
    option.style.display = '';
  }
  enableForm(formName);
};

var doFilterList = function(req) {
  var tests = req.responseText.split("\n");
  var testbox = document.getElementById("test_run_id");
  var testsVisible = 0;
  for (var i=1; i<testbox.options.length; i++) {
    var test = testbox.options[i];
    var hideTest = 0;
    var id = test.value;
    if (tests.indexOf(id) == -1) { 
      hideTest = 1; 
    }
    hideTest == 1 ? test.style.display = 'none' : test.style.display = '';
    if (test.style.display != 'none') {
      testsVisible = 1;
    }
  }
  if (testsVisible) {
    testbox.options[0].text = '-Test Run (ID#)-';
  } else {
    testbox.options[0].text = '-No matching Test Runs found-';
  }    
  toggleMessage('none');
  enableForm(formName);
};

// filter the list by various criteria:
function filterList() {
  // they just changed the selection, so cancel any pending filter actions:
  if (filter_req instanceof Deferred && filter_req.fired == -1)
  filter_req.cancel();

  disableForm(formName);

  var productfilter = document.getElementById('product_filter');
  var branchfilter = document.getElementById('branch_filter');

  if (productfilter.options[productfilter.selectedIndex].value == '' &&
      branchfilter.options[branchfilter.selectedIndex].value == '') {
    // nothing to do here
    showAllTestRuns();
    return;
  }

  toggleMessage('loading','Filtering Test Run list...');
  filter_req = doSimpleXMLHttpRequest('manage_test_runs.cgi', {
    searchTestRunList: 1,
    product: (productfilter.options[productfilter.selectedIndex].value == '' ? '' : productfilter.options[productfilter.selectedIndex].value),
    branch: (branchfilter.options[branchfilter.selectedIndex].value == '' ? '' : branchfilter.options[branchfilter.selectedIndex].value),
  });

  // if something went wrong, just show all the tests:
  filter_req.addErrback(showAllTestRuns);
  filter_req.addCallback(doFilterList);
}

function setAuthor(user_id) {
  var authorBox = document.getElementById('author_id');
  setSelected(authorBox,user_id);;
}

function enableModeButtons() {
  document.getElementById("edit_test_run_button").disabled=false;
  document.getElementById("clone_test_run_button").disabled=false;
  document.getElementById("delete_test_run_button").disabled=false;
}

function disableModeButtons() {
  document.getElementById("edit_test_run_button").disabled=true;
  document.getElementById("clone_test_run_button").disabled=true;
  document.getElementById("delete_test_run_button").disabled=true;
}

function loadTestRun(silent) {
  var test_run_select = document.getElementById("test_run_id");

  if (! test_run_select ||
      test_run_select.options[test_run_select.selectedIndex].value=="") {
    disableModeButtons();
    document.getElementById('test_run_display_div').style.display = 'none';
    document.getElementById('editform_div').style.display = 'none';
    disableForm('edit_test_run_form');
    blankTestRunForm('edit_test_run_form');
    return false;
  } 

  var test_run_id = test_run_select.options[test_run_select.selectedIndex].value;

  disableForm('edit_test_run_form');
  if (!silent) {
    toggleMessage('loading','Loading Test Run ID# ' + test_run_id + '...');
  }
  var url = 'json.cgi?test_run_id=' + test_run_id;
  fetchJSON(url,populateTestRun,silent);
}

function populateTestRun(data) {
  test_run=data;
  document.getElementById('editform_test_run_id').value = test_run.test_run_id;
  document.getElementById('test_run_id_display').innerHTML = test_run.test_run_id;
  document.getElementById('name').value = test_run.name;
  document.getElementById('name_text').innerHTML = test_run.name;
  document.getElementById('description').value = test_run.description;
  if (test_run.description != '') {  
    document.getElementById('desc_text').innerHTML = test_run.description;
  } else {
    document.getElementById('desc_text').innerHTML = '<em>No description provided.</em>';
  }
  document.getElementById('start_timestamp').value = test_run.start_timestamp.replace(/-| |:/g, "");
  document.getElementById('start_timestamp_text').innerHTML = test_run.start_timestamp;
  document.getElementById('finish_timestamp').value = test_run.finish_timestamp.replace(/-| |:/g, "");  
  document.getElementById('finish_timestamp_text').innerHTML = test_run.finish_timestamp;
  var productBox = document.getElementById('product');
  var found_product = setSelected(productBox,test_run.product_id.product_id);
  if (found_product) {
    for (var i=0; i<products.length; i++) {
      if (test_run.product_id.product_id == products[i].product_id) {
        document.getElementById('product_text').innerHTML = products[i].name;
        continue;
      }
    }
  }

  changeProduct();
  var branchBox = document.getElementById('branch');
  populateBranches(branchBox,productBox);
  var found_branch = setSelected(branchBox,test_run.branch_id.branch_id);
  if (found_branch == 1) {
    for (var i=0; i<branches.length; i++) {
      if (test_run.branch_id.branch_id == branches[i].branch_id) {
        document.getElementById('branch_text').innerHTML = branches[i].name;
        continue;
      }
    }
  } else {
    document.getElementById('branch_text').innerHTML = '<em>No branch set for this Test Run.</em>';
  }
  populateAllTestgroups();

  var selectBoxTestgroups = document.getElementById('test_run_testgroups');
  selectBoxTestgroups.options.length = 0;
  for (var i=0; i<test_run.testgroups.length; i++) {
    var optionText = test_run.testgroups[i].name + ' (' + test_run.testgroups[i].testgroup_id + ')';

    selectBoxTestgroups.options[selectBoxTestgroups.length] = new Option(optionText,
                                                     test_run.testgroups[i].testgroup_id);
  }

  setAuthor(test_run.author_id.user_id);

  var enabled_em = document.getElementById('enabled')
  var enabled_display_em = document.getElementById('enabled_display')
  if (test_run.enabled == 1) {
    enabled_em.checked = true;
    enabled_display_em.checked = true;
  } else {
    enabled_em.checked = false;
    enabled_display_em.checked = false;
  }
  var recommended_em = document.getElementById('recommended')
  var recommended_display_em = document.getElementById('recommended_display')
  if (test_run.recommended == 1) {
    recommended_em.checked = true;
    recommended_display_em.checked = true;
  } else {
    recommended_em.checked = false;
    recommended_display_em.checked = false;
  }

  document.getElementById('creation_date').innerHTML = test_run.creation_date;
  document.getElementById('last_updated').innerHTML = test_run.last_updated;
  document.getElementById('version').innerHTML = test_run.version;

  resetTable('tblNewCriteria');
  if (!test_run.criteria ||
      test_run.criteria.length == 0) {
        addRowToTable('tblNewCriteria');
  } else {
    for (var i=0; i<test_run.criteria.length; i++) {
      addRowToTable('tblNewCriteria',
                     test_run.criteria[i].build_id,
                     test_run.criteria[i].platform_id,
                     test_run.criteria[i].opsys_id
                   );
    }
  }
  

  document.getElementById('editform_div').style.display = 'none';
  document.getElementById('test_run_display_div').style.display = 'block';
  
  enableModeButtons();
}

function populateAllTestgroups() {
  toggleMessage('loading','Narrowing Testgroup List...');
  try {
    var productBox = document.getElementById('product');
    var branchBox = document.getElementById('branch');
    var selectBoxAll = document.getElementById('testgroups_for_product');
    selectBoxAll.options.length = 0; 
    for (var i in testgroups) {
      if (testgroups[i].product_id != productBox.options[productBox.selectedIndex].value) {
        continue;
      }

      if (branchBox.selectedIndex >= 0) {
        var found_branch = 0;
        for (var j=0; j<branchBox.options.length; j++) {
          if (branchBox.options[j].value == '' ||
              branchBox.options[j].selected == false) {
            continue;
          }
          if (testgroups[i].branch_id == branchBox.options[j].value) {
            found_branch = 1;
          } 
        }
        if (found_branch == 0) {
          continue;
        }
      }
     
      var optionText = testgroups[i].name + ' (' + testgroups[i].testgroup_id + ')'; 
      selectBoxAll.options[selectBoxAll.length] = new Option(optionText,
                                                             testgroups[i].testgroup_id);
    }
    if (selectBoxAll.options.length == 0) {
      selectBoxAll.options[selectBoxAll.length] = new Option('-No Product/Branch selected-','');
    }
  } catch (e) {
    // And do what exactly?
  }

  toggleMessage('none');
}

function blankTestRunForm(formid) {
  blankForm(formid);
  resetTable('tblNewCriteria');
  addRowToTable('tblNewCriteria');
  document.getElementById('test_run_id_display').innerHTML = '';

  var selectBoxAll = document.getElementById('testgroups_for_product');
  selectBoxAll.options.length = 0;
  selectBoxAll.options[selectBoxAll.length] = new Option("-No Product/Branch Selected-",
                                                             "");
  selectBoxAll.selectedIndex=-1;
  var selectBoxTestgroups = document.getElementById('test_run_testgroups');
  selectBoxTestgroups.options.length = 0;
  selectBoxTestgroups.options[selectBoxTestgroups.length] = new Option("-No Test Run selected-","");
  selectBoxTestgroups.selectedIndex=-1;

  document.getElementById('enabled').checked = false;
  document.getElementById('recommended').checked = false;

  test_run = new Object();

  changeProduct();
  var productBox = document.getElementById('product');
  var branchBox = document.getElementById('branch');
  populateBranches(branchBox,productBox);
  populateAllTestgroups();
}

function switchToAdd() {
  disableModeButtons();
  blankTestRunForm('edit_test_run_form');
  var autoText = '<em>Automatically generated for a new Test Run</em>';
  document.getElementById('test_run_id_display').innerHTML = autoText;
  setAuthor(current_user_id);
  document.getElementById('creation_date').innerHTML = autoText;
  document.getElementById('last_updated').innerHTML = autoText;
  document.getElementById('version').innerHTML = autoText;

  document.getElementById('submit').value = 'Add Test Run';
  document.getElementById('mode').value = 'add';
  enableForm('edit_test_run_form');
  document.getElementById('test_run_display_div').style.display = 'none';
  document.getElementById('editform_div').style.display = 'block';
}

function switchToEdit() {
  document.getElementById('submit').value = 'Submit Edits';
  document.getElementById('mode').value = 'edit';
  enableForm('edit_test_run_form');
  document.getElementById('test_run_display_div').style.display = 'none';
  document.getElementById('editform_div').style.display = 'block';
}

function resetTestRun() {
  if (document.getElementById('test_run_id').value != '') {
    populateTestRun(test_run);
    switchToEdit();   
  } else {
    switchToAdd();
  }
}

function addRowToTable(tblName,buildID,platformID,opsysID) {
  var tbl = document.getElementById(tblName);
  var lastRow = tbl.rows.length;
  // if there's no header row in the table, then iteration = lastRow + 1
  var iteration = lastRow;
  var row = tbl.insertRow(lastRow);
 
  // Build ID cell
  var cellBuildID = row.insertCell(0);
  var el = document.createElement('input');
  el.setAttribute('type', 'text');
  el.setAttribute('name', 'build_id_new_' + iteration);
  el.setAttribute('id', 'build_id_new_' + iteration);
  el.setAttribute('size', '10');
  if (buildID) {
    el.setAttribute('value', buildID);
  }
  el.onchange = new Function("if (!checkBuildId(this,true)) { this.value = ''; this.focus(); }");
  cellBuildID.appendChild(el);

  // Platform cell
  var cellPlatform = row.insertCell(1);
  var el = document.createElement('select');
  el.setAttribute('name', 'platform_new_' + iteration);
  el.setAttribute('id', 'platform_new_' + iteration);
  el.setAttribute('size', '1');
  el.setAttribute('onChange', "changePlatform('_new_"+iteration+"')");
  el.setAttribute('class', 'select_platform');
  el.options[0] = new Option('-Platform (ID#)-','');
  for(i=0;i<platforms.length;i+=1) {
    el.options[i+1] = new Option(platforms[i].name+' ('+platforms[i].platform_id+')',platforms[i].platform_id);
  }
  cellPlatform.appendChild(el);

  // Opsys cell
  var cellOpsys = row.insertCell(2);
  var el = document.createElement('select');
  el.setAttribute('name', 'opsys_new_' + iteration);
  el.setAttribute('id', 'opsys_new_' + iteration);
  el.setAttribute('size', '1');
  el.setAttribute('class', 'select_opsys');
  el.options[0] = new Option('-Operating System (ID#)-','');
  cellOpsys.appendChild(el);

  if (platformID) {
    var platformBox = document.getElementById('platform_new_' + iteration);
    setSelected(platformBox,platformID);;
    changePlatform('_new_'+iteration);
  }

  if (opsysID) {
    var opsysBox = document.getElementById('opsys_new_' + iteration);
    setSelected(opsysBox,opsysID);;    
  }

  var cellRemoveButton = row.insertCell(3);
  var el = document.createElement('input');
  el.setAttribute('type', 'button');
  el.setAttribute('name', 'remove_row_new_' + iteration);
  el.setAttribute('id', 'remove_row_new_' + iteration);
  el.setAttribute('class', 'button');
  el.setAttribute('onClick', "removeRowFromTable('"+tblName+"');");
  el.setAttribute('value', '-');
  cellRemoveButton.appendChild(el);

  var cellAddButton = row.insertCell(4);
  var el = document.createElement('input');
  el.setAttribute('type', 'button');
  el.setAttribute('name', 'add_row_new_' + iteration);
  el.setAttribute('id', 'add_row_new_' + iteration);
  el.setAttribute('class', 'button');
  el.setAttribute('onClick', "addRowToTable('"+tblName+"');");
  el.setAttribute('value', '+');
  cellAddButton.appendChild(el);
}

function removeRowFromTable(tblName) {
  var tbl = document.getElementById(tblName);
  var lastRow = tbl.rows.length;
  if (lastRow > 2) tbl.deleteRow(lastRow - 1);
}

function resetTable(tblName) {
  var tbl = document.getElementById(tblName);
  var lastRow = tbl.rows.length;
  while (tbl.rows.length > 1) {
    tbl.deleteRow(tbl.rows.length - 1);
  }
}

function checkFormContents(f) {
  if ( checkString(f.name, 'Name') &&
       verifySelected(f.product, 'Product') &&
       verifySelected(f.branch, 'Branch') &&
       checkTimestamp(f.start_timestamp, 'Start Timestamp') &&
       checkTimestamp(f.finish_timestamp, 'Finish Timestamp') &&
       verifySelected(f.author_id, 'Author')) {
    // Verify that at least one testgroup is selected if this test run is
    // going to be enabled.
    if (f.enabled.checked) {
      return verifySelectNotEmpty(f.test_run_testgroups,"In order to enable a Test Run, at least one testgroup must be selected.");
    }
    return true;
  }

  return false;
}

