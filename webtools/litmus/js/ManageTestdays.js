var testday;

function enableTestdayModeButtons() {
  document.getElementById("edit_testday_button").disabled=false;
  document.getElementById("delete_testday_button").disabled=false;
}

function disableTestdayModeButtons() {
  document.getElementById("edit_testday_button").disabled=true;
  document.getElementById("delete_testday_button").disabled=true;
}

function loadTestday(silent) {
  var testday_select = document.getElementById("testday_id");

  if (! testday_select ||
      testday_select.options[testday_select.selectedIndex].value=="") {
    disableTestdayModeButtons();
    document.getElementById('edit_testday_form_div').style.display = 'none';
    disableForm('edit_testday_form');
    blankTestdayForm('edit_testday_form');
    return false;
  }

  var testday_id = testday_select.options[testday_select.selectedIndex].value;

  disableForm('edit_testday_form');
  toggleMessage('loading','Loading Testday ID# ' + testday_id + '...');
  var url = 'json.cgi?testday_id=' + testday_id;
  return fetchJSON(url,populateTestday);
}

function populateTestday(data) {
  testday=data;
  document.getElementById('edit_testday_form_testday_id').value = testday.testday_id;
  document.getElementById('edit_testday_form_testday_id_display').innerHTML = testday.testday_id;
  document.getElementById('edit_testday_form_desc').value = testday.description;
  document.getElementById('edit_testday_form_start_timestamp').value = testday.start_timestamp.replace(/-| |:/g, "");
  document.getElementById('edit_testday_form_finish_timestamp').value = testday.finish_timestamp.replace(/-| |:/g, "");
  productBox = document.getElementById('product');
  branchBox = document.getElementById('branch');
  testgroupBox = document.getElementById('testgroup');
  subgroupBox = document.getElementById('subgroup');
  if (testday.product_id) {
    setSelected(productBox,testday.product_id.product_id);
    changeProduct();
    if (testday.branch_id) {
      setSelected(branchBox,testday.branch_id.branch_id);
      changeBranch();
      if (testday.testgroup_id) {
        setSelected(testgroupBox,testday.testgroup_id.testgroup_id);
        changeTestgroup();
      } else {
        setSelected(testgroupBox,"");
        changeTestgroup();
      }
    } else {
    setSelected(branchBox,"");
    changeBranch();
    changeTestgroup();        
    }
  } else {
    setSelected(productBox,"");
    changeProduct();
    changeBranch();
    changeTestgroup();
  } 
  document.getElementById('build_id').value = testday.build_id
  localeBox = document.getElementById('locale');
  if (testday.locale_abbrev) {
    setSelected(localeBox,testday.locale_abbrev.locale_abbrev);
  } else {
    setSelected(localeBox,"");
  }

  document.getElementById('edit_testday_form_div').style.display = 'block';
  disableForm('edit_testday_form');
  enableTestdayModeButtons();
}

function blankTestdayForm(formid) {
  blankForm(formid);
  document.getElementById('edit_testday_form_testday_id_display').innerHTML = '';
  productBox = document.getElementById('product');
  setSelected(productBox,"");
  changeProduct();
  changeBranch();
  changeTestgroup();
}

function switchTestdayFormToAdd() {
  disableTestdayModeButtons();
  blankTestdayForm('edit_testday_form');
  document.getElementById('edit_testday_form_testday_id_display').innerHTML = '<em>Automatically generated for a new testday</em>';
  document.getElementById('edit_testday_form_submit').value = 'Add Testday';
  document.getElementById('edit_testday_form_mode').value = 'add';
  enableForm('edit_testday_form');
  document.getElementById('edit_testday_form_div').style.display = 'block';
}

function switchTestdayFormToEdit() {
  document.getElementById('edit_testday_form_submit').value = 'Submit Edits';
  document.getElementById('edit_testday_form_mode').value = 'edit';
  enableForm('edit_testday_form');
  document.getElementById('edit_testday_form_div').style.display = 'block';
}


function checkTestdayForm(f) {
  return (
          checkString(f.edit_testday_form_name,"testday description",false) &&
          checkTimestamp(f.edit_testday_form_start_timestamp,false) &&
          checkTimestamp(f.edit_testday_form_finish_timestamp,false)
         );
}

function resetTestday() {
  if (document.getElementById('edit_testday_form_testday_id').value != '') {
    populateTestday(testday);
    switchTestdayFormToEdit();   
  } else {
    switchTestdayFormToAdd();   
  }
}

function populateSubgroups(data) {
  testgroup=data;

  if (typeof(subgroupBox) == "undefined") {
    subgroupBox = document.getElementById('subgroup'+suffix);
  }

  clearSelect(subgroupBox);
  addNullEntry(subgroupBox);
  if (testgroup) {
    for (var i=0; i<testgroup.subgroups.length; i++) {
      var optionText = testgroup.subgroups[i].name + ' (' + testgroup.subgroups[i].subgroup_id + ')';
      subgroupBox.options[subgroupBox.length] = new Option(optionText,
                                                           testgroup.subgroups[i].subgroup_id
                                                           );
    }
  }
  if (testday && testday.subgroups) {
    subgroupBox.selectedIndex == -1;
    for (var i=0; i<testday.subgroups.length; i++) {
      setSelected(subgroupBox,testday.subgroups[i].subgroup_id,1);
    }
  }
//  FormInit(document.forms[formName], document.location.search, 'subgroup'+suffix);
  if (enableFormAfterLoad && enableFormAfterLoad > 0) {
    enableFormAfterLoad = 0; 
    toggleMessage('none');
    enableForm(formName);
  }
}
