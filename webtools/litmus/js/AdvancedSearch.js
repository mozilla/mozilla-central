var formName = "advanced_search";

// Since we use AJAX to populate some of the form fields, we need to alter 
// some of the functionality contained in SelectBoxes.js to repopulate the 
// search form after submission. The user *should* be more interested in 
// the results that just got returned, so we can do this in the background, 
// although we'll still disable the form briefly during AJAX events.
function repopulateForm() {
  selectsOnLoad();
  FormInit(document.forms['advanced_search'], document.location.search);
  changeProduct();
  changePlatform();
  FormInit(document.forms['advanced_search'], document.location.search);
  changeBranch();
  FormInit(document.forms['advanced_search'], document.location.search);

  var testgroupBox = document.getElementById('testgroup');
  var testgroupId = testgroupBox.options[testgroupBox.selectedIndex].value;
  if (!testgroupId) {
    // No testgroup selected.
    return;
  }
  disableForm(formName);
  var url = 'json.cgi?testgroup_id=' + testgroupId;
  fetchJSON(url,repopulateSubgroups,1);
}

function repopulateSubgroups(data) {
  testgroup=data;

  if (typeof(subgroupBox) == "undefined") {
    subgroupBox = document.getElementById('subgroup'+suffix);
  }

  clearSelect(subgroupBox);
  addNullEntry(subgroupBox);
  for (var i=0; i<testgroup.subgroups.length; i++) {
    var optionText = testgroup.subgroups[i].name + ' (' + testgroup.subgroups[i].subgroup_id + ')';
    subgroupBox.options[subgroupBox.length] = new Option(optionText,
                                                         testgroup.subgroups[i].subgroup_id);
  }

  FormInit(document.forms['advanced_search'], document.location.search);

  var subgroupId = subgroupBox.options[subgroupBox.selectedIndex].value;
  if (!subgroupId) {
    // No subgroup selected.
    enableForm(formName);
    return;
  }

  var url = 'json.cgi?subgroup_id=' + subgroupId;
  fetchJSON(url,repopulateTestcases,1);
}

function repopulateTestcases(data) {
  subgroup=data;

  var testcaseBox = document.getElementById('testcase');
  clearSelect(testcaseBox);
  addNullEntry(testcaseBox);
  for (var i=0; i<subgroup.testcases.length; i++) {
    var optionText = subgroup.testcases[i].summary + ' (' + subgroup.testcases[i].testcase_id + ')';
    testcaseBox.options[testcaseBox.length] = new Option(optionText,
                                                         subgroup.testcases[i].testcase_id);
  }

  FormInit(document.forms['advanced_search'], document.location.search);

  enableForm(formName);
}

var vettingHelpTitle = "What is vetting?";
var vettingHelpText = "<h2>vet:</h2>verb (<strong>vet&bull;ted</strong>, <strong>vet&bull;ting</strong>) [trans.]<br/><p>make careful examination of (something): <em>Someone should vet this report before it goes out.</em></p><p>In the Litmus context, to vet a test result means to examine it to make sure that the status (pass, fail, unclear) and configuration information are accurate and correct.</p><p>By default, new test results are marked as valid. Litmus admin users can then vet those results, marking them invalid if necessary.</em>"
